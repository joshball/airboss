---
feature: sources-content-pipeline
category: perf
date: 2026-05-01
branch: feat/library-substrate-rename
issues_found: 21
critical: 2
major: 8
minor: 8
nit: 3
---

## Summary

The pipeline is correctness-first and shows it: HEAD-cache, atomic manifest writes, idempotent derivative diffing, and `Promise.all` in `batchResolve` are all in good shape. The performance gaps are concentrated in three places. (1) Anything that walks plans, slugs, URLs, or candidates does so serially -- the chapter download path, the verify-urls scan, the discover-errata scrape, and the per-id reference extractor all `for await` in lockstep where independent network/IO is available. ADR 022 explicitly assumes parallel chapter fetch, but `executePlan` is invoked one plan at a time. (2) The registry's "current edition" / "find by short" / "get children" helpers do `Object.keys(getSources())` linear scans on every call, and the regs / handbooks resolvers call them per-id during `batchResolve`, so a page with N citations does N full scans of the entire `SOURCES` table. (3) Several ingest pipelines clone the full `SOURCES` table (`{ ...getActiveTable() }`) and the full editions Map per ingest call before patching one entry at a time -- O(table_size) per ingest with six pipelines doing the same dance. None of these are fatal at today's scale (entries: low thousands; citations per page: low tens), but the scaling is wrong and the convergent root cause -- treating the registry like a frozen blob instead of indexing into it -- is fixable in one pass.

## Issues

### CRITICAL: Per-corpus chapter fetches run serially despite ADR 022's parallel-fetch claim

- **File**: scripts/sources/download/run.ts:88-91; scripts/sources/download/execute.ts:24-76
- **Problem**: `runDownloadSources` iterates `corpusPlans` and `await executePlan(plan, ...)` one plan at a time. For a chapter-aware handbook (PHAK = 1 whole-doc + 12 chapter PDFs + 4 ancillaries = 17 plans, AFH = 1 + 9 + 4 = 14 plans, etc.) every PDF download blocks the next. ADR 022 §"Wall-clock parity" says wall-clock stays comparable to the whole-doc baseline because chapter fetches parallelize -- but the implementation does not. With 75-260 MB chapter PDFs and FAA's TLS round-trip latency, full corpus refresh is single-stream-bound.
- **Impact**: 6 chapter-aware handbooks × ~15 plans each = ~90 sequential GETs where 6-way concurrency (one stream per handbook) would cut wall-clock 6x. AIM is worse: 1 PDF + 72 section HTML + 5 appendix HTML = 78 plans, all sequential. A full `bun run sources download` is dominated by sequential RTT × plan count.
- **Fix**: Wrap the inner `for (const plan of corpusPlans)` in a bounded-concurrency runner (e.g. `pLimit(4)` -- enough parallelism to overlap RTT, low enough to be polite to FAA). Per-corpus single-threading is preserved by keeping the outer corpus loop sequential; only plans within a corpus run in parallel. The manifest read/write is already serialized via tmp+rename, but the in-process write path still races -- introduce a per-corpus mutex (a single `Promise` chain held in a Map keyed on manifest path) before the four manifest readers/writers see concurrent calls. ADR 021's "single-threaded per corpus" stays intact: serialization moves from the orchestration layer to the manifest layer.

### CRITICAL: Two-hop scrape resolves chapters serially (chapter_count round-trips per handbook)

- **File**: scripts/sources/download/scrape.ts:44-75
- **Problem**: `resolveChapterUrls` does one GET for the index page, then for each chapter ordinal `1..chapterCount` does `await fetchText(pageUrl, ...)` to fetch the chapter HTML page and pull the PDF link. PHAK has 12 chapters → 12 sequential page fetches before plan-building completes. `buildPlans` is in the critical path of every `bun run sources download` invocation (no plan caching), so the 12-RTT cost is paid on every invocation -- including no-op idempotent runs that should refetch nothing.
- **Impact**: For each two-hop handbook: 1 + chapter_count sequential GETs. PHAK = 13, AFH = 10, AvWX = 12. ~30 sequential page fetches purely to resolve URLs that don't change between runs. On an idempotent re-run where every chapter is already fresh-cached, these GETs still happen because plan resolution precedes freshness evaluation.
- **Fix**: (a) Parallelize the chapter-page fetches inside `resolveChapterUrls` with `Promise.all` (bounded). (b) Cache the resolved URL list in the per-edition manifest -- ADR 022's `chapter_page_url` field is already stored per chapter; reuse it on next run unless `--force-refresh` or the index page's Last-Modified advanced. The index-page HEAD is one cheap RTT; only re-walk when it changes.

