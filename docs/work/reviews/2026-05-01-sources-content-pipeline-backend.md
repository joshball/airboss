---
feature: sources-content-pipeline
category: backend
date: 2026-05-01
branch: main
issues_found: 18
critical: 3
major: 7
minor: 6
nit: 2
---

## Summary

The pipeline is well-factored: clear CLI dispatcher (`scripts/sources.ts`), separated download/freshness/manifest concerns, atomic per-file `tmp+rename` writes, and an explicit lifecycle state machine for ADR 019 §2.4. No DB or `any` leaks, no raw SQL anywhere. Several real backend gaps remain, however: (1) the registry is module-global and in-memory, mutated mid-flow before the lifecycle batch is recorded, so a failed `recordPromotion` leaves SOURCES/EDITIONS half-populated relative to lifecycle; (2) the JSON snapshot CLI never hydrates, so it ships empty unless the operator manually wires ingestion before generation; (3) several CLIs return exit 0 with non-empty `skipReasons` (silent partial failure), which violates the brief's "must exit non-zero" requirement; (4) there is no SHA verification on register against the cached file's downloader-recorded checksum (cache-poisoning silently advances state). HTTP hardening, body size caps, and concurrency locking are also absent.

## Issues

### CRITICAL: Register CLIs return 0 on partial extraction failures (silent advance)

- **File**: `libs/sources/src/ac/ingest.ts:493`, `libs/sources/src/acs/ingest.ts:996`, `libs/sources/src/aim/source-ingest.ts:415`
- **Problem**: All three CLI entry points unconditionally `return 0` even when `report.skipReasons` is non-empty. AC explicitly pushes "extraction failed" reasons (`ac/ingest.ts:384`); ACS pushes "parsed 0 task blocks" + "extraction failed" (`acs/ingest.ts:682, 862`); AIM source-ingest collects per-edition exceptions into `skipReasons` and never propagates them. CI / orchestrators see exit 0, treat the run as healthy, and downstream consumers see registries that are not what the operator asked for. The brief's "process must exit non-zero and not silently advance state" is violated for the three corpora most likely to skip (ACS especially, since it has narrow slug filters).
- **Fix**: Compute a non-zero exit when `skipReasons.length > 0` differentiated by category: hard errors (extraction failed, parsed 0, malformed) -> exit 1; informational skips (slug not in filter, no slug filter match) -> exit 0 but logged. Mirror `references/extract.ts:316` (`if (result.errors.length > 0) process.exit(1)`).

### CRITICAL: No SHA verification on register against the cached file's downloader-recorded checksum

- **File**: `libs/sources/src/handbooks/ingest.ts:166-255` (and AC, ACS, AIM source-ingest equivalents)
- **Problem**: The handbook/AIM/AC/ACS register paths read `manifest.fetched_at` and `source_checksum` from the derivative manifest but never compare them to the downloader's per-edition manifest (`<cache>/handbooks/<slug>/<edition>/manifest.json`'s `primary.source_sha256`) or recompute the cached PDF's SHA. A cache-poisoning event (operator manually edited a cached PDF, an interrupted re-download, or a `--force-refresh` followed by a crash) is invisible to register: the registry happily promotes entries derived from poisoned bytes. The brief's "when register sees a SHA mismatch (cache poisoned), the process must exit non-zero" is unenforced.
- **Fix**: In each per-corpus ingest, read the downloader manifest at register-time; compare its `source_sha256` against the derivative manifest's `source_checksum`; on mismatch throw with the two SHAs and the cache path. Optionally re-hash the cached file when both manifests claim the same SHA but `--force-verify` is set.

### CRITICAL: Lifecycle promotion non-atomic with sources/editions table mutations

