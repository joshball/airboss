---
feature: sources-content-pipeline
category: testing
date: 2026-05-01
branch: main
issues_found: 16
critical: 1
major: 6
minor: 6
nit: 3
---

## Summary

The sources/content pipeline has a strong testing core: parser, validator (all 14 rule rows), lifecycle state machine, query API, and lesson-parser are exercised thoroughly with named test IDs that map back to the work-package test plans. The TS downloader exercises plan building, dry-run, verify mode, HEAD-then-skip, AC/AIM/handbooks plan shapes, and User-Agent propagation against fully mocked fetch. The Python ingest tool covers config-loader, AIM HTML extraction, and chapter-PDF mode of `chapter_plaintext`.

Where the suite is weakest is around the surfaces that touch real files and real publishers: manifest atomicity (tmp+rename) has no dedicated test, the freshness-decision module has no co-located tests for ETag matching or last-modified branches, and three large AIM source-side modules (`extract.ts`, `source-ingest.ts`, plus `extract.ts`'s 568-line dispatcher) ship with no tests at all. The Python test suite has one fixture-leak risk where three tests write `bogus*.yaml` directly into the canonical `scripts/sources/config/handbooks/` directory and rely on a `try/finally` that won't survive an interrupted run. There are no skipped, no-op, or commented-out tests, and no orphaned imports referencing the deleted `migrate-cache-flat.ts` migration.

## Issues

### CRITICAL: Python tests write bogus YAML directly into shared canonical config dir

- **File**: `tools/handbook-ingest/tests/test_config_loader_chapters.py:79-86, 104-111, 125-132`
- **Problem**: `test_chapter_pdfs_rejects_mixed_direct_and_index`, `test_chapter_pdfs_rejects_missing_pattern`, and `test_excluded_assets_must_be_list` each call `config_dir() / 'bogus*.yaml'` (resolving to the production `scripts/sources/config/handbooks/` directory shared by both the TS downloader and the Python ingest pipeline) and write a deliberately malformed YAML there, relying on a `try/finally: target.unlink()` to clean up. If the test crashes between write and unlink (Ctrl-C, OOM, segfault, hung asserter), or if pytest is run with `-x --pdb` and the user quits the debugger, those bogus YAMLs survive and start poisoning real downloader runs because `loadHandbookConfig` and the YAML loader walk the whole directory. Parallel pytest runs (`pytest -n auto`) race on the same path. The sibling test file `test_config_loader_dismissed.py:99-105` already demonstrates the right pattern: write the YAML under `tmp_path` and use `monkeypatch.setattr(config_loader_module, 'config_dir', lambda: fixture_dir)`. These three tests should be migrated to that pattern; the current code is a footgun. (Note that the WP test plan at `docs/work-packages/chapter-source-ingestion/test-plan.md:41` says fixtures should live at `tools/handbook-ingest/tests/fixtures/` -- the spec already calls this out, the implementation drifted.)
- **Fix**: Rewrite the three tests to use `tmp_path` plus `monkeypatch.setattr(config_loader_module, 'config_dir', lambda: tmp_path)`, matching the dismissed-errata test file. Drop the `try/finally` cleanup since `tmp_path` self-cleans.

### MAJOR: Manifest atomicity (tmp+rename) is asserted in the docstring but not tested

- **File**: `scripts/sources/download/manifest.ts:14, 141-143, 267` (no `manifest.test.ts` exists)
- **Problem**: The chapter-source-ingestion test plan (`docs/work-packages/chapter-source-ingestion/test-plan.md:78-83`) calls out three required manifest tests: round-trip schema, backward-read of pre-WP manifests with no `chapters[]` field, and concurrent-write detection via temp-file collision. The module ships tmp-file write + rename but there is no `scripts/sources/download/manifest.test.ts`. The only manifest exercise lives inside `scripts/sources/download.test.ts:472-613` ("manifest skip behavior") which writes a manifest to verify HEAD-then-skip behavior but never exercises the atomicity guarantee, the concurrent-collision case, the read-old-manifest-without-chapters case, or what happens when the rename fails partway. ADR 022 explicitly grounds the contract on atomicity. Untested atomicity claims in concurrent code is a footgun.
- **Fix**: Add `scripts/sources/download/manifest.test.ts` covering: (a) write manifest, kill mid-rename, on next read no partial state visible; (b) read a manifest written before the chapter-aware schema landed, expect `chapters` defaults to empty array; (c) two concurrent writes -- one wins, the other detects tmp-file collision and retries (per the test-plan note). At minimum cover (a) and (b) before the next ingestion-touching change.

### MAJOR: Freshness decision module (95 LoC) has no co-located tests; ETag and Last-Modified branches uncovered

- **File**: `scripts/sources/download/freshness.ts` (no `freshness.test.ts` exists)
- **Problem**: `evaluateFreshness` is the heart of the conditional-fetch decision and has 9 ordered branches (no manifest, missing file, size drift, HEAD failed, HEAD non-2xx, ETag match, last-modified-not-advanced, content-length disagreement, content-length match no metadata). The chapter-source-ingestion test plan (`docs/work-packages/chapter-source-ingestion/test-plan.md:73-74`) explicitly calls out "HEAD-cache hit" and "ETag unchanged" as required tests. The only coverage is two cases buried in `scripts/sources/download.test.ts:472-613` (skip when HEAD content-length matches; refetch when it disagrees) -- neither one exercises ETag at all, neither exercises the "HEAD failed → stale" branch, neither exercises the "size drift" pre-HEAD branch. A regression that flips ETag handling silently passes today.
- **Fix**: Add `scripts/sources/download/freshness.test.ts` with one test per decision-tree row in the docstring at lines 5-15. Each test stubs `headRequest` (or `fetchImpl`) directly and asserts the `{fresh, reason}` tuple.

### MAJOR: AIM source-side ingestion has 1300 LoC with zero co-located tests

- **File**: `libs/sources/src/aim/extract.ts` (568 LoC), `libs/sources/src/aim/source-ingest.ts` (416 LoC); only `aim/ingest.ts` (manifest reader, 316 LoC) has a test
- **Problem**: `extractAim()` is the PDF-to-derivative tree builder; `runAimSourceIngest()` is the source-PDF -> derivatives -> registry orchestrator. Both modules ship without a `*.test.ts`. The existing `aim/ingest.test.ts` only covers the downstream "walk an already-written derivative tree" step (the easy half). A regression in the PDF parser, the chapter/section partitioning, or the disk-layout writer -- the load-bearing logic of two thirds of the AIM pipeline -- has no automated guardrail. The contract-v2 test plan (`docs/work-packages/section-extraction-contract-v2/test-plan.md`) doesn't claim to cover this either; it's chapter-PDF-mode for handbooks. The chapter-source-ingestion plan does call for AIM HTML extraction tests (line 26) which exist on the Python side, but doesn't speak to the TypeScript `extractAim`.
- **Fix**: At minimum, add `aim/extract.test.ts` covering: (1) parsed paragraph tree shape from a fixture extraction state (mock the PDF reader), (2) the appendix-vs-section dispatch, (3) the empty-PDF / corrupt-PDF error paths. Add `aim/source-ingest.test.ts` covering the cache → derivative → manifest write happy path with mocked `extractAim`.

### MAJOR: AC/ACS ingest pipelines have no ingest tests

- **File**: `libs/sources/src/ac/ingest.ts`, `libs/sources/src/acs/ingest.ts` (only `*/smoke.test.ts` exists, plus locator/url/resolver tests)
- **Problem**: `ingest.ts` for AC and ACS are full ingestion runners. The AIM and handbooks side has `ingest.test.ts` files exercising parseCliArgs, manifest read, lifecycle promotion, idempotence, and missing-manifest errors. AC and ACS do not. The smoke tests only verify validator integration over a fixture-ingested entry; they don't exercise the ingest runner's CLI parsing, idempotence path, or error paths.
- **Fix**: Mirror the structure of `aim/ingest.test.ts` for `ac/ingest.test.ts` and `acs/ingest.test.ts`: parseCliArgs cases, fixture ingest, idempotence, unknown-doc/edition error.

### MAJOR: Two-hop scrape has no test for the "ordinal slug differs" empirical PHAK case

- **File**: `scripts/sources/download/scrape.test.ts:57-72`
- **Problem**: The first test ("resolves 12 PHAK chapters in order") demonstrates that the scraper can handle slug variation across chapters in the index page (lines 67-71 specifically check `chapter-7-aircraft-systems` vs `chapter-1-introduction-flying`), which is good. But the test plan at `docs/work-packages/chapter-source-ingestion/test-plan.md:62` calls out "inconsistent slugs (PHAK pattern)" as a required strict-vs-flexible match decision. The current test happens to pass because the regex `chapter-{N}-` permits any tail. There's no test asserting that a chapter ordinal collision (e.g. index page lists "chapter-1-foo" but the regex prefix `chapter-1-` would also match "chapter-10-foo") is correctly disambiguated. The ch1-vs-ch10 confusion is the canonical bug here -- the test at line 70 (`ch1?.pageUrl` includes `chapter-1-introduction-flying`) is a happy-path proof but not a collision-resistance proof.
- **Fix**: Add a test where the index has both `chapter-1-foo` and `chapter-10-foo` and the request is for `ordinal=1`; assert the result picks `chapter-1-foo` not `chapter-10-foo`. Today the implementation in scrape.ts can be inspected to verify it disambiguates, but the test must lock the behavior.

### MAJOR: `verify-urls.test.ts` has only two assertions and an end-to-end mock; AIM section-count check is asserted only via a happy path

- **File**: `scripts/sources/verify-urls.test.ts:30-44`
- **Problem**: The test plan (`docs/work-packages/chapter-source-ingestion/test-plan.md:88-92`) calls out four required cases: all-200 OK, one-URL-404 with structured error, AIM section-count mismatch (publisher added a section), and network-timeout-tolerated. The actual file has only two `it` blocks: the all-200 OK case and the one-404 case. The AIM section-count check exists in the fake fetch (lines 56-59 -- it mocks `chap{N}_section_{M}.html` to 404 above the configured per-chapter count, so the verifier passes), but there's no test that flips one of those numbers up by one and asserts the verifier fails with the right field path. Network-timeout tolerance is untested. The verifier is the meta-tool that catches FAA URL rotation; if its own coverage is thin it can fail open.
- **Fix**: Add (1) "AIM section-count mismatch surfaces chapter + YAML field path"; (2) "fetch throws / aborts for one URL → reported as transient, exit 0" (or non-zero, whichever the spec says).

### MINOR: `aim/ingest.test.ts` claims six entries but doesn't pin entry order

- **File**: `libs/sources/src/aim/ingest.test.ts:46`
- **Problem**: `expect(report.entriesIngested).toBe(6)` paired with the comment "1 chapter + 1 section + 2 paragraphs + 1 glossary + 1 appendix" only checks the count, not the shape. A regression that ingests 6 entries of the wrong kind (e.g. 6 chapters, 0 paragraphs) passes. Compare with the bootstrap test (`bootstrap.test.ts:79-95`) which checks both Part-level and Section-level entries by id.
- **Fix**: Add per-id `getEntryLifecycle` checks for each of the 6 ids, or assert against the registry sources object at known shape after ingest. (The test partially does this in the next `it` block "promotes entries to accepted lifecycle" -- collapse them into one stronger assertion or keep them as a deliberate check.)

### MINOR: `query.test.ts` Q-12 only tests the empty-input degenerate case; intersection logic uncovered

- **File**: `libs/sources/src/registry/query.test.ts:244-250`
- **Problem**: The test plan ID Q-12 (`reference-source-registry-core/test-plan.md:67`) says: "`findLessonsCitingMultiple([id1, id2])` -- Set intersection." The actual test only asserts `findLessonsCitingMultiple([])` returns `[]` and excuses itself with a comment that the live reverse index has no `airboss-ref:` URLs to test against. That comment is no longer accurate post-Phase 9 (the bootstrap loads regs entries) but more importantly, the file already shows a working pattern for priming a tmp lesson tree (`buildReverseIndex(tmpRoot)` on lines 222-241 of the same file) -- the intersection case is reachable. Today a regression that returns the union instead of the intersection passes.
- **Fix**: Use the same `tmpRoot` + `buildReverseIndex` setup to write two lesson files: lesson-A cites both id1 and id2, lesson-B cites only id1. Assert `findLessonsCitingMultiple([id1, id2])` returns only lesson-A.

### MINOR: `pohs/seed.test.ts` "uses the bundled manifest by default" pollutes the productionRegistry across tests

- **File**: `libs/sources/src/pohs/seed.test.ts:101-107`
- **Problem**: Last test calls `seedPohsFromManifest()` (no args), which reads the actual `course/`-bundled manifest and registers every entry into the shared productionRegistry. The test does call `resetRegistry()` in afterEach, so cross-test bleed inside the file is contained, but if other test files in the same `bun test` invocation run before `afterEach` (e.g. parallel workers, or in a shared process where module caches keep the production resolver registered), this can affect the assertion `productionRegistry.isCorpusKnown('pohs')` from `registry.test.ts:39`. A defensive read of test order today shows it works, but the bundled-manifest test should isolate its registry the same way the manifestPath-based tests do (point at a tmp path with a fixture YAML that mirrors the bundled shape).
- **Fix**: Drop the bundled-manifest test or replace it with a tmp manifest fixture; rely on the explicit-manifest tests for coverage. If keeping the integration test, mark it clearly and put it in a separate file with its own resetRegistry guard.

### MINOR: `download.test.ts` "User-Agent header" patches `globalThis.fetch` without a `try/finally` around all assertions

- **File**: `scripts/sources/download.test.ts:312-345`
- **Problem**: Two patches happen: `_setCachedTitlesForTest(null)` at line 314 and `globalThis.fetch = fakeFetch` inside try/finally at lines 336-341. The `_setCachedTitlesForTest(null)` call is OUTSIDE the try/finally; if the inner expectations throw, the cached-titles state stays null and a sibling test running in the same Bun process picks it up. The afterEach at line 53 does call `_setCachedTitlesForTest(null)` so this is contained, but ordering in the assertions is fragile -- `expect(plans.length).toBe(3)` is inside the try; if it fails, the finally restores fetch but the cached-titles override is already null which is fine *but only because afterEach handles it*. This is "right by coincidence" rather than "right by construction."
- **Fix**: Move both side-effect assignments into a single try/finally, or use vi.spyOn for both. (This is style/safety; not currently observable as a failure.)

### MINOR: Many tests assert `expect(x).toBeDefined()` where the real intent is "matches a known-shape value"

- **File**: Examples at `validator.test.ts:266, 285, 335, 355, 405, 444, 475, 586`; `lesson-parser.test.ts:57, 230, 251`; `snapshot.test.ts:59`; `handbooks/ingest.test.ts:69`; `regs/ingest.test.ts:40-43, 156-159`
- **Problem**: `expect(findings.find((f) => f.ruleId === 5)).toBeDefined()` passes if any finding with that rule fires, but doesn't pin the message string, the location, or even the count (a regression that fires the rule twice or with a wrong location passes). Most of these are paired with a primary expectation that does the real work, which is fine -- but several are the only assertion. For row 5, row 6, row 8, row 11, row 13, row 14, the test asserts existence-only; a regression that emits the right ruleId but with the wrong severity, message, or count silently passes. This is a class of weak assertion the testing skill explicitly calls out.
- **Fix**: Tighten existence-only assertions to either exact-match the count and message substring (already done for V-01 row-1 path-absolute) or use `expect(findings).toContainEqual(expect.objectContaining({ruleId: 5, severity: 'warning'}))`. Lowest-effort fix: add `.severity` to every `find()` predicate (already done for some, missing for others).

### MINOR: `pohs/seed.test.ts` and siblings (ntsb, tcds, forms, asrs, interp, statutes, info, safo, plates) write production manifest YAMLs as raw strings without using a YAML helper

- **File**: 9 `*/seed.test.ts` files in `libs/sources/src/<corpus>/`
- **Problem**: Each fixture is hand-written YAML inside a template literal. A whitespace edit in any of these test files can flip a parse silently from valid to invalid. Cross-corpus drift in the schema is harder to spot when each test ships its own YAML literal. Compare to the Python suite which uses `yaml.safe_dump` (`test_config_loader_dismissed.py:21`) -- a regression in dataclass shape automatically propagates.
- **Fix**: Either factor a `writeFixture(corpus, entries)` helper that emits canonical YAML, or build the manifest as JS object + `yaml.stringify()`. Lower priority because the tests work today; structural drift will eventually hit one of them.

### NIT: `scripts/sources/extract.ts` and `scripts/sources/extract/handbooks.ts` are dispatcher modules with no test

- **File**: `scripts/sources/extract.ts`, `scripts/sources/extract/handbooks.ts`
- **Problem**: Both are thin dispatcher modules but they encode CLI argument forwarding to the Python pipeline. The `register.test.ts` precedent shows how to test a similar dispatcher (stub the per-pipeline runner, assert routing). The extract dispatcher today has no equivalent.
- **Fix**: One small `extract.test.ts` that asserts `--help` prints, that an unknown sub-pipeline fails non-zero, that argv is forwarded to the Python runner spec.

### NIT: Test files use loose `expect(x.length).toBeGreaterThan(0)` where the exact count is in the spec

- **File**: e.g. `pohs/seed.test.ts:103` (`entriesRegistered).toBeGreaterThan(0)`); `aim/smoke.test.ts` patterns
- **Problem**: The bundled POHS manifest has a known authored entry count today; asserting `>0` accepts "I shipped one entry" or "I shipped a thousand entries." The latter would be a regression worth catching.
- **Fix**: Replace with the exact count where the manifest authors a known cardinality. If the count is intentionally unstable (entries get added freely), keep the loose assertion but pair it with a concrete known-id check.

### NIT: `lifecycle.test.ts` LC-11 uses `as any` to test runtime guard

- **File**: `libs/sources/src/registry/lifecycle.test.ts:178-179`
- **Problem**: Test types a non-existent transition target as `any` to exercise the runtime check. CLAUDE.md bans `any`; the file uses a biome-ignore comment to acknowledge this. The intent is right (test the runtime guard, not just the compile-time type), but the comment + lint exemption could be replaced with `'draft' satisfies SourceLifecycle` (won't compile, undermining the test) or a typed cast through `unknown`.
- **Fix**: `targetLifecycle: 'draft' as unknown as SourceLifecycle` or equivalent two-step cast keeps the runtime test honest without an `any` and without the lint exemption.

## What's strong (for context)

- **Parser test (`parser.test.ts`)**: All ADR 019 §1.1.1 URI-form rules covered (P-01 through P-19), including path-rootless ACCEPTED, path-absolute REJECTED, authority-form REJECTED, leading/trailing whitespace trimmed, percent-encoding, and bare-scheme.
- **Validator test (`validator.test.ts`)**: All 14 rule rows tested individually, plus exclusivity/ordering tests (V-EX, V-EX2) and §1.5.1 edge cases (reserved/redacted/future-pin/newly-created/stale-branch).
- **Lifecycle (`lifecycle.test.ts`)**: All 12 LC-* test plan IDs from the WP test-plan map cleanly to test bodies; transitions, atomic-batch failure on a blocked entry, de-promotion, mixed-lifecycle rejection, and unknown-entry rejection all covered.
- **Bootstrap (`bootstrap.test.ts`)**: Idempotence, multi-edition, missing manifest, multi-title (CFR-14 + CFR-49) all covered.
- **Inventory (`inventory.test.ts`)**: Byte-equal regen with same seed verified twice (once at the builder layer, once at the runner layer); 12-char SHA-256 prefix verified; placeholder fallback for empty cache verified.
- **Download (`download.test.ts`)**: AC, ACS, AIM (1+48+5 plans), regs (3 titles), PHAK two-hop (17 chapters with stub resolver), AFH direct-pattern (18+3), AVWX class-C (whole-doc only) all asserted with exact counts and dest-path shapes per ADR 021. User-Agent propagation checked across titles fetch, HEAD, redirect HEAD.
- **Two-hop scrape (`scrape.test.ts`)**: Hard-fail on missing chapter (ADR 022 contract); hard-fail on index missing a chapter ordinal; required `{N}` placeholder.
- **HTML fetch (`html-fetch.test.ts`)**: Content-type validation including charset suffix tolerance; 404 surfacing.
- **Migration cleanup**: No orphaned imports of `migrate-cache-flat.ts`; no test references the deleted module. Clean.
- **No skipped/no-op tests** anywhere in the in-scope suite. No `.skip()`, no `.todo()`, no `xit/xdescribe`, no commented-out tests.

```yaml
issues_found: 16
critical: 1
major: 6
minor: 6
nit: 3
```