### MAJOR: Registry "linear scan over SOURCES" called per-id at render time

- **File**: libs/sources/src/regs/resolver.ts:55-71; libs/sources/src/handbooks/resolver.ts:131-150
- **Problem**: `REGS_RESOLVER.getCurrentEdition` and `HANDBOOKS_RESOLVER.getCurrentEdition` both do `Object.keys(getSources())` and walk every entry across every corpus, filtering for their corpus, then loop the per-entry editions array to find the lex-max. `batchResolve` calls `getLiveUrl` per-id (line 71 of batch-resolve.ts), and `regs/resolver.getLiveUrl` calls `this.getCurrentEdition()` (line 85). Net: for N regs ids on a page, `getCurrentEdition` runs N times, each scanning all entries (regs typically dominates the table -- thousands of CFR sections in §s + Parts + Subparts).
- **Impact**: 5,000-entry SOURCES × 50 cited regs ids per lesson = 250K iterations + 250K editions-map lookups per page render. Per-iteration work is small (a string comparison), but the work is per-render and grows linearly with both corpus size and citation density. Same pattern duplicated across regs + handbooks resolvers; ACS (libs/sources/src/acs/) and AC (libs/sources/src/ac/) likely repeat it.
- **Fix**: Cache per-corpus current-edition in a module-level `Map<corpus, EditionId | null>` invalidated when the active sources/editions tables change (`__sources_internal__.setActiveTable` is the natural hook -- bump a generation counter; lazy-rebuild the cache on next read). Or: when an entry is added, advance the corpus's high-water-mark in a sidecar map. Either way, `getCurrentEdition` should be O(1) on the steady-state read path.

### MAJOR: `getChildren` and `findEntriesByCanonicalShort` are linear over all corpora

- **File**: libs/sources/src/registry/query.ts:64-78, 125-134
- **Problem**: `getChildren(id)` walks `Object.entries(getSources())` per call, comparing every key in the full table against a prefix. `findEntriesByCanonicalShort(short)` does the same scan with a string-equality test. Both scale with total registry size, not with the result set size. They're documented as "linear scan; the corpus is small enough for v1" but Phase 9 bootstrap already loads thousands of CFR sections into SOURCES on every `bun run check`.
- **Impact**: Library/cited-by/per-Part-children rendering and short-form glossary lookup all run linear scans. For 5K entries × any UI surface that lists Parts and their children (e.g. a Title 14 hub page rendering 91 + 121 + 135 + ...) the cost is K * 5K per page.
- **Fix**: Build a sibling index: `Map<parentId, SourceId[]>` keyed on the slug-prefix-strip-one-segment, populated alongside the existing `__sources_internal__.setActiveTable` path; same generation-counter rebuild pattern as `getCurrentEdition`. For `findEntriesByCanonicalShort`, build `Map<lowercaseShort, SourceEntry[]>`; sub-millisecond lookup at any scale.

### MAJOR: All six ingest pipelines clone the full SOURCES table per call

- **File**: libs/sources/src/regs/ingest.ts:155; libs/sources/src/aim/ingest.ts:165; libs/sources/src/ac/ingest.ts:290; libs/sources/src/acs/ingest.ts:613; libs/sources/src/handbooks/ingest.ts:200; libs/sources/src/handbooks-extras/ingest.ts:241
- **Problem**: Every ingest does `const sourcesPatch = { ...__sources_internal__.getActiveTable() }` followed by mutating one key per entry, then `setActiveTable(sourcesPatch)`. `bootstrap.ts:160` does the same. The clone is O(table_size) per call. With Title 14 ingestion adding ~3K sections, the clone cost grows quadratically: each per-entry patch is conceptually one assign, but the upfront spread copies all already-loaded entries before the loop starts. Fine for a single ingestion. But the pattern is duplicated across 6 ingests (and reuses inside bootstrap), so the convergent fix is shared.
- **Impact**: Per `bun run sources register cfr` of an already-mostly-populated registry: ~3K-entry spread + 3K assigns. Per `bun run check` invocation (which calls `hydrateRegsFromDerivatives`): same. The hash-equal idempotency is preserved, but the clone is wasted work.
- **Fix**: Replace the spread+assign+swap pattern with direct in-place mutation under a "transaction" handle that records an undo log (or accept that ingestion is not atomic at the per-entry level -- batch promotion is the atomicity boundary, not per-entry table swap). Or: keep the swap semantics but use `Object.create(activeTable)` so the patch overlays without a deep copy. Same for editions: `Map`'s constructor accepts an iterable but copies; use a layered map (override-then-base) or avoid cloning when the patch is small.