- **File**: `libs/sources/src/regs/ingest.ts:155-217`, `libs/sources/src/handbooks/ingest.ts:198-244`, `libs/sources/src/aim/ingest.ts:163-209`, `libs/sources/src/bootstrap.ts:160-215`
- **Problem**: Every ingest writes the patched `SOURCES` (via `__sources_internal__.setActiveTable(sourcesPatch)`) and `EDITIONS` (`__editions_internal__.setActiveTable(editionsPatch)`) **before** calling `recordPromotion`. If `recordPromotion` returns `{ ok: false }` (mixed lifecycles, unknown id, invalid transition), the function `throw`s but the SOURCES/EDITIONS overlays are already mutated and remain in-process. ADR 019 §2.4 says batch promotion is atomic; this code is atomic at the lifecycle map level but not at the registry level. The sources/editions tables are now ahead of the lifecycle table, violating the half-promoted-batches-forbidden invariant if any lifecycle bookkeeping reads the registry directly. (In practice the process exits after, so the leak is bounded; but the contract is wrong.)
- **Fix**: Three-pass: (1) build entries; (2) run `recordPromotion` first against a candidate list (or pre-validate transitions inline); (3) only on success commit `__sources_internal__.setActiveTable` + `__editions_internal__.setActiveTable`. Alternative: introduce a transactional `commitIngestBatch({ sources, editions, scopeIds, target, ... })` helper in `registry/index.ts` that validates lifecycle transitions before any mutation, then commits all three tables in one synchronous block.

### MAJOR: Snapshot CLI never hydrates the registry; output is empty

- **File**: `libs/sources/src/snapshot.ts:39-66`, `scripts/airboss-ref.ts:62-64`
- **Problem**: `runSnapshotCli` calls `generateSnapshot()` against an unprimed registry. The static `SOURCES` table ships frozen-empty (`registry/sources.ts:25`); only ingest runs (`runIngest`, `runHandbookIngest`, `runAimIngest`) or `hydrateRegsFromDerivatives` populate it. `runCli` (the validator) explicitly hydrates (`check.ts:81-84`); `runSnapshotCli` does not. The result: `bun scripts/airboss-ref.ts snapshot` produces `{ entries: {} }`. ADR 019 §2.5 says non-TS consumers (Python RAG, Lambda) read this snapshot at deploy time; today they would read an empty file.
- **Fix**: Either (a) hydrate in `runSnapshotCli` (regs at minimum, then handbooks/AIM/AC/ACS once their `hydrate*FromDerivatives` lands), or (b) make `runSnapshotCli` accept `--bootstrap` like the validator and refuse to write when entry count is 0 (so empty snapshots fail loudly). Long term, option (a) gated on per-corpus hydration helpers being implemented across all 6 corpora before the snapshot is callable from a deploy script.

### MAJOR: Python `fetch_pdf` has no timeout, no retry, no body cap, no SHA verification

- **File**: `tools/handbook-ingest/ingest/fetch.py:38-76`
- **Problem**: `urllib.request.urlopen(request)` is unbounded. No `timeout=`, no retry/backoff, no max body size. A FAA endpoint that hangs causes the Python process to hang indefinitely, holding the spawned-by-Bun pipe open. Worse, the function unconditionally writes whatever bytes arrive; if the URL silently rotates to a 500-byte HTML error page that responds 200 OK, we cache it as a "PDF" and the SHA changes silently next run. There is no comparison against an expected SHA from the YAML config.
- **Fix**: Add `urllib.request.urlopen(request, timeout=120)`; bound the read loop by total bytes (return error past `SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES`-equivalent); validate `response.headers['content-type']` is `application/pdf`; if the YAML config knows an expected SHA, compare and abort on mismatch instead of writing bytes. Mirror the TS downloader's hardening.

### MAJOR: TS `downloadFile` loads the entire body into memory (no streaming, no body cap)

- **File**: `libs/aviation/src/sources/download.ts:157-159`
- **Problem**: `const arrayBuffer = await response.arrayBuffer(); const bytes = new Uint8Array(arrayBuffer); await fs.writeFile(partPath, bytes)`. A 500 MiB CFR XML or AIM PDF is fully buffered in memory before disk write. For a desktop dev workflow this is fine but inconsistent with the streaming-with-sha256 path used by `scripts/sources/download/http.ts:117-128` which pipes through `node:stream`. There is also no body-size cap; a publisher that returns a 10 GiB chunked-transfer redirect page (rare but real) blows up the bun process. `SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES = 500 MiB` exists in constants but is never consulted here.
- **Fix**: Stream like `scripts/sources/download/http.ts:downloadOnce` does (Readable.fromWeb -> hash + write pipeline) and abort early when bytes exceed `SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES`. Same fix applies to `tools/handbook-ingest/ingest/fetch.py` (cap the read loop).

