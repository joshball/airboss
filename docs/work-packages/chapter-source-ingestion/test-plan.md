---
title: 'Test plan: Chapter source ingestion'
product: platform
feature: chapter-source-ingestion
type: test-plan
status: unread
review_status: pending
---

# Test plan: Chapter source ingestion

Per project rule, every feature is hand-tested before ship. This plan covers automated tests (unit + integration) and the manual operator pass that gates the merge.

## Test surface inventory

| Layer | Tests | Where |
| --- | --- | --- |
| YAML schemas | Zod validation, count assertions | `scripts/sources/config/__tests__/` |
| YAML loader | Round-trip parse, error cases | `scripts/sources/config/loader.test.ts` |
| Plan builder | YAML in, plans out, all corpora | `scripts/sources/download/plans.test.ts` (extend existing) |
| Two-hop scrape | Mocked HTTP, URL resolution, 404 hard-fail | `scripts/sources/download/scrape.test.ts` |
| HTML fetch | Mocked HTTP, atomic write, content-type validation | `scripts/sources/download/html-fetch.test.ts` |
| Manifest schema | Read/write, schema_version, atomicity | `scripts/sources/download/manifest.test.ts` (extend existing) |
| URL verifier | Mocked HTTP, structured error output | `scripts/sources/verify-urls.test.ts` |
| Inventory generator | Byte-equal regen, sorted output | `scripts/sources/inventory.test.ts` |
| AIM HTML extraction | Fixture HTML in, section tree out | `tools/handbook-ingest/tests/test_aim_html_extract.py` |
| Chapter-PDF plaintext | Chapter PDF in, full-text sidecar out, no truncation | `tools/handbook-ingest/tests/test_chapter_plaintext_chapter_mode.py` |
| Python config loader | New `WholeDoc` + `ChapterPdfs` fields | `tools/handbook-ingest/tests/test_config_loader_chapters.py` |

## Unit tests

### YAML schemas + loader

**Goal:** loaded YAML matches the pre-migration TS arrays exactly. No silent drift.

- [ ] Load `scripts/sources/config/ac.yaml`; assert 12 entries; assert each entry's `url` matches the pre-migration `AC_TARGETS` value.
- [ ] Load `scripts/sources/config/acs.yaml`; assert 5 entries.
- [ ] Load `scripts/sources/config/aim.yaml`; assert `whole_doc.url` matches pre-migration `AIM_PDF_URL`; assert `chapter_html.chapter_count == 12` (ch0..ch11); assert `appendix_html.appendix_count == 5`; assert `sections_per_chapter` length is 12; assert `chapter_0_section_url_override` is present.
- [ ] Load `scripts/sources/config/regs.yaml`; assert ECFR base URL and titles 14, 49.
- [ ] Load `scripts/sources/config/handbooks-extras.yaml`; assert 8 entries.
- [ ] Malformed YAML: missing required field surfaces structured error pointing at field name.
- [ ] Loader caches parsed YAML for the duration of a run (no double-read).

### Plan builder

**Goal:** `buildPlans()` produces the same shape as before for unchanged corpora; new plan shapes for chapter-aware handbooks.

- [ ] AC build: 12 plans, each `corpus: 'ac'`, flat dest path matches `<root>/ac/<doc-id>.pdf`.
- [ ] ACS build: 5 plans, flat dest at `<root>/acs/<doc-id>.pdf`.
- [ ] AIM build: 1 PDF plan + 48 section plans (ch0..ch11 per `sections_per_chapter`) + 5 appendix plans = 54 plans total.
- [ ] Regs build: per filtered-parts entry as before.
- [ ] PHAK build (chapter_pdfs.index_url variant): 1 whole-doc + 17 chapter + 4 ancillary plans. Each chapter plan has the resolved final-PDF URL.
- [ ] AFH build (chapter_pdfs.direct_pattern variant): 1 whole-doc + N chapter plans built directly from the pattern, no scrape needed.
- [ ] AVWX build (no chapter_pdfs): 1 whole-doc plan only.

### Two-hop scrape

**Goal:** index page parsing produces correct chapter URLs; failures are loud.

- [ ] Mock fetch returning a fixture PHAK index page; assert `resolveChapterUrls()` returns 17 chapter URLs in chapter-ordinal order.
- [ ] One chapter page returns 404: assert hard error with structured remediation.
- [ ] Index page anchor text changes: assert the URL pattern match still works (test flexible) OR assert hard fail with field name (test strict). Pick strict; document.
- [ ] Cached resolved URLs: re-run with manifest present + index Last-Modified unchanged, assert no fetch happens.
- [ ] Cached resolved URLs: re-run with index Last-Modified advanced, assert re-scrape happens.

### HTML fetch

**Goal:** HTML files are downloaded with the same safety as PDFs; content-type validation surfaces wrong-type.