### MAJOR: `verify-urls` HEADs every URL serially -- minutes of wall-clock for a no-op

- **File**: scripts/sources/verify-urls.ts:182-220
- **Problem**: `runVerifyUrls` collects ~150-200 URLs across all corpora (12 ACs + 5 ACSs + 8 extras + AIM 1+72+5 = 78 + per-handbook chapters/ancillaries, etc.) and `for (const check of checks) await checkUrl(check.url)`. With FAA HEAD round-trip ~500ms, 200 URLs ≈ 100 seconds of pure RTT, all serial. Then `verifyTwoHopHandbooks` does the same per-handbook scrape sequentially, then `verifyAimSectionCount` HEADs one probe URL per AIM chapter sequentially.
- **Impact**: Operator who just wants "are FAA URLs alive after a suspected rotation?" pays ~3 minutes wall-clock for 200 RTTs + scrape-each-handbook. Also: the function is documented as not-in-CI, but is the only signal an operator has between cache rebuilds.
- **Fix**: Use bounded concurrency (e.g. `pLimit(8)`) for the URL list. Each FAA path is independent; the 5xx retry policy is per-request, not per-batch. Shave 90% off wall-clock with no policy change.

### MAJOR: `discover-errata` per-handbook scrape is serial

- **File**: scripts/sources/discover/run.ts:115-184
- **Problem**: `for (const slug of slugs) { await scrapeHandbookPage(entry, ...); }`. One handbook at a time. The scrape is a parent-page GET + per-link classification; pages are independent across handbooks. Discovery-piggyback runs at the end of every successful `sources download`, so this cost lands on the most common operator command.
- **Impact**: 9-11 handbooks × ~1s scrape each = ~10s sequential. With `download` itself sequential (see CRITICAL above), the whole pipeline serializes.
- **Fix**: `Promise.all` over the slug list with a small concurrency cap (4-6); collect per-handbook results into the existing `sections` array; same merge logic. State writes are already per-handbook, so no shared-state contention.

### MAJOR: `extract.ts` (references) extracts ids serially with one pdftotext per id

- **File**: scripts/references/extract.ts:95-159
- **Problem**: `for (const id of candidateIds) { ... await extractor.extract(...) }`. Each PDF-backed extractor likely spawns `pdftotext` (libs/sources/src/pdf/extract.ts) -- and `extractPdf` always also calls `pdfinfo` (line 232 of extract.ts). For N reference ids backed by P distinct PDFs: 2N subprocess spawns, all sequential. With hundreds of references, this is "open the 75 MB PDF, scan it, close it, throw it away, open it again for the next id."
- **Impact**: Reference build for 200 ids = 400 spawns serial, dominated by per-PDF startup + decode (multi-second per spawn for big PDFs). `bun run references build` is the yearly-refresh entry point but is also called ad-hoc per-id; either way, no parallelism and no result caching.
- **Fix**: (a) Group ids by `source.path` before calling extractors so the same PDF is opened once for all of its dependent ids (pass an array of locators to a batch-aware extractor, fall back to per-id where the extractor lacks a batch entry-point). (b) Parallelize the per-source-type loops with `Promise.all`. (c) Cache `pdfinfo` results -- the page count of a PDF doesn't change within a build run, and `extractPdf` invokes `pdfinfo` on every call (line 232) even when the caller only wants a single page range and could pass `pageCount` in.

### MAJOR: AIM source-ingest unconditionally rewrites every section/paragraph/appendix .md