### MAJOR: `fetchEcfrTitles` has no timeout, no retry, no User-Agent in error path

- **File**: `scripts/sources/download/ecfr.ts:28-42`
- **Problem**: The titles API call uses raw `fetchImpl(url, { headers })` without `AbortController` or `signal:`. Other GETs in the same module enforce `NETWORK_TIMEOUT_MS` (`http.ts:50`). If `https://www.ecfr.gov/api/versioner/v1/titles.json` hangs, the entire `bun run sources download` hangs forever before any download starts (since `buildPlans` calls `fetchEcfrTitles` for regs). No retry/backoff either, despite the same module documenting "FAA / eCFR endpoints occasionally 5xx" in `http.ts:6`.
- **Fix**: Wrap with `AbortController` + `setTimeout(controller.abort, NETWORK_TIMEOUT_MS)` mirror of `headRequest`. Add the same single-retry policy for transient errors used by `downloadFile`.

### MAJOR: No concurrency lock on per-corpus manifest writes (race window between read+write)

- **File**: `scripts/sources/download/manifest.ts:269-371`, `libs/sources/src/regs/derivative-writer.ts` (similar pattern)
- **Problem**: ADR 021 says "single-threaded per corpus." The code's manifest-write helper is atomic at the file level (`writeAtomic` does tmp+rename) but the read-modify-write sequence (`readCorpusManifest -> filter/append -> writeAtomic`) has a TOCTOU window. Two concurrent `bun run sources download --corpus=ac` processes will produce last-writer-wins where the loser's `writeManifestEntry` clobbers the winner's. The "single runner only" claim is enforced by convention, not by code. The downloader does not even check for a stale lock file. For a developer-local cache this is unlikely to bite; for any future automation (CI cron, scheduled runs) it is a real corruption vector.
- **Fix**: Add an `flock`-style lock at the corpus-manifest path (e.g. `proper-lockfile` package or a manual `<root>/<corpus>/.lock` PID file with stale-detection on startup). At minimum, document the constraint as an explicit `process.env.AIRBOSS_LOCK_BYPASS` check that exits 1 if a sibling PID is already writing. The same applies to `discovery/_pending.md` writes in `scripts/sources/discover/run.ts:186`.

### MAJOR: AC/ACS/AIM register CLIs swallow extraction errors as "skip" reasons

- **File**: `libs/sources/src/ac/ingest.ts:384`, `libs/sources/src/acs/ingest.ts:862`, `libs/sources/src/aim/source-ingest.ts:317-319`
- **Problem**: The pattern `} catch (e) { skipReasons.push(...) }` indiscriminately treats every per-edition exception as a skip. A real extraction-pipeline bug (PDF parser regression, invalid manifest schema, file-system EACCES) is logged as a skip and the CLI exits 0. There is no distinction between "this PDF is intentionally out of scope (slug filter)" and "the parser threw a TypeError." Combined with the previous critical, every developer / CI run that has any error becomes a green run that quietly drops corpora.
- **Fix**: Distinguish error categories in `skipReasons` (or split into `errors[]` + `skipReasons[]`). Errors propagate to non-zero exit; skips do not. Re-throw or push to errors when the catch sees `TypeError`, `SyntaxError`, or any exception that is not a known soft skip (e.g. `ExtractionAbortError` from a known-bad-publication code path).

### MAJOR: `discover-errata` newCandidatesCount log line is wrong (off-by-everyone)