- [ ] Successful HTML download writes file atomically (tmp + rename).
- [ ] Server returns `content-type: application/pdf` instead of `text/html`: assert error.
- [ ] Server returns `content-type: text/html; charset=utf-8`: assert success (charset suffix tolerated).
- [ ] HEAD-cache hit: re-run skips body download.
- [ ] ETag unchanged: re-run skips body download.

### Manifest schema

**Goal:** new fields don't break old readers; atomicity preserved.

- [ ] Write a manifest with `chapters[]` populated; read it back; round-trip equal.
- [ ] Read a manifest written before this WP (no `chapters[]` field): does not throw; `chapters` defaults to empty array.
- [ ] Concurrent write attempt: tmp-file pattern means only one write completes; the other can be detected via temp file collision (tolerate via retry, not error).
- [ ] AIM manifest: write with 48 sections, read back, all locators (chapter, section, paragraph_count) preserved.

### URL verifier

**Goal:** false-positive-free 404 detection; AIM section count check.

- [ ] All URLs return 200: verifier output is "OK", exit 0.
- [ ] One URL returns 404: verifier reports field path + suggested remediation, exit non-zero.
- [ ] AIM section count mismatch (publisher added a section): verifier reports the chapter and the YAML field; exit non-zero.
- [ ] Network timeout on one URL: verifier reports timeout (transient) but exit 0 (do not fail builds on transient errors).

### Inventory generator

**Goal:** regenerable, sorted, complete.

- [ ] Run on a populated cache; output to a temp file; re-run; diff is empty.
- [ ] Run on a partially-populated cache (no AIM): output omits AIM section.
- [ ] Sort verification: each per-corpus table is sorted by doc-id, then by asset ordinal.
- [ ] Every URL in the output is a valid markdown link (`[text](url)`).
- [ ] SHA-256 prefix is exactly 12 chars, lowercase hex.

### AIM HTML extraction

**Goal:** BeautifulSoup parser produces expected section tree from fixture HTML.

- [ ] Fixture: `chap07_section_03.html`. Parse. Assert tree contains paragraph IDs `7-3-1` through `7-3-6`.
- [ ] Each paragraph node has the h4 title text as `title` and the following content as `body`.
- [ ] Fixture: `appendix_03.html` (the acronym table). Parse. Assert content includes the acronym table; assert no h4 traversal needed (no h4 tags exist).
- [ ] Malformed HTML: parser does not crash; surfaces clear error.

### Chapter-PDF plaintext

**Goal:** chapter-mode produces full-text sidecars without truncation.

- [ ] Fixture: PHAK ch7 chapter PDF. Run `chapter_plaintext` in chapter mode. Assert output > 100 KB plaintext (whole chapter).
- [ ] Output contains the literal strings: `Turbine Engines`, `Fuel Systems`, `Oxygen Systems`, `Pressurized Aircraft`, `Chapter Summary`.
- [ ] Output is NOT capped at 60K (`len(output) > 60000`).
- [ ] Whole-doc handbook (AVWX): chapter mode is NOT activated; page-range slicing path runs; cap still applies.

### Python config loader

**Goal:** `WholeDoc` and `ChapterPdfs` dataclasses load correctly.

- [ ] Load PHAK YAML; assert `config.whole_doc.url` matches; assert `config.chapter_pdfs.index_url` matches.
- [ ] Load AVWX YAML (no chapter_pdfs); assert `config.chapter_pdfs is None`.
- [ ] Missing required field in `whole_doc`: structured error, points at YAML field.

## Integration tests (operator runs against real FAA)

These require network access. Not in CI; run manually before merge.

### PHAK end-to-end

- [ ] Wipe `~/Documents/airboss-handbook-cache/handbooks/phak/`.
- [ ] Run `bun run sources download phak`. Expect:
  - 1 whole-doc PDF
  - 17 chapter PDFs (`FAA-H-8083-25C-ch01.pdf` through `FAA-H-8083-25C-ch17.pdf`)
  - 0 ancillary PDFs (PHAK is Class A1: no separately-distributed ancillaries; verified empirically)
  - 1 manifest with `primary` + `chapters[]` (17 entries) + `ancillary[]` (empty) + `errata[]` (carried over from previous state if any)
- [ ] Re-run download. Expect zero PDF bodies fetched. HEAD requests OK.
- [ ] Delete `FAA-H-8083-25C-ch07.pdf`. Re-run. Expect exactly one download.
- [ ] Run `bun run sources extract handbooks phak --strategy prompt`. Expect 17 chapter sidecars. Assert ch 7 sidecar contains the 5 expected literals. Assert no sidecar at the 60K cap.

### AFH end-to-end

- [ ] Wipe AFH cache. Run `bun run sources download afh`. Expect whole-doc + 18 chapters + 3 ancillaries (front, glossary, index).
- [ ] Re-run, expect zero PDF bodies fetched.
- [ ] Run extraction; verify chapter-PDF mode is active (sidecars are not page-sliced).

### IPH end-to-end

