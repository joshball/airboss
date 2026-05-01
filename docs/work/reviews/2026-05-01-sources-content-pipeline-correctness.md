---
feature: sources-content-pipeline
category: correctness
date: 2026-05-01
branch: main
status: unread
review_status: done
issues_found: 18
critical: 2
major: 5
minor: 6
nit: 5
---

## Summary

The `airboss-ref:` parser, registry, lifecycle, and derivative writers are well-structured and mostly correct against ADR 019. The download pipeline correctly implements ADR 022's two-hop scrape, ordinal-prefix-match, and HEAD-based freshness. However, several correctness gaps exist:

- The AIM source-PDF ingest path has a manifest-shape mismatch: `aim/source-ingest.ts` reads `entries[]` while the downloader writes `primary/sections/appendices` (per ADR 021/022). This makes `bun run sources register aim --cache=...` register zero entries silently.
- The AC live-URL builder mis-composes URLs for "dot-style" doc numbers (e.g. `91-21.1D`), producing `AC_91-21.1D.pdf` where FAA serves `AC_91.21-1D.pdf`.
- Several writers (`regs/cache.ts`, `regs/derivative-writer.ts`, `download/http.ts`, `download/html-fetch.ts`, both Python `urlopen` writers, ACS/AC ingest, AIM source-ingest derivatives) write directly to destination files without the tmp+rename pattern ADR 021 explicitly calls out, leaving partial files on crash/interrupt.

The validator/parser pair correctly enforce ADR 019 §1.1.1 path-rootless URI form, the alias chain stops at `cross-section`, and the rule order matches §1.5. The `pts` corpus is registered at runtime but missing from the static `ENUMERATED_CORPORA` list (works in practice because side-effect registration adds it to the resolver map).

## Issues

### CRITICAL: AIM source-ingest reads `entries[]` but downloader writes `primary/sections/appendices`

- **File**: libs/sources/src/aim/source-ingest.ts:54-71, 102-134
- **Problem**: `readCorpusManifest` requires `parsed.entries` to be an array and `discoverCachedAim` iterates `parsed.entries`. But ADR 021/022 + `scripts/sources/download/manifest.ts:writeAimEntry` write the AIM cache manifest as `AimCorpusManifestFile { schema_version, corpus, primary, sections, appendices }` -- there is NO `entries[]` field on AIM cache manifests. Result: `bun run sources register aim --cache=...` reads the manifest, sees no `entries[]`, throws "missing entries[] array", and skips the entire corpus.
- **Trigger**: Operator runs `bun run sources register aim --cache=$AIRBOSS_HANDBOOK_CACHE` after `sources download --corpus=aim` populates the cache.
- **Fix**: Replace `readCorpusManifest` in `aim/source-ingest.ts` with a reader that consumes `AimCorpusManifestFile` shape (`primary` + optional `sections`/`appendices`). `discoverCachedAim` should derive a single `CachedAim` record from `manifest.primary`. Use `readAimCorpusManifestFile` from `scripts/sources/download/manifest.ts` (or move that schema into `@ab/sources` and share it). Walk `primary` to the cached PDF rather than expecting an `entries[]` enumeration.

### CRITICAL: AC live URL builder produces wrong URL for dot-style doc numbers

- **File**: libs/sources/src/ac/url.ts:36-38; cross-ref libs/sources/src/ac/ingest.ts:104-146
- **Problem**: `getAcLiveUrl` does `${FAA_AC_BASE}${docFilename}${revUpper}.pdf` where `docFilename` is the `parsed.ac.docNumber` as stored in the registry. For AC 91-21-1D the ingest code in `resolveDocAndRevision` builds `docNumber = "91-21.1"` (i.e. dash between 91 and 21, dot before the trailing 1). The FAA URL convention for this AC is the opposite: dot between 91 and 21, dash before the trailing 1 (`AC_91.21-1D.pdf`, confirmed in `scripts/sources/config/ac.yaml:62`). The composer outputs `AC_91-21.1D.pdf`, which 404s. This affects every AC whose number has both a dash and a trailing dotted segment (`91-21.1`, etc.).
- **Trigger**: Render any link to `airboss-ref:ac/91-21.1/d?at=...` in any surface that uses `getLiveUrl`; the user clicks and gets a 404 from FAA.
- **Fix**: Either (a) store the FAA-form filename next to the parsed locator (e.g., on `Edition.source_url` from the cache manifest, which is correct -- prefer that over recomposing); or (b) if the URL must be composed from the locator, swap dot/dash positions: `docFilename = docNumber.replace(/^(\d+)-(\d+)\.(\d+)$/, '$1.$2-$3')` so `91-21.1` -> `91.21-1`. Add a unit test covering 91-21.1D plus the simple cases (61-65J, 60-22).

