---
title: 'Test plan: IFH section-tree promotion'
product: platform
feature: wp-ifh-section-tree
type: test-plan
status: unread
review_status: pending
shipped_at: '2026-05-03'
---

# Test plan: IFH section-tree promotion

## Automated

### TOC-file-sidecar parser unit tests (pytest)

- `tools/handbook-ingest/tests/test_sections_via_toc_file.py`
- Covers:
  - Single chapter sentinel + dotted-leader entry produces one chapter node + one section node.
  - `Chapter 6, Section I` sentinel + `Chapter 6, Section II` sentinel emit two L1 sections under chapter 6 (the spec's decision (b)).
  - Roman-numeral header lines (`x`, `xi`, ...) are skipped, not treated as titles.
  - Indented continuation lines coalesce with their preceding title line (`"Title that wraps"` + `"more text....6-7"`).
  - Page-anchor extraction handles two-digit pages (`6-15`, `10-32`).
  - Front-matter entries (Preface, Acknowledgments, Introduction) and back-matter (Appendix A, Appendix B, Glossary, Index) are recognized but not emitted as chapter nodes (or are emitted as appendices per existing AVWX precedent).

### Manifest validation test

- After running `bun run sources extract handbooks ifh --edition FAA-H-8083-15B`, the produced `handbooks/ifh/FAA-H-8083-15B/manifest.json` must:
  - Have `kind: handbook` and non-empty `sections[]`.
  - Contain 11 chapter rows (chapters 1..11).
  - Contain `6.1` and `6.2` section rows under chapter 6 with titles starting `Section I -- ...` and `Section II -- ...`.
  - Contain `7.1` and `7.2` rows likewise under chapter 7.
  - Each section row's `body_path` resolves to a non-empty markdown file.

### handbooks-extras smoke test

- `libs/sources/src/handbooks-extras/ingest.test.ts` smoke test:
  - `report.ingested` == 4 (was 5; IFH removed).
  - The slug existence check loop omits `ifh`.

## Manual

- /library landing: IFH card visible, deep-link drill-down works to chapter 6 -> Section I.
- Pick a known IFH locator like `airboss-ref:handbooks/ifh/8083-15B/6/1` and confirm the renderer shows Section I content.
- Pick `airboss-ref:handbooks/ifh/8083-15B/6/2` and confirm it shows Section II content (electronic flight display).

## Non-goals

- Errata application (3 amendment PDFs) -- separate WP under ADR 020.
- Prompt-flow verification pass -- optional follow-up; not blocking.