- [ ] Wipe IPH cache. Run `bun run sources download iph`. Expect whole-doc + N chapters + ancillaries.

### AVWX end-to-end (Class C, regression)

- [ ] Wipe AVWX cache. Run `bun run sources download avwx`. Expect whole-doc only, no chapter entries.
- [ ] Run extraction; expect page-range slicing path (Class C). 60K cap still applies (this is correct -- whole-doc handbooks need it).

### AIM end-to-end

- [ ] Wipe AIM cache. Run `bun run sources download aim`. Expect:
  - 1 bundled PDF
  - 48 section HTML files (per `sections_per_chapter` empirical counts; `chap00_section_01.html` for ch0 through `chap11_section_08.html` for ch11 last section)
  - 5 appendix HTML files
  - 1 manifest with `primary` + `sections[]` (48) + `appendices[]` (5)
- [ ] Inspect `aim/chap07_section_03.html` content; verify it includes paragraph "7-3-1. Effect of Cold Temperature".
- [ ] Inspect `aim/appendix_03.html`; verify it includes the acronym table contents (look for known acronyms like "AAWU", "AAS", "AAM").
- [ ] Run extraction (when AIM extraction lands); verify section tree is built.

### URL verifier real run

- [ ] Run `bun run sources verify-urls` against a populated cache + the YAML configs. Expect zero 404s.
- [ ] Manually edit one YAML to point at a known-bad URL (e.g. add `-broken` suffix). Re-run. Expect non-zero exit and the broken URL surfaced with field path.
- [ ] Revert the edit.

### Inventory generation real run

- [ ] Run `bun run sources inventory` against the populated cache. Expect `docs/ingestion-pipeline/inventory.md` to be generated.
- [ ] Open the file. Verify per-corpus tables, sorted entries, clickable URLs, SHA-256 prefixes present.
- [ ] Re-run. Expect byte-equal output.
- [ ] `git status` shows the file changed only when the underlying data actually changed.

## Operator manual test plan (gates the merge)

This is the punch list the operator runs before approving the implementation PR for merge.

1. **Cache layout sanity.** `tree ~/Documents/airboss-handbook-cache/ -L 4 | head -100`. Visual inspection: ADR 021 flat naming preserved; new chapter files appear under handbooks; new section + appendix files appear under aim.
2. **PHAK fresh download.** Wipe + re-fetch; observe console output for two-hop scrape progress; verify all 17 chapters end up in cache.
3. **PHAK ch 7 extraction quality.** Run extraction; open ch 7 sidecar; verify it's much larger than 60 KB; verify it contains the 5 expected literals.
4. **AFH direct download.** Wipe + re-fetch; verify direct pattern works (no scrape).
5. **AIM HTML download.** Wipe + re-fetch; spot-check 5 random section files; verify they have actual content (not just navigation chrome).
6. **AVWX regression.** Wipe + re-fetch; verify whole-doc only, no spurious chapter download attempt.
7. **Re-download idempotency.** Re-run all 5 above downloads; expect zero PDF/HTML body fetches.
8. **URL verifier sweep.** Run `bun run sources verify-urls`; eyeball the output for any unexpected warnings.
9. **Inventory regen.** Run `bun run sources inventory`; open `docs/ingestion-pipeline/inventory.md`; verify it's complete and reasonable.
10. **Idempotent inventory.** Re-run; assert `git status` shows no changes.

## Test data fixtures

The integration tests against real FAA URLs cannot be in CI (network dependency, brittle). For unit tests that need realistic HTML/PDF content, capture small fixtures:

- [ ] Capture `chap07_section_03.html` (one chapter section, ~360 KB) for AIM HTML extraction tests.
- [ ] Capture `appendix_03.html` (the acronym table, ~127 KB) for AIM appendix tests.
- [ ] Capture PHAK ch1 chapter PDF (~5 MB) for chapter_plaintext tests. PHAK ch1 ("Introduction to Flying") is among the smallest chapters and is the natural choice for a unit-test fixture.
- [ ] Capture a snippet of the PHAK index page (~50 KB) for two-hop scrape tests.
- [ ] All fixtures live at `tools/handbook-ingest/tests/fixtures/` or `scripts/sources/download/__tests__/fixtures/`.
- [ ] **Fixture budget: 5 MB per file, 50 MB total.** Synthetic PDFs are an acceptable substitute when a real chapter PDF is too large; document the substitution in the test file's docstring.

## What's NOT tested

- **Live FAA URL stability.** If the FAA rotates a URL between PR merge and operator's next download, the verifier catches it. This is documented as a risk, not a test.
- **PDF rendering quality across reader software.** The cache stores bytes; rendering is downstream.
- **DB schema.** Out of scope.
- **The 60K cap behavior for whole-doc handbooks.** Owned by the contract-v2 WP. We test that chapter-PDF mode bypasses the cap; the cap's existence for whole-doc is unchanged and uninteresting here.
