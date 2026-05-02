---
title: 'Tasks: Chapter source ingestion'
product: platform
feature: chapter-source-ingestion
type: tasks
status: unread
review_status: pending
---

# Tasks: Chapter source ingestion

Implementation checklist for the chapter-source-ingestion WP. Each phase ends with `bun run check` clean and a commit. Phase order matters; later phases depend on earlier contracts.

## Phase 0 -- Pre-flight

- [ ] Confirm branch is off latest `main` (post-#327, post any subsequent merges).
- [ ] Read `docs/work-packages/chapter-source-ingestion/spec.md` end-to-end.
- [ ] Read `docs/work-packages/chapter-source-ingestion/design.md`.
- [ ] Read `docs/work-packages/chapter-source-ingestion/test-plan.md`.
- [ ] Skim ADR 021 (the layout this extends).
- [ ] Verify `scripts/migrate-cache-flat.ts` is gone (resolved 2026-04-29; should be absent both from git and working tree).
- [ ] Verify cache state on disk: `tree ~/Documents/airboss-handbook-cache/ -L 3` matches ADR 021 layout (post-#327 flat naming).

## Phase 1 -- Config consolidation (single source of truth)

Move hardcoded URL inventories from `scripts/sources/download/plans.ts` into per-corpus YAML files. Migrate existing handbook YAMLs from `tools/handbook-ingest/ingest/config/` to `scripts/sources/config/handbooks/` so all source-corpus config lives at one location.

- [ ] Create `scripts/sources/config/` directory and `scripts/sources/config/handbooks/` subdirectory.
- [ ] Create `scripts/sources/config/ac.yaml` -- 12 ACs from `AC_TARGETS`. Schema: `entries[]` with `{ doc_id, edition, url, filename }`.
- [ ] Create `scripts/sources/config/acs.yaml` -- 5 ACSs from `ACS_TARGETS`.
- [ ] Create `scripts/sources/config/aim.yaml` -- bundled PDF URL + section URL pattern + section count per chapter (12-element array including ch0) + appendix URL pattern + appendix count + chapter_0_section_url_override for the irregular `chap0_info_eoc.html` URL.
- [ ] Create `scripts/sources/config/regs.yaml` -- ECFR_BASE, ECFR_TITLES_URL, per-title list (14, 49) with filtered parts.
- [ ] Create `scripts/sources/config/handbooks-extras.yaml` -- 8 handbook extras from `HANDBOOKS_EXTRAS_TARGETS`.
- [ ] Migrate existing handbook YAMLs: `tools/handbook-ingest/ingest/config/{phak,afh,avwx}.yaml` -> `scripts/sources/config/handbooks/{phak,afh,avwx}.yaml`. Use `git mv` to preserve history.
- [ ] Update `tools/handbook-ingest/ingest/config_loader.py` to read from the new location. Update its `CONFIG_DIR` constant.
- [ ] Run existing Python `config_loader` tests to verify the move is non-breaking.
- [ ] Create `scripts/sources/config/loader.ts` -- reads YAMLs at runtime via the `yaml` package; type-safe via Zod schemas.
- [ ] Add Zod schema files: one per corpus YAML shape (ac, acs, aim, regs, handbook).
- [ ] Delete `AC_TARGETS`, `ACS_TARGETS`, `HANDBOOKS_EXTRAS_TARGETS`, `AIM_PDF_URL` from `plans.ts`.
- [ ] Delete `mkAc`, `mkAcs`, `mkHbk` helpers from `plans.ts`.
- [ ] Update `buildPlans()` in `plans.ts` to read YAML inventory via the loader.
- [ ] Add unit test: load each YAML, count entries, assert match against pre-migration counts (12 ACs, 5 ACSs, 8 handbook extras).
- [ ] Add unit test: Python `config_loader` reads the migrated handbook YAMLs without error.
- [ ] `bun run check` clean.
- [ ] Commit: `refactor(sources): consolidate corpus URL config into scripts/sources/config/`.

## Phase 2 -- Per-handbook YAML schema extension

Extend handbook configs at `scripts/sources/config/handbooks/<slug>.yaml` (post-Phase-1 location) with `whole_doc`, `chapter_pdfs` / `chapter_html`, and `excluded_assets` keys.

- [ ] Edit `scripts/sources/config/handbooks/phak.yaml` -- add `whole_doc` (verify URL freshness; current YAML may be stale) + `chapter_pdfs` (two-hop variant: `index_url`, `chapter_page_pattern: chapter-{N}-`, `chapter_count: 17`, `ancillary: []`). PHAK is Class A1: no separate ancillary PDFs (verified empirically 2026-04-29).
- [ ] Edit `scripts/sources/config/handbooks/afh.yaml` -- add `whole_doc` + `chapter_pdfs` (direct variant: `direct_pattern`, `chapter_count: 18`, `file_ordinal_offset: 1`, `ancillary: [front, glossary, index]`). AFH is Class A2.
- [ ] Create `scripts/sources/config/handbooks/iph.yaml` -- first IPH config with chapter PDFs. Probe chapter count + ancillary list at impl time.
- [ ] Edit `scripts/sources/config/handbooks/avwx.yaml` -- add `whole_doc` only; no `chapter_pdfs` key (Class C).
- [ ] Add `excluded_assets: []` to every handbook YAML as an explicit field (default empty; documented for future use).
- [ ] Edit `tools/handbook-ingest/ingest/config_loader.py` -- add `WholeDoc`, `ChapterPdfs`, and `ExcludedAssets` Python dataclasses to `HandbookConfig`.
- [ ] Update Python tests for `config_loader` to cover the new fields (round-trip + missing-field + null-chapter-pdfs cases).
- [ ] Probe URL freshness for each handbook's `whole_doc.url` -- if any 404, update YAML to current URL and document in commit message.
- [ ] `bun run check` clean.
- [ ] Commit: `feat(sources): add chapter-aware fields to handbook YAML configs`.

## Phase 3 -- TS download path: chapter PDFs

- [ ] Create `scripts/sources/download/scrape.ts` -- two-hop URL resolver. Function: `resolveChapterUrls(indexUrl, pagePattern, chapterCount): Promise<readonly { ordinal, page_url, pdf_url }[]>`.
- [ ] Two-hop scrape uses the existing User-Agent header logic and HEAD-cache.
- [ ] Add unit tests for the scrape: mock fetch, verify URL resolution, verify hard-fail on 404.
- [ ] Update `buildPlans()` in `plans.ts`: for each handbook config with `chapter_pdfs`, emit one `DownloadPlan` per chapter and one per ancillary.
- [ ] Update `DownloadPlan` if needed to carry `ordinal` and `kind` (chapter vs ancillary). Decide if a discriminated union is cleaner than optional fields.
- [ ] Resolved chapter URLs cache in the manifest's `chapters[].source_url` and `chapters[].resolved_via`.
- [ ] Re-run skips re-scrape unless manifest is missing entries OR index page's Last-Modified advances.
- [ ] Hard fail on individual chapter 404. Structured error pointing at YAML field.
- [ ] Update `scripts/sources/download/manifest.ts` -- extend `HandbookCacheManifest` with `chapters[]` and `ancillary[]`.
- [ ] Schema migration: existing manifests without these fields get them populated on the next download (no migration script needed; download is idempotent).
- [ ] Update `scripts/sources/download/execute.ts` if needed to handle the new plan shapes.
- [ ] Add tests: PHAK two-hop end-to-end with mocked HTTP, AFH direct end-to-end with mocked HTTP, AVWX (no chapter_pdfs) verifies whole-doc only.
- [ ] `bun run check` clean.
- [ ] Commit: `feat(sources): chapter PDF download with two-hop scrape support`.

## Phase 4 -- TS download path: AIM HTML

- [ ] Create `scripts/sources/download/html-fetch.ts` -- HTML download path. Same retry/atomic-write/manifest semantics as PDF; Content-Type validation expects `text/html`.
- [ ] Update `buildPlans()` for AIM: read `chapter_html` and `appendix_html` config, emit one plan per section + one per appendix + one for the bundled PDF.
- [ ] Section filename pattern: `chap{CC}_section_{SS}.html` (zero-padded). Source URL uses publisher's form (`chap1_section_1.html`).
- [ ] Appendix filename pattern: `appendix_{NN}.html` (zero-padded). Source URL uses publisher's form (`appendix_1.html`).
- [ ] Update `scripts/sources/download/manifest.ts` -- extend AIM corpus manifest with `sections[]` and `appendices[]`.
- [ ] Verify AIM manifest entries each have ETag + Last-Modified recorded.
- [ ] Add tests: AIM end-to-end with mocked HTTP for section + appendix URLs.
- [ ] `bun run check` clean.
- [ ] Commit: `feat(sources): AIM section + appendix HTML download`.

## Phase 5 -- Python ingest: chapter-PDF mode

- [ ] Edit `tools/handbook-ingest/ingest/fetch.py` -- when `chapter_pdfs` key is present in config and chapter PDFs exist in cache, return per-chapter PDF paths instead of whole-doc + page ranges.
- [ ] Edit `tools/handbook-ingest/ingest/chapter_plaintext.py` -- chapter-mode branch at the entry point. When active, sidecar = full chapter PDF text (pdftotext extraction); no truncation cap applies.
- [ ] Preserve page-range slicing path for whole-doc handbooks (Class C).
- [ ] Edit `tools/handbook-ingest/ingest/cli.py` -- add chapter-mode branch to download messaging. **Minimize narration string edits.** Add new branches to existing strings, do not rewrite.
- [ ] Probe per handbook on first chapter download: detect front matter dup (compare first-page text against whole-doc front matter); if found, log warning and continue (chapter PDF is still authoritative for its content body).
- [ ] Verify against PHAK ch7: sidecar contains `Turbine Engines`, `Fuel Systems`, `Oxygen Systems`, `Pressurized Aircraft`, `Chapter Summary`. None at 60K cap.
- [ ] Run section-extraction prompt-strategy end-to-end for PHAK; produce per-chapter sidecars derived from chapter PDFs.
- [ ] `bun run check` clean.
- [ ] Commit: `feat(handbook-ingest): chapter-PDF mode for section extraction`.

## Phase 6 -- Python ingest: AIM HTML extraction

- [ ] Create `tools/handbook-ingest/ingest/aim_html_extract.py`. Uses BeautifulSoup.
- [ ] Section file parser: walk `<h4 class="paragraph-title" id="C-S-P">` for paragraph tree. Each h4 produces a section-tree leaf with locator `C-S-P` and the paragraph body text.
- [ ] Appendix file parser: extract `<main class="main-content usa-content">` contents. Treat as a single section (locator: `appendix-N`). Tables (Appendix 3, 4) preserve `<table>` HTML for downstream rendering.
- [ ] Wire `aim_html_extract.py` into the existing extraction pipeline so `bun run sources extract handbooks aim --strategy prompt` (or equivalent) flows through it.
- [ ] Add Python tests against captured fixture HTML files (one chapter section, one appendix).
- [ ] Verify chap07_section_03.html parses to a tree with paragraph IDs `7-3-1` through `7-3-6`.
- [ ] `bun run check` clean.
- [ ] Commit: `feat(handbook-ingest): AIM HTML extraction via BeautifulSoup`.

## Phase 7 -- New CLI commands

### verify-urls

- [ ] Create `scripts/sources/verify-urls.ts`.
- [ ] HEAD-checks every URL across all YAML configs.
- [ ] For two-hop handbooks, also re-runs the index scrape and compares resolved URLs against the manifest.
- [ ] AIM section count check: actual fetched count must match `sections_per_chapter` from `aim.yaml`.
- [ ] Reports 404s with structured remediation (which YAML field, which index page).
- [ ] Add unit test with mocked HTTP.
- [ ] Register `verify-urls` subcommand in `scripts/sources.ts`.

### inventory

- [ ] Create `scripts/sources/inventory.ts`.
- [ ] Walks every YAML config and every cache manifest.
- [ ] Emits `docs/ingestion-pipeline/inventory.md` with per-corpus tables.
- [ ] One timestamp at the top; no timestamps inside section bodies (idempotent regeneration).
- [ ] Sorted: per-corpus, per-doc, per-asset.
- [ ] Add unit test asserting byte-equal output for the same input.
- [ ] Register `inventory` subcommand in `scripts/sources.ts`.
- [ ] Run `bun run sources inventory`; commit the generated `docs/ingestion-pipeline/inventory.md`.

- [ ] `bun run check` clean.
- [ ] Commit: `feat(sources): verify-urls + inventory commands`.

## Phase 8 -- ADR 022

- [ ] Create `docs/decisions/022-chapter-source-ingestion/decision.md`.
- [ ] Records: three publisher classes, YAML config-not-code migration, manifest schema extension, inventory document, the "always grab everything available" rule.
- [ ] References ADR 021 as the layout it extends. ADR 021 receives no edits.
- [ ] `bun run check` clean.
- [ ] Commit: `docs(adr): ADR 022 -- chapter-source ingestion`.

## Phase 9 -- Doc sweep

- [ ] Update `docs/platform/STORAGE.md` -- add chapter PDFs and AIM section files to the cache layout examples.
- [ ] Update `docs/decisions/020-handbook-edition-and-amendment-policy.md` if cache layout examples reference handbooks.
- [ ] Update `docs/work-packages/handbook-ingestion-and-reader/spec.md` and tasks.md if cache references need refreshing.
- [ ] Update `docs/work-packages/section-extraction-prompt-strategy/design.md` -- chapter-PDF mode bypasses the truncation cap.
- [ ] Update `docs/work-packages/apply-errata-and-afh-mosaic/design.md` if errata flow references the cache layout.
- [ ] Update `scripts/README.sources.md` -- new `verify-urls` and `inventory` commands; YAML config location.
- [ ] Update `tools/handbook-ingest/README.md` -- chapter-PDF mode section.
- [ ] `bun run check` clean.
- [ ] Commit: `docs(sweep): chapter-source ingestion`.

## Phase 10 -- End-to-end verification + commit-and-merge

- [ ] Wipe `~/Documents/airboss-handbook-cache/handbooks/phak/`. Run `bun run sources download phak`. Verify cache layout: 1 whole-doc + 17 chapter PDFs + ancillaries + manifest. Manifest's `chapters[]` ordered 1..17.
- [ ] Re-run `bun run sources download phak`. Expect zero PDF body downloads (HEAD cache hits only).
- [ ] Delete `FAA-H-8083-25C-ch07.pdf` from cache. Re-run. Expect exactly one download.
- [ ] Repeat for `afh`, `iph`, `helicopter`, `glider`, `balloon`, `instructors`. (Operator can defer the long-tail handbooks if scope is too big; minimum required: PHAK + AFH + IPH for v1.)
- [ ] Run `bun run sources download avwx`. Expect whole-doc only.
- [ ] Run `bun run sources download aim`. Expect 48 sections (per `sections_per_chapter` empirical counts) + 5 appendices + bundled PDF.
- [ ] Run `bun run sources verify-urls`. Expect zero 404s.
- [ ] Run `bun run sources inventory`. Verify `docs/ingestion-pipeline/inventory.md` is generated, sorted, every URL is clickable.
- [ ] Re-run `bun run sources inventory`. Expect byte-equal output.
- [ ] Run `bun run sources extract handbooks phak --strategy prompt`. Verify ch 7 sidecar contains the 5 expected literals.
- [ ] `bun test` clean for all changed-area tests.
- [ ] `bun run check` clean.
- [ ] `rg 'AC_TARGETS|ACS_TARGETS|HANDBOOKS_EXTRAS_TARGETS|AIM_PDF_URL|mkAc|mkAcs|mkHbk' scripts/sources/download/plans.ts` returns zero hits.
- [ ] Open PR with the per-phase commits.
- [ ] Address review feedback (per project rule: fix everything from a review unless explicitly told not to).
- [ ] Squash-merge.
- [ ] Run `bun run sources inventory` once more on main; verify it matches the committed file.

## Punted / known follow-ups

- **Class C handbooks (AVWX, IFH, AMT, seaplane) -- chapter splitting.** Whole-doc only per publisher; client-side splitting deferred to a future WP if extraction quality demands it.
- **Long-tail Class A handbooks (helicopter, glider, balloon, instructors).** v1 may ship with PHAK + AFH + IPH only; long-tail handbooks ingested in subsequent operator runs as needed. Tests must still cover the long-tail YAML configs even if cache isn't pre-populated.
- **Edition rollover automation.** When the FAA cuts a new edition, an operator manually updates the YAML. Optional `bun run sources upcoming-edition <slug>` helper is not in scope.
- **Chapter PDFs for AC/ACS.** ACs and ACSs are short publications without chapter splits. Whole-doc is the only mode; not a follow-up.
