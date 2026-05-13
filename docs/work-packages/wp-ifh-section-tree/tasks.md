---
title: 'Tasks: IFH section-tree promotion'
product: platform
feature: wp-ifh-section-tree
type: tasks
status: unread
review_status: pending
shipped_at: '2026-05-03'
---

# Tasks: IFH section-tree promotion

## Phase 0 -- Spec docs

- [x] `docs/work-packages/wp-ifh-section-tree/spec.md`
- [x] `docs/work-packages/wp-ifh-section-tree/tasks.md`
- [x] `docs/work-packages/wp-ifh-section-tree/test-plan.md`

## Phase 1 -- YAML config

- [x] `scripts/sources/config/handbooks/ifh.yaml` authored, modeled on `avwx.yaml`:
  - `document_slug: ifh`, `edition: FAA-H-8083-15B`, `kind: handbook`
  - `whole_doc.url`, `whole_doc.filename` carried over from `handbooks-extras.yaml`
  - `outline_strategy: toc-file-sidecar`
  - `section_strategy: toc-file-sidecar`
  - `toc_file: docs/.archive/work-packages/2026-05/whole-doc-promotion/source-tocs/ifh.md`
  - `subjects: [procedures, navigation, flight-instruments]`, `primary_cert: instrument`
  - `title_overrides:` for chapters 6 and 7 (the printed-TOC sentinels read `Chapter 6, Section I/II` so the chapter title is set explicitly to the modality-agnostic theme)
  - `errata: []`, `dismissed_errata: []` placeholders for ADR-020 follow-up

## Phase 2 -- Implement TOC-file-sidecar strategy

- [x] `tools/handbook-ingest/ingest/sections_via_toc_file.py` -- new module that:
  1. Reads the markdown TOC file at `toc_file:` path.
  2. Parses chapter sentinels (`Chapter <N>`, `Chapter <N>, Section <I|II>`).
  3. Parses dotted-leader entries (`Title.....page-anchor`) and coalesces multi-line title wraps.
  4. Maps to a section tree per chapter with the Chapter 6/7 Section I/II quirk handled per spec decision (b): Section I/II become L1 sections under the parent chapter; deeper TOC entries become L2 subsections.
  5. Emits `OutlineNode` chapters + `SectionTreeNode` sections.
- [x] Wired into `outline.py` (via `cli._phase_outline_from_toc_file`) so `outline_strategy: toc-file-sidecar` returns chapter outline from the TOC sidecar with PDF page ranges patched in by `detect_outline_from_text`.
- [x] Wired into `cli.py` so `section_strategy: toc-file-sidecar` invokes `_run_toc_file_sidecar_strategy`.
- [x] Updated `config_loader.py`:
  - Accepts `outline_strategy: toc-file-sidecar`
  - Accepts `section_strategy: toc-file-sidecar`
  - Adds `toc_file: <path>` field to `HandbookConfig`
  - Adds `primary_cert:` field to `HandbookConfig`; routed through `normalize.write_outputs` into the manifest
- [x] pytest unit tests at `tools/handbook-ingest/tests/test_sections_via_toc_file.py` covering:
  - Single chapter sentinel + flat L1 sections.
  - The IFH chapter 6 Section I/II quirk -> two L1 sections + L2 subsections under each.
  - Two-line title wraps coalesce.
  - Appendix / Glossary / Index entries are skipped.
  - Two-digit page anchors round-trip.
  - Empty TOC file hard-fails.
  - `chapter_page_starts` thread through to chapter outline rows.

## Phase 3 -- Run extraction

- [x] `bun run sources extract handbooks ifh --edition FAA-H-8083-15B`
- [x] Verified chapter+section count: 11 chapters, 587 sections (428 L1, 159 L2, 0 L3). Total manifest rows = 598.
- [x] Spot-checked `6.1` / `6.2` / `7.1` / `7.2` rows: titles read `Section I -- ...` / `Section II -- ...`, page anchors `6-1` / `6-15` / `7-1` / `7-33`.
- [x] Body markdown sliced per section under each chapter directory.

## Phase 4 -- Remove from handbooks-extras

- [x] Removed `faa-h-8083-15` row from `scripts/sources/config/handbooks-extras.yaml`.
- [x] Removed `'faa-h-8083-15'` and `ifh` from `DOC_ID_TO_FRIENDLY` and `FRIENDLY_DISPLAY` in `libs/sources/src/handbooks-extras/ingest.ts`.
- [x] Updated smoke test count in `libs/sources/src/handbooks-extras/ingest.test.ts`: 5 -> 4 ingestion + slug-existence loop pruned.
- [x] Removed `handbooks/ifh/FAA-H-8083-15B/ifh-FAA-H-8083-15B.md` (old whole-doc body).
- [x] Removed the IFH row from `handbooks/handbooks-extras-index.json`.

## Phase 5 -- Verify

- [x] Vitest -- `libs/sources/src/handbooks-extras/ingest.test.ts` passes (21 tests + 1 skipped live-cache smoke).
- [x] pytest -- 7/7 new tests pass (`test_sections_via_toc_file.py`); pre-existing `test_config_loader.py` failures (unrelated -- subjects fixture gap on origin/main).
- [x] Biome -- clean.
- [x] `bun run check` -- pre-existing `fast-xml-parser` and `validate-help-ids` errors are also present on origin/main (not introduced by this WP).

## Phase 6 -- Tests + docs

- [x] Update `docs/platform/REFERENCES.md`: IFH row to `✅ readable, section-tree`; sequencing row 6 to `✅ shipped`.
- [x] WP status to shipped (frontmatter `shipped_at` on spec / tasks / test-plan).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