### MAJOR: AIM downloader writes `edition: null` for whole-doc but source-ingest types `edition: string`

- **File**: scripts/sources/download/plans.ts:373-385 (whole_doc plan, sets `edition: null`); libs/sources/src/aim/source-ingest.ts:43-52, 73-89, 119-131
- **Problem**: AIM whole-doc, aim-section, and aim-appendix plans are all built with `edition: null` in `buildAimPlans`. The corpus-wide manifest's `primary` therefore carries `edition: null`. When `aim/source-ingest.ts:validateEntry` runs, the check `if (entry[key] === undefined)` does NOT catch `null`, so `edition: null` is cast through to `DownloaderManifest.edition` which is typed as `string`. Downstream `dm.edition` is then used as a string in `discoverCachedAim`'s skipped-message (`${dm.edition}: PDF not found...`) and (after the chunk-1 fix) would be passed to `runAimIngest` as the edition slug. The AIM edition is supposed to be `'2026-04'` style; `null` is not a valid edition and breaks the per-edition derivative tree path.
- **Trigger**: Even after fixing the manifest-shape mismatch above, the resulting `cached.edition` will be `null` and the derivative tree will land at `<derivativeRoot>/null/...`.
- **Fix**: AIM downloader plans must carry the real edition. Either resolve it from the URL pattern (`section_url_pattern` does not currently encode the edition) or thread it through via a top-level `aim.yaml#edition` field. Then in `plans.ts` set `edition: aim.edition` on every AIM plan. Update `validateEntry` in `aim/source-ingest.ts` to reject `null` editions explicitly (`if (entry.edition === null || entry.edition === undefined) ...`).

### MAJOR: regs cache + derivative writes are not atomic (ADR 021 violation)

- **File**: libs/sources/src/regs/cache.ts:112-113 and libs/sources/src/regs/derivative-writer.ts:187-194
- **Problem**: ADR 021 §"Atomicity" mandates tmp+rename for cache writes ("read existing manifest, merge the entry, write to `<path>.tmp`, `rename` over the destination"). `loadEcfrXml` writes the fetched XML directly with `writeFileSync(cachePath, xml, 'utf-8')`. `writeIfChanged` in the derivative writer writes section markdown / `manifest.json` / `sections.json` directly with `writeFileSync(path, content, 'utf-8')`. A SIGINT or process kill mid-write leaves a half-written file at the destination; the next run can't tell the file is partial (size != manifest.size_bytes only catches it for the cache, and only if a manifest existed beforehand).
- **Trigger**: `bun run sources register cfr --edition=2026-...` SIGINT'd mid-write to the eCFR cache or to `regulations/cfr-14/2026-01-01/sections.json`.
- **Fix**: Add a shared `writeAtomic(path, content)` helper that writes `${path}.tmp` then `renameSync` (matches `scripts/sources/download/manifest.ts:writeAtomic`). Use it in both `cache.ts:loadEcfrXml` and `derivative-writer.ts:writeIfChanged`. Same pattern applies to `libs/aviation/src/sources/download.ts` (already does it correctly via `.part`+rename) -- mirror that.

### MAJOR: source PDF/HTML downloads are not atomic (no .part+rename)

- **File**: scripts/sources/download/http.ts:115-128 and scripts/sources/download/html-fetch.ts:81-94
- **Problem**: `downloadOnce` (PDF) and `downloadHtmlOnce` (HTML) both write the fetched body directly to `destPath` via `createWriteStream(destPath)` + streamed pipe. If the download is aborted (timeout, SIGINT, network error mid-stream), the destination file already contains partial bytes, but the manifest is updated only on success in `executePlan`. The next freshness check sees `cachedSize` but the manifest (from the previous successful run, or absent) won't match, leading to a re-download -- correct fall-through, but the partial file is observable to other tools and the cache is in an inconsistent state. ADR 021's atomicity rule applies to the full cache, not just manifest writes. Compare with `libs/aviation/src/sources/download.ts:115-162` which correctly writes to `${destPath}.part` then renames.
- **Trigger**: User Ctrl-Cs `bun run sources download` mid-handbook-PDF; the partial PDF stays at the destination path, defeating any external tool that uses the cache directly.
- **Fix**: Stream to `${destPath}.part` then `renameSync(partPath, destPath)` after pipeline completes successfully. On error, `unlink` the `.part` before re-throwing. Mirror the working pattern from `libs/aviation/src/sources/download.ts:downloadFile`.