- **File**: libs/sources/src/aim/source-ingest.ts:166, 182, 198, 214, 228, 249
- **Problem**: `writeAimDerivatives` calls `writeFileSync(bodyPath, body, 'utf-8')` for every chapter, section, paragraph, glossary entry, and appendix unconditionally. There is no hash-or-bytes compare. `writeFileSync(manifestPath, ...)` is also unconditional. Compare to `regs/derivative-writer.ts:writeIfChanged` which reads the existing file and skips when bytes match. The header comment in that file explicitly says "Hash-compares each file before writing; skips writes when unchanged. Idempotent." -- that contract is broken for AIM.
- **Impact**: Every `bun run sources register aim --cache=...` rewrites the entire AIM derivative tree (~85 files: 11 chapter index + 72 section index + ~250 paragraphs + ~150 glossary + 5 appendix + manifest). Wall-clock cost: trivial. Real cost: every file's mtime advances every run, breaking incremental-build callers downstream and bloating the git working-tree-dirty signal. The "byte-equal idempotent regen" claim from the test plan is false at the file-system layer; only the manifest's `body_path` + `content_hash` survive the round-trip stable.
- **Fix**: Add a `writeIfChanged(path, contents)` helper (port from regs/derivative-writer.ts:187-195 -- already exists, hoist to a shared util) and route every `writeFileSync` in `source-ingest.ts`, `handbooks-extras/ingest.ts`, and any other ingest through it. Same fix for the `manifest.json` write. After this, re-running with no source changes produces zero file mutations.

### MAJOR: handbooks-extras + AIM ingest unconditionally write `manifest.json` and `document.md`

- **File**: libs/sources/src/handbooks-extras/ingest.ts:281, 300, 363; libs/sources/src/aim/source-ingest.ts:249
- **Problem**: Same anti-pattern as the AIM finding but on the whole-doc body (`document.md` is a multi-MB file derived from a 100+MB PDF). Every run rewrites it. The AIM corpus index (`handbooks-extras-index.json` line 363) is also unconditional.
- **Impact**: A 50 MB document.md rewrite on every run = unnecessary disk I/O and unnecessary mtime drift in the git working tree. The hash is computed on each run anyway (line 276); not using it to gate the write is a one-line miss.
- **Fix**: Use the same `writeIfChanged` helper. The `body_sha256` already computed gates the write naturally.

### MINOR: `extractPdf` calls `pdfinfo` even when caller already has page-count info

- **File**: libs/sources/src/pdf/extract.ts:227-243
- **Problem**: Every `extractPdf` call subprocess-spawns `pdfinfo` to get page count + metadata, then a second time spawns `pdftotext` for the actual text. For batch use cases (`extractPdfPages` in non-contiguous mode at line 268-273) the caller does N round-trips of `extractPdf`, each paying the `pdfinfo` cost N times. The internal availability check (`ensureAvailable`) is already cached; `pdfinfo` results aren't.
- **Impact**: For the non-contiguous-page extraction pattern: 2N subprocess spawns where N+1 would do. AIM `extract.ts` reads pdfinfo + body once (good); the references pipeline + handbooks-extras chain through `extractPdf` per call.
- **Fix**: Cache `readPdfInfo` results keyed on `(source, mtime)` so repeated calls in the same process for the same file skip the spawn. Or: split `extractPdfPages` to take pre-fetched info (it already has `firstPage`/`lastPage` -- only the bounds check needs page count).

### MINOR: regs `writeDerivativeTree` hashes section bodies twice