- **File**: `scripts/sources/discover/run.ts:171`
- **Problem**: Inside the per-handbook loop, the log message reads `newCandidatesCount > 0 ? \`+${newCandidatesCount} new\` : ...`. But `newCandidatesCount` is the *cumulative* counter across all handbooks scanned so far, not the per-handbook delta. So the second handbook scanned shows the cumulative count, the third shows an even larger cumulative count, etc. Operators reading the per-handbook log think handbook N produced N candidates when it produced 1.
- **Fix**: Track per-iteration delta (count `priorUrls`-misses inside the inner loop, log that, accumulate into `newCandidatesCount` after the log). Update the test in `scripts/sources/discover/run.test.ts` to lock in the per-handbook-delta semantics.

### MAJOR: `scripts/sources.ts` has no top-level error handler; uncaught rejections produce ugly traces

- **File**: `scripts/sources.ts:302-305`
- **Problem**: The `if (import.meta.main)` block has no try/catch. Per the brief's "proper exit codes, signal handling, no orphaned processes," the dispatcher should normalise unexpected throws to a clean exit-1 with a one-line diagnostic. Today, an unhandled rejection inside `runDownloadSources` (e.g. a bug in `buildPlans` -- not a network error, those are caught) prints a Node.js stack trace and exits with the unhandled-rejection code. This obscures real bugs and mixes diagnostic output with error output.
- **Fix**:

  ```typescript
  if (import.meta.main) {
    try {
      const code = await runSourcesDispatcher(process.argv.slice(2));
      process.exit(code);
    } catch (error) {
      console.error(`fatal: ${error instanceof Error ? error.message : String(error)}`);
      if (process.env.AIRBOSS_DEBUG === '1' && error instanceof Error) console.error(error.stack);
      process.exit(1);
    }
  }
  ```

  Also add `process.on('SIGINT', ...)` to clean up tmp `.part` files when the operator hits Ctrl-C mid-download.

### MINOR: `inventory` "idempotent" claim breaks across days due to date-only timestamp

- **File**: `scripts/sources/inventory.ts:323-327`, banner says "same input bytes = same output bytes" (`inventory.ts:7`)
- **Problem**: `generatedAt = new Date().toISOString().slice(0, 10)`. Same input on Apr 30 and May 1 yields different `Last regenerated:` lines, so the file diffs every day even when nothing changed. The doc claim is false past a 24h boundary. Operators git-diffing INVENTORY.md will see daily noise.
- **Fix**: Either drop the timestamp from the body entirely (the git log already records when the file changed), use mtime of the most-recently-fetched manifest (semantically: "last time real data changed"), or document the daily-rollover honestly.

### MINOR: `extract` (handbooks Python) does not propagate SIGINT to subprocess

- **File**: `scripts/sources/extract/handbooks.ts:24-29`
- **Problem**: `Bun.spawn` is started with inherited stdio but no `signal:` linkage. Hitting Ctrl-C in the parent terminal sends SIGINT only to the Bun process; the Python subprocess continues running until it tries to write to a closed pipe or finishes. The brief's "no orphaned processes" is violated.
- **Fix**: Wire `process.on('SIGINT', () => proc.kill('SIGTERM'))` (and SIGTERM symmetric); on the cancel path, await `proc.exited` before returning so we don't return before the subprocess actually exits.

### MINOR: AC/ACS/AIM source ingest -- per-edition try/catch swallows the original stack

