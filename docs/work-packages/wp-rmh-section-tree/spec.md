---
id: wp-rmh-section-tree
title: WP-RMH -- promote Risk Management Handbook to section-tree
product: course
category: content
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags:
  - rmh
  - handbook
  - section-tree
---

# WP-RMH -- promote Risk Management Handbook to section-tree

Status: in-flight
Owner: agent (this WP)
Source corpus: handbooks
Doc: `risk-management` (FAA-H-8083-2A)

## Why

Risk Management Handbook (RMH) currently flows through the
`handbooks-extras` whole-doc pipeline: a single `pdftotext` extraction
concatenates all 80 pages into one markdown body, registers as one
`level: 'document'` `reference_section` row. This is the right shape for
unstructured content but RMH ships an authored, multi-level structure
(8 chapters, 4 appendices, 166-entry embedded outline at depth 4) that
the whole-doc shape collapses.

Promoting RMH to section-tree gives:

- chapter / section / subsection rows in `study.reference_section`, so
  the reader paginates by chapter and citations resolve to depth
- `/library` card drill-down by chapter (matches PHAK / AFH / AVWX UX)
- citations of the form `RMH Ch.4.2` instead of "RMH (whole doc)"
- removes RMH from the `handbooks-extras` long tail and makes one YAML
  drive download + extract + register from the same canonical config
  (`scripts/sources/config/handbooks/risk-management.yaml`)

## Strategy

Per `docs/work-packages/whole-doc-promotion/research.md` §RMH:

- PDF embedded outline: 166 entries, depths {1: 18, 2: 57, 3: 46, 4: 45}
- L4 entries (45 of them) are inner step lists; the schema caps at depth
  3 so `parse_outline` already drops them (matches AVWX/AFH precedent)
- L1 entries break into:
  - 3 front-matter (Preface, Introduction, Major Enhancements)
  - 8 chapters (Chapter 1-8)
  - 1 "Appendix Introduction" prelude
  - 4 appendices (A-D)
  - 2 back-matter (Glossary, Index)
- No per-chapter PDFs (Class C). No published errata.

Use the chapter-aware Python pipeline (`tools/handbook-ingest/`) with
`outline_strategy: bookmark` (mirrors AVWX). Ship a new YAML at
`scripts/sources/config/handbooks/risk-management.yaml` modeled after
`avwx.yaml`. Remove the old `handbooks-extras` row.

### New YAML field: `bookmark_chapter_filter`

The bookmark outline includes front-matter and back-matter L1 entries
(Preface, Introduction, Major Enhancements, Glossary, Index, Appendix
Introduction) that should not become chapter rows. AvWX doesn't trip
this because its L1 titles are all numbered (`'1 Introduction'`,
`'2 Aviation Weather Service Program'`, ...). RMH's L1 titles are
human-shaped (`'Preface'`, `'Chapter 1: Introduction to Risk
Management'`).

Add a config field `bookmark_chapter_filter` (regex, optional). When
set, `parse_outline` keeps only L1 entries whose title matches, plus
their L2/L3 descendants. Everything else (front-matter, back-matter) is
dropped. RMH uses
`'^(Chapter \d+|Appendix [A-Z])\b'` -- skips Preface, Introduction,
Major Enhancements, Appendix Introduction, Glossary, Index.

This is a generic improvement: AIH (when promoted later) will need the
same filter for Acknowledgments and Preface L1 entries.

### `primary_cert` round-trip in the Python pipeline

The chapter-aware Python pipeline (`normalize.py`) does not currently
write `primary_cert` into the manifest. It was hand-edited in once
(#390). Re-running ingest erases it. Add `primary_cert` to
`HandbookConfig` and write it from `normalize.py`, so the YAML is
source-of-truth and re-runs are stable.

## Migration path

1. Add `bookmark_chapter_filter` field to `HandbookConfig` and apply it
   in `parse_outline` (filter L1 entries + their descendants when set).
2. Add `primary_cert` round-trip:
   - `HandbookConfig.primary_cert: str | None` in `config_loader.py`
   - YAML loader reads/validates the value
   - `normalize.py` writes it to manifest alongside `subjects`
3. Author `scripts/sources/config/handbooks/risk-management.yaml`
   modeled on `avwx.yaml`. Set `outline_strategy: bookmark`,
   `bookmark_chapter_filter: '^(Chapter \d+|Appendix [A-Z])\b'`,
   `subjects: [human-factors]`, `primary_cert: private`.
4. Run `bun run sources extract handbooks risk-management` -- produces
   per-chapter dirs + per-section markdowns + `manifest.json` with
   `kind: 'handbook'` and `sections[]` populated.
5. Remove old whole-doc body file:
   `handbooks/risk-management/FAA-H-8083-2A/risk-management-FAA-H-8083-2A.md`.
6. Remove `risk-management` row from `handbooks-extras.yaml`.
7. Remove `'faa-h-8083-2'` from `DOC_ID_TO_FRIENDLY` and
   `'risk-management'` from `FRIENDLY_DISPLAY` in
   `libs/sources/src/handbooks-extras/ingest.ts`.
8. Update tests: drop `faa-h-8083-2` from the `DOC_ID_TO_FRIENDLY`
   expected list, change live-cache count `5 -> 4`, drop
   `risk-management` from the slug-existence assertion.
9. Update `docs/platform/REFERENCES.md`: RMH row from
   "⚠️ readable, whole-doc" to "✅ readable, section-tree".
10. Run `bun run check` + relevant unit tests + `bun run db reset
    --force` + `bun run db seed` to confirm end-to-end.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Acceptance

- `handbooks/risk-management/FAA-H-8083-2A/manifest.json` has
  `kind: 'handbook'`, `sections[]` with chapter + section + subsection
  rows
- `study.reference_section` after `db seed` has at least 12 chapter
  rows (8 numbered chapters + 4 appendices)
- `/library` RMH card shows chapter drill-down
- `getReadableReferenceIds()` returns the RMH reference id
- handbooks-extras tests pass with updated expectations (4 active
  entries)
- `bun run check` clean