### MAJOR: Python `urllib.request.urlopen` accepts non-HTTPS schemes; no scheme validation before fetch

- **File**: tools/handbook-ingest/ingest/fetch.py:62-63 and tools/handbook-ingest/ingest/apply_errata.py:272-278
- **Problem**: Both Python fetchers build `urllib.request.Request(config.source_url, ...)` and pass it to `urllib.request.urlopen` without any scheme validation. The TS YAML loader rejects non-HTTPS URLs (`HandbookConfigSchema` uses Zod's `z.string().url()`, which permits `http`, `file`, etc.; `_load_whole_doc` and `_load_chapter_pdfs` in Python require `https://`). But the Python `apply_errata` parser reads the `errata` block directly from raw YAML and doesn't enforce HTTPS on errata URLs (config_loader's `_load_errata_list` does validate but I haven't confirmed every branch). If a malicious or misconfigured YAML supplies `file:///etc/passwd` as `source_url`, the Python fetcher will read it. urllib's `urlopen` is the source of Bandit's `B310` warning for exactly this reason.
- **Trigger**: Operator pulls a malicious / mistakenly-modified YAML config, runs `bun run sources extract handbooks`, and Python fetches a local file or HTTP-only URL.
- **Fix**: Add an explicit scheme check in `fetch.py` and `apply_errata.py` before each `urlopen` call: `if not url.startswith("https://"): raise ValueError(f"refusing to fetch non-HTTPS URL: {url}")`. Same hardening as `config_loader._load_whole_doc` already does at parse time -- this is the runtime backstop.

### MAJOR: Python `fetch.py` and `apply_errata.py` write directly to target without tmp+rename

- **File**: tools/handbook-ingest/ingest/fetch.py:62-69 and tools/handbook-ingest/ingest/apply_errata.py:272-279
- **Problem**: Both Python fetchers stream into `target.open("wb")` directly. Crash/SIGINT mid-download leaves a partial PDF at the canonical cache path. The `_sha256_of` runs after the with-block closes, but if the process dies before the SHA computes, the partial file persists with no audit trail. ADR 021 atomicity applies here too.
- **Trigger**: User Ctrl-Cs `bun run sources extract handbooks phak --refetch` mid-download; partial 8083-25C.pdf is left at the cache path; next run sees `is_file()` true and re-uses it without re-validating size.
- **Fix**: Write to `target.with_suffix(".pdf.part")` (or `target.parent / f"{target.name}.part"`), then `partial.rename(target)` after the SHA is computed and validated. On exception, `partial.unlink(missing_ok=True)` to clean up.

### MINOR: Handbook manifest writer drops appendix_id information

- **File**: scripts/sources/download/manifest.ts:318-324
- **Problem**: In `writeHandbookEntry`, the appendix-handling branch sets `appendixId = kind === 'appendix' ? null : null` -- both arms produce `null`. The comment says `// future: parse from URL` but that means today, when a handbook has multiple appendices (each a separate `ancillary-pdf` plan with `kind: 'appendix'`), they all collide on the same identity key (`ancillary_kind === 'appendix' && appendix_id === null`), and the writer's filter (`a.ancillary_kind === kind && a.appendix_id === appendixId`) replaces the previous appendix entry on every write. Net effect: only the last-written appendix survives in the manifest.
- **Trigger**: Any Class A2 handbook with two or more separately-distributed appendices (the schema allows it via `ancillary[].appendix_id`; current configs ship at most one per handbook so this is latent).
- **Fix**: Take `appendix_id` from `plan` (extend `DownloadPlan` with an optional `appendixId: string | null` for ancillary plans). Build it in `buildAncillaryPlan` from `ancillary.appendix_id`. Then the de-dupe filter does the right thing.

### MINOR: ENUMERATED_CORPORA constant omits `pts` (works only via runtime registration)

- **File**: libs/sources/src/registry/corpus-resolver.ts:57-75 and libs/sources/src/pts/index.ts:15
- **Problem**: `ENUMERATED_CORPORA` lists 17 corpora; `pts` is missing. The validator's row-1 corpus-enumeration check uses `isEnumeratedCorpus`, which reads from the runtime `RESOLVERS` map. `pts/index.ts` calls `registerCorpusResolver(PTS_RESOLVER)` at module load via the side-effect import in `libs/sources/src/index.ts:21`, which adds `pts` to the map. So at runtime `isEnumeratedCorpus('pts')` returns `true`. But: (a) any test or consumer that imports `ENUMERATED_CORPORA` directly (via `@ab/sources/registry`) and iterates it will miss `pts`; (b) the `__corpus_resolver_internal__.wipeToNoOpDefaults` test helper only reseeds from `ENUMERATED_CORPORA`, so after a `wipeToNoOpDefaults` call the `pts` corpus disappears from the validator until something re-registers it. Both are fragile.
- **Trigger**: A test file calls `__corpus_resolver_internal__.wipeToNoOpDefaults()` to test the no-op default resolver, then validates an `airboss-ref:pts/...` identifier. Validator emits row-1 ERROR ("corpus 'pts' is not enumerated") that wouldn't fire in production.
- **Fix**: Add `'pts'` to `ENUMERATED_CORPORA`. Document the contract: every registered resolver corpus must be in this list.

### MINOR: `defaultCacheRoot` helpers don't expand `~` from env

- **File**: libs/sources/src/handbooks-extras/ingest.ts:397-399; libs/sources/src/ac/ingest.ts:445-447; libs/sources/src/acs/ingest.ts:935-937; libs/sources/src/aim/source-ingest.ts:39-41
- **Problem**: Each of these `defaultCacheRoot()` helpers does `process.env.AIRBOSS_HANDBOOK_CACHE ?? join(homedir(), 'Documents', 'airboss-handbook-cache')`. If the user sets `AIRBOSS_HANDBOOK_CACHE=~/my-cache` (literal `~/` prefix; common in shell config), the env value is used verbatim -- the resulting path is `~/my-cache/...`, which isn't a valid filesystem path on Node. The proper helper at `scripts/lib/cache.ts:expandHome` and `libs/sources/src/regs/cache.ts:expandHome` already handle this. The four ingest helpers re-implement the env-or-default pattern without expansion.
- **Trigger**: `AIRBOSS_HANDBOOK_CACHE=~/cache bun run sources register handbooks-extras` -> `mkdirSync('~/cache/handbooks/...')` creates a literal `~/` directory.
- **Fix**: Replace each `defaultCacheRoot()` with `import { resolveCacheRoot } from 'scripts/lib/cache'` (move the helper into `@ab/sources` if the dependency direction is wrong) so all surfaces share the same env handling.

### MINOR: Bare `last_amended_date` in CFR walker accepts loose human dates

- **File**: libs/sources/src/regs/xml-walker.ts:229-254 (`extractAmendedDate`)
- **Problem**: After matching `HUMAN_DATE_PATTERN` against CITA text, the parser passes the captured text directly to `new Date(lastHuman)`. ECMA-262's `Date` constructor is locale-permissive and silently accepts edge cases like `Sept. 5, 2024` (the regex captures `Sept` because of the `Sept?(?:ember)?` branch). On older Node runtimes `new Date('Sept. 5, 2024')` returns NaN; on V8 currently it returns Sep 5. The subsequent `Number.isNaN` check covers the NaN path, but a partial-match like `Aug 3` (no year) followed by other text could produce surprising fallbacks. The match anchors on year, so this is partial defensive.
- **Trigger**: A CITA block whose text has an ambiguous date format. CFR XML is regular enough that this is unlikely in practice.
- **Fix**: Tighten the parsed string before constructing `Date`. Use `Date.parse(`${month}-${day}-${year}`)` with explicit components extracted from the regex match, or build an ISO string from the named-group capture and parse that.

### MINOR: HEAD probe of "next section beyond configured" can produce false-positives in verify-urls

- **File**: scripts/sources/verify-urls.ts:147-180 (`verifyAimSectionCount`)
- **Problem**: The probe builds a URL from `expectedCount + 1` and reports a section-count drift if HEAD returns 200. For some CDN configurations a non-existent path can produce a 200 with an HTML "not found" page. The downloader's `html-fetch.ts` validates Content-Type to catch this, but `verifyAimSectionCount` only checks `head.status` -- a Content-Type/body sniff would be more robust. Also: the probe runs HEAD, not GET, so even if the publisher serves the 404 page with status 200, the body isn't read here. This is a verification gap, not a correctness regression in the live download path (which does validate Content-Type).
- **Trigger**: Publisher misconfigured CDN returns 200 for unknown section paths. Today's FAA endpoints don't behave this way.
- **Fix**: Either compare against `head.contentLength` (an actual section is multi-KB, an error page is small) or do a GET and validate Content-Type matches `text/html` AND body length > some threshold. Or accept the limitation and document it.

### MINOR: Reverse-index `walkMarkdownFiles` uses `break` on undefined pop instead of `continue`

- **File**: libs/sources/src/registry/query.ts:291-317
- **Problem**: Inside the `while (stack.length > 0)` loop, `if (current === undefined) break;` exits the loop on the first undefined pop, which only happens when `stack` is empty -- so functionally equivalent to a normal loop end. But if a future refactor introduces undefined items into the stack (e.g. via filter), this would silently abort traversal. This pattern repeats in `libs/sources/src/check.ts:186-206` (`break` after pop); same diagnosis.
- **Trigger**: Future refactor that pushes optional values onto the stack (e.g. async path resolution).
- **Fix**: Change to `if (current === undefined) continue;` for forward-compatibility. Or assert `if (current === undefined) break;` is the intended terminal.

### MINOR: `runSnapshotCli` calls `generateSnapshot()` twice (write + count)

- **File**: libs/sources/src/snapshot.ts:114-128
- **Problem**: `runSnapshotCli` calls `writeSnapshotSync(out, cwd)` (which calls `generateSnapshot()` internally) and then immediately calls `generateSnapshot()` again to count entries for the summary line. Two snapshot generations per CLI invocation. If the registry is mutated between the two calls (concurrent ingestion writing to the in-process maps), the count and the file disagree.
- **Trigger**: Future concurrent-ingestion + snapshot scenarios. Today, both calls happen synchronously in one tick, so the registry can't change.
- **Fix**: Have `writeSnapshotSync` return the snapshot it wrote (or the count), and use that for the summary line.

### NIT: `discover-errata` per-handbook log shows running total of new candidates

- **File**: scripts/sources/discover/run.ts:158-172
- **Problem**: The `+${newCandidatesCount} new` interpolation in the per-handbook log line uses the running counter that's incremented inside the inner loop. So for handbook 5 it prints "+8 new" even if only one of those 8 is from this handbook. Not a correctness bug (the data on disk is correct), but a misleading log.
- **Trigger**: Run `bun run sources discover-errata`; per-handbook log is misleading.
- **Fix**: Track per-handbook counts: `const before = newCandidatesCount; ... ; const delta = newCandidatesCount - before;` and print `+${delta} new`.

### NIT: PDF_HREF_REGEX in discover/scrape only matches double-quoted hrefs

- **File**: scripts/sources/discover/scrape.ts:47
- **Problem**: `/href\s*=\s*"([^"]+\.pdf[^"]*)"/gi` only matches `href="..."`. The downloader's two-hop scraper (`scripts/sources/download/scrape.ts:96`) handles both single and double quotes via `(?:"([^"]+)"|'([^']+)')`. If the FAA ever switches to single-quoted hrefs in handbook parent pages, discovery silently misses every link.
- **Trigger**: FAA switches from `<a href="…">` to `<a href='…'>`.
- **Fix**: Mirror the download-scraper regex: handle both quote styles.

### NIT: Inventory uses passthrough YAML field `hb.title` without validation

- **File**: scripts/sources/inventory.ts:152
- **Problem**: `lines.push(`### ${hb.title} (${slug.toUpperCase()})`)` reads `hb.title` as a string, but `HandbookConfigSchema` (in `scripts/sources/config/schemas.ts`) doesn't declare `title` -- it's only present on each handbook YAML via `.passthrough()`. TypeScript types this as `unknown`; the code happens to work because `String(undefined)` would render `undefined` in the heading, not error. If a handbook YAML omits `title`, the heading silently becomes `### undefined (PHAK)`.
- **Trigger**: A new handbook YAML omits the top-level `title:` field.
- **Fix**: Add `title: z.string()` to `HandbookConfigSchema` (it's required by the existing handbook YAMLs and by the Python config_loader). The schema gains a real type for the field; `hb.title` becomes `string` instead of falling out of `.passthrough()`.

### NIT: Inventory Title 49 row-matching uses fragile `.includes` heuristic

- **File**: scripts/sources/inventory.ts:275-278
- **Problem**: `manifest?.entries.find((e) => e.doc.includes(...))` tries to match a per-Part description string (`'parts 830, 1552'`) to a per-doc-id manifest entry (`cfr-49-parts-830`) by partial inclusion. The matcher takes the first comma-separated part value and checks if `e.doc` contains `parts-830`. It works for the current `regs.yaml` but is brittle: if the YAML lists parts in different order or if the downloader naming changes, the inventory misreports cached entries as "(eCFR API)".
- **Trigger**: `regs.yaml` reordered or doc naming convention changed.
- **Fix**: Build the expected doc ids deterministically from the YAML config (mirror `buildRegsPlan`'s `cfr-${title}-${partSlug}` shape), and look up by that exact key.

---

issues_found: 18
critical: 2
major: 5
minor: 6
nit: 5
---