- **File**: `libs/sources/src/aim/source-ingest.ts:317-319`, `libs/sources/src/ac/ingest.ts:384`, `libs/sources/src/acs/ingest.ts:862`
- **Problem**: `catch (e) { skipReasons.push(\`${edition}: ${(e as Error).message}\`) }`. The stack is dropped. When a parser regression sneaks in, the operator sees one-line skip messages with no file/line info and has to re-instrument and re-run to find the cause. The brief's "error propagation: when register sees a SHA mismatch ... process must exit non-zero" assumes errors are diagnosable.
- **Fix**: Log `(e as Error).stack` (or store it on the report's per-edition entry). Even better: classify by error type (validation vs IO vs parser bug) and push to `errors[]` for real bugs.

### MINOR: `loadEcfrXml` cache miss writes the live response without size validation

- **File**: `libs/sources/src/regs/cache.ts:106-113`
- **Problem**: A successful `fetchImpl(url)` -> `response.text()` is unbounded. eCFR titles can be 80 MiB+. `SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES` is not enforced here. An eCFR endpoint that returns a 1 GiB body or a hung connection is not detected; `response.text()` waits for the full body. No `AbortController`/timeout either.
- **Fix**: Add `AbortController` with a configured timeout; cap body size during streaming (use `response.body.getReader()` instead of `text()` and abort past a threshold); on abort, do not write the partial XML to cache.

### MINOR: YAML config cache stores `mtime: Date.now()` but never re-checks the file

- **File**: `scripts/sources/config/loader.ts:60-72`
- **Problem**: The cache key is filename; the value carries `mtime: Date.now()` but no read code consults it. Two effects: (1) within a long-running process, edits to YAML are invisible to the loader (rare in practice but surprising); (2) the `mtime` field is dead weight that suggests freshness gating exists when it doesn't.
- **Fix**: Either drop `mtime` (the cache is process-bounded and short-lived), or actually compare against `fs.statSync(absPath).mtimeMs` on read and invalidate when stale. Pick one and remove the misleading half.

### MINOR: `buildPlans` calls `fetchEcfrTitles` even on `--dry-run` and `--verify`

- **File**: `scripts/sources/download/run.ts:45`, `scripts/sources/download/plans.ts` (regs branch)
- **Problem**: Dry-run is supposed to be "preview, no network" (download `args.ts:114`). `buildPlans` -> `fetchEcfrTitles` triggers a real network call to derive `latest_amended_on` per title, even with `--dry-run`. The user explicitly asks for no network and gets one anyway. Verify mode also incurs the eCFR titles call (rotated separately from the per-doc HEAD audit).
- **Fix**: When `args.dryRun || args.verify`, pass an `editionDate` fallback (or accept `--edition-date=...` as required and refuse to fetch titles). Or surface a `skipEcfrTitlesFetch` flag in `buildPlans` that uses today's date as a heuristic in dry-run mode and prints a notice.

### NIT: Constants duplication / inconsistency between download and aviation modules

- **File**: `libs/constants/src/sources.ts:12-25` (`SOURCE_ACTION_LIMITS.DOWNLOAD_TIMEOUT_MS=120_000`), `scripts/sources/download/constants.ts:13` (`NETWORK_TIMEOUT_MS=120_000`)
- **Problem**: Two modules define the same constant under different names. `MAX_REDIRECTS`, `RETRY_DELAY_MS`, `USER_AGENT` similarly live in `scripts/sources/download/constants.ts` while a parallel `SOURCE_DOWNLOADER_USER_AGENT` lives in `libs/constants/src/sources.ts`. The User-Agent strings are different (`airboss-source-downloader/1.0` vs `Mozilla/5.0 (compatible; airboss-hangar/1.0...)`), so the two paths advertise differently to publishers. CLAUDE.md says "all literal values in `libs/constants/`."
- **Fix**: Move `MAX_REDIRECTS`, `NETWORK_TIMEOUT_MS`, `RETRY_DELAY_MS`, `USER_AGENT` into `libs/constants/src/sources.ts` (rename to a single canonical set). Re-export from `scripts/sources/download/constants.ts` if the import-from-constants creates a longer path. Reconcile the two User-Agent strings.

### NIT: `scripts/sources/download/manifest.ts` `isAncillaryArtifact` accepts an unused unique-key value

- **File**: `scripts/sources/download/manifest.ts:319-323`
- **Problem**: `const appendixId = kind === 'appendix' ? null : null;` -- the ternary returns `null` either way. The comment "future: parse from URL" indicates an unfinished plan. CLAUDE.md says "no `TODO(retire)`, no scheduled-cleanup cron jobs. If it's dead today, drop it today." This isn't a TODO comment but it is functionally dead branching with a future-work comment.
- **Fix**: Drop the ternary, hard-code `appendixId = null`, delete the future comment. If the `appendix_id` parsing is needed, do it now or take it off the data model until it's needed.

## Summary YAML

```yaml
feature: sources-content-pipeline
category: backend
date: 2026-05-01
branch: main
issues_found: 18
critical: 3
major: 7
minor: 6
nit: 2
```