- **File**: libs/sources/src/regs/derivative-writer.ts:115, 219
- **Problem**: `writeDerivativeTree` computes `sha256(section.bodyMarkdown)` once for the `sectionsByPart` `body_sha256` (line 115) and again inside `buildSectionMeta` for the per-section meta JSON (line 219, called from line 102's `metaContent`). For ~5000 CFR sections with ~5KB bodies each, that's 10K hashes where 5K would do. The normalizer already exposes `bodyHashInput` on `NormalizedSection` (normalizer.ts:27) but it's just an alias for `bodyMarkdown`, not a precomputed hash.
- **Impact**: ~25 MB of repeated hashing per Title 14 ingest. Sub-second; not a hot path. But the duplication is a clear miss given the data is already in scope.
- **Fix**: Pre-compute `sha256(section.bodyMarkdown)` once per section in `normalizeRawSection` and surface it as `bodyHash` on `NormalizedSection`; both write sites read the precomputed value.

### MINOR: Each XML-walker `tagOf` call does `Object.keys` on the node

- **File**: libs/sources/src/regs/xml-walker.ts:97-103
- **Problem**: `tagOf(node)` returns the first non-`:@` key by iterating `Object.keys(node)`. It's called from `childrenOf`, `firstChild`, `childrenWithTag`, `gatherText`, `collectDivByType`, `collectDirectSections`, and `findWalkRoot` -- effectively every traversal step. Each call allocates a new keys array. fast-xml-parser's `preserveOrder=true` shape means each node has exactly one tag key + an optional `:@` attrs key; the call is unavoidable but redundant when the same node is traversed multiple times.
- **Impact**: Title 14 has ~3000 sections + tens of thousands of paragraph nodes; the walker descends each twice (subpart pass + direct-section pass at xml-walker.ts:362-388). `Object.keys` allocations dominate the walker's GC pressure even if they don't dominate wall-clock.
- **Fix**: Cache `tagOf(node)` per traversal by stamping `node[__tag__]` on first read (or use a WeakMap of `node -> tag` for the current parse session). Even simpler: since the shape is deterministic, write a single helper that returns `{ tag, attrs, children }` once per node and pass that down.

### MINOR: regs amended-date extractor builds new RegExp objects per call

- **File**: libs/sources/src/regs/xml-walker.ts:236-243
- **Problem**: `extractAmendedDate(text)` calls `new RegExp(ISO_DATE_PATTERN, 'gu')` and `new RegExp(HUMAN_DATE_PATTERN, 'gu')` on every invocation -- once per section. The base patterns are already module-level RegExp constants with `u` flag (lines 30-32) but lacking `g`; the `extractAmendedDate` helper recompiles them each time to add `g`.
- **Impact**: ~5000 RegExp compiles per Title 14 ingest. Cheap individually, but free to fix.
- **Fix**: Define `ISO_DATE_PATTERN_G` and `HUMAN_DATE_PATTERN_G` as module-level constants with the `gu` flag once. Or: use `Pattern.dotAll`-style cached compilations.

### MINOR: `findWalkRoot` uses `queue.shift()` (O(n) per call)

- **File**: libs/sources/src/regs/xml-walker.ts:441-459
- **Problem**: BFS over the parser's root node array uses `Array.shift()` on a JS array, which is O(n) per shift due to element reindexing. The queue can have hundreds of nodes for a fast-xml-parser preserveOrder result.
- **Impact**: Sub-millisecond on real input but a textbook quadratic pattern. The walker is called once per ingest, so trivial; flagging because it's simple to fix.
- **Fix**: Replace with index-cursor: `let head = 0; while (head < queue.length) { const cur = queue[head++]; ... queue.push(child); }`. Or use a proper deque.

### MINOR: Manifest readers JSON-parse the file each time entries are queried

- **File**: scripts/sources/download/manifest.ts:130-137 (readJsonOrNull) + 233-264 (readManifestEntry)
- **Problem**: `readManifestEntry` is called from `executePlan` per plan during `evaluateFreshness` and again when writing the result. For a chapter-aware handbook it's invoked ~17 times per run, each call doing `readFileSync(path) + JSON.parse`. The same manifest file is parsed 17+ times serially in one corpus pass. Run-wide cache would cut to one parse per manifest.
- **Impact**: Manifests are 5-50 KB; JSON.parse is fast. Per-corpus cost is low. But `runVerify` adds another full pass over plans calling `readManifestEntry` again, so verify-mode doubles the parse count.
- **Fix**: Add a per-process `Map<manifestPath, ParsedManifest>` invalidated on `writeManifestEntry`. The atomic-rename write semantics make invalidation easy: clear the cache key on write, repopulate on next read.

### MINOR: `inventory.ts` re-parses every config + every manifest on each run

- **File**: scripts/sources/inventory.ts:87, 161, 169, 184-185, 200-201, 273
- **Problem**: `runInventory` walks every YAML config (cached in `loader.ts`, fine) but reads every manifest fresh. With 9 handbooks × 1 manifest each + 8 handbooks-extras × 1 each + 1 AIM + 1 AC + 1 ACS + N regs titles, that's ~22 file reads per inventory regen. The byte-equal-idempotent contract holds at the output level, but the per-input parse cost is paid per run.
- **Impact**: Sub-second; not a hot path. Inventory is typically a developer-triggered command. Flagged because the same per-process manifest cache fix from the previous finding covers it.
- **Fix**: Same as above -- shared per-process manifest cache with write-invalidation.

### MINOR: `lesson-parser.ts:locationFromOffset` is O(N × body_length)

- **File**: libs/sources/src/lesson-parser.ts:515-526
- **Problem**: For each identifier occurrence (inline link, reference-style link, bare URL) the parser computes a `SourceLocation` by scanning `body[0..offsetInBody]` character-by-character to count newlines. With N occurrences in a body of length L, total cost is O(N * L). For the common case (a few citations per lesson) this is fine; for citation-dense lessons (e.g. a syllabus or library page that lists 50+ citations) the quadratic explodes.
- **Impact**: The reverse-index builder (`buildReverseIndex` in query.ts:251) parses every lesson under `LESSON_CONTENT_PATHS`. With a 100KB lesson and 100 occurrences, that's 100 * 100K = 10M char comparisons just for source-location bookkeeping. Not catastrophic, but disproportionate to the actual work done.
- **Fix**: Pre-compute a `newlineOffsets: number[]` array via one linear pass over `body` (use `body.matchAll(/\n/g)` or a single index scan). Then `locationFromOffset` becomes a binary search: O(log N) per call, total O(N log N + L).

### MINOR: Reverse-index builder uses `Array.includes` per occurrence

- **File**: libs/sources/src/registry/query.ts:269-272
- **Problem**: For each identifier occurrence in each lesson, `buildReverseIndex` does `if (!list.includes(lessonId))` to dedupe lesson references. With M occurrences across L lessons all citing the same id, the list grows to L entries and `includes` becomes O(L) per occurrence -- O(M * L) total. With 1000 lessons all citing `airboss-ref:regs/cfr-14/91/103`, the dedup costs grow quadratically.
- **Impact**: Today's lesson count is small; later it grows. The lazy reverse-index is rebuilt once per process, so the cost is amortized. But the data structure is wrong: `Set<LessonId>` would dedupe in O(1).
- **Fix**: Build the index as `Map<string, Set<LessonId>>`; convert to `Map<string, LessonId[]>` at the end if downstream consumers need an ordered array. The conversion is a single linear pass.

### MINOR: `walkMarkdownFiles` does redundant `statSync` after `entry.isFile()`

- **File**: libs/sources/src/registry/query.ts:309-310
- **Problem**: After confirming `entry.isFile() && entry.name.endsWith('.md')` from the `Dirent`, the code calls `statSync(full).isFile()` again. Each `statSync` is a syscall.
- **Impact**: Per `bun run check` the validator walks `course/regulations` (currently 200+ markdown files) and the reverse-index walker does the same. ~200 redundant syscalls per process.
- **Fix**: Trust the `Dirent` (`withFileTypes: true`); the second `statSync` is dead code.

### NIT: `runSnapshotCli` calls `generateSnapshot()` twice

- **File**: libs/sources/src/snapshot.ts:121-127
- **Problem**: `writeSnapshotSync(out, cwd)` builds a snapshot then writes it. Immediately after, `runSnapshotCli` calls `generateSnapshot()` again to count entries for the log line. Build is repeated.
- **Impact**: Trivial -- one extra full pass. CLI invocation, not a hot path.
- **Fix**: Have `writeSnapshotSync` return the snapshot it built; or have `runSnapshotCli` call `generateSnapshot()` once and pass it to a (new) `writeSnapshotData(path, data)` helper.

### NIT: Handbook manifest section lookup is linear

- **File**: libs/sources/src/handbooks/derivative-reader.ts:151
- **Problem**: `manifestSectionForLocator` does `manifest.sections.find((s) => s.code === code)` -- linear scan over the manifest's sections array (~hundreds for PHAK). Called once per `getDerivativeContent` (which can be invoked per id during render). The manifest cache holds the parsed structure but doesn't index it.
- **Impact**: With ~300 sections in PHAK and ~50 cited handbook refs on a page, that's 15K comparisons. Fast, but free to index.
- **Fix**: When loading the manifest into the cache, build `byCode: Map<string, ManifestSection>` alongside the array; `manifestSectionForLocator` becomes O(1).

### NIT: Python `_detect_chrome_lines` reads each page text twice

- **File**: tools/handbook-ingest/ingest/sections.py:235-259, 100-110
- **Problem**: `_detect_chrome_lines` does `page.get_text("text")` for up to 600 pages to identify repeated chrome lines. Then `extract_sections` re-loads each page in `node.page_start..page_end` and calls `page.get_text("text")` again on overlapping ranges. PyMuPDF's `get_text` is not free; each call rasterizes/decodes the page's text layer.
- **Impact**: For a 700-page PHAK with 12 chapters: chrome detection touches the first 600 pages once (1 text extraction each), then the per-node loop touches each chapter's pages again (700 more text extractions). Roughly 2x text-extraction work where a single pass with caching would do.
- **Fix**: Cache `page_num -> text` in a dict on the document during the chrome-detection pass; have `extract_sections` consult it before calling `page.get_text` again. PyMuPDF document objects have short lifetimes here (`with fitz.open(...)`) so the cache can live in a local dict.
