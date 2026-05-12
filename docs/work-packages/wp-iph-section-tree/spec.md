---
id: wp-iph-section-tree
title: WP-IPH -- Promote Instrument Procedures Handbook to section-tree
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
  - iph
  - handbook
  - section-tree
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# WP-IPH -- Promote Instrument Procedures Handbook to section-tree

**Status:** shipped (PR pending)
**Date:** 2026-05-02
**Branch:** `feat/wp-iph-section-tree`

## Overview

Promote the Instrument Procedures Handbook (IPH, FAA-H-8083-16B) from the
Class C whole-doc shape (one big body markdown, empty `sections[]`) to the
Class A2 chapter-aware shape (per-chapter PDFs + ancillaries, populated
`sections[]`). Mirrors the migration shapes already used by AFH (Class A2
sibling) and AVWX (Class C section-tree precedent).

After this WP lands, IPH gains:

- A real `scripts/sources/config/handbooks/iph.yaml` config file (was a
  whole-doc-only row in `handbooks-extras.yaml`).
- 7 chapter PDFs cached at `~/Documents/airboss-handbook-cache/handbooks/iph/FAA-H-8083-16B/FAA-H-8083-16B-ch01..07.pdf`.
- Ancillary PDFs (front, summary-of-changes-as-front, TOC, glossary,
  appendix-a, appendix-b) downloaded alongside.
- Per-chapter / per-section markdown derivatives and a populated
  `sections[]` array in the in-repo manifest.
- Library / citations / cited-by behavior identical to AFH: chapter,
  section, and subsection locators all resolve to typed bodies.

## Why

Per the whole-doc-promotion research doc (`docs/work-packages/whole-doc-promotion/research.md` -- §IPH):

- IPH ships per-chapter PDFs at the publisher's index page (7 chapters,
  no zero-padding: `FAA-H-8083-16B_Chapter_<N>.pdf`).
- The whole-doc PDF carries a printed Table of Contents at PDF pages
  12-16 (5 pages, full section depth). The standalone TOC PDF is the
  same content; we treat the printed range inside the whole-doc PDF as
  the source of truth for section depth so the parser surface stays
  flat (no new "external TOC PDF" config field needed).
- The embedded PyMuPDF outline only carries L1 chapters (14 entries,
  depth 1), so `outline_strategy: bookmark` would lose depth-2 and
  depth-3 entries. The TOC parse fills that gap, identical pattern to
  AFH.

Class A2 is the right shape because the chapter PDFs exist; staying
Class C would re-parse the whole-doc PDF for every chapter and drop the
truncation safeguards that the chapter-PDF mode in `chapter_plaintext.py`
provides (per ADR 022 / chapter-source-ingestion WP).

## Scope

In scope:

- Author `scripts/sources/config/handbooks/iph.yaml` with
  `chapter_pdfs.direct_pattern`, 7 chapters, file-ordinal offset 0
  (the IPH naming uses chapter ordinal directly, no front-matter prefix
  in the filename), and a `toc:` block pointing at PDF pp. 12-16.
- Remove the `faa-h-8083-16` row from
  `scripts/sources/config/handbooks-extras.yaml`.
- Remove `'faa-h-8083-16': { slug: 'iph', ... }` from
  `DOC_ID_TO_FRIENDLY` and `iph: { short: 'IPH', formal: '...' }` from
  the `FRIENDLY_DISPLAY` table in
  `libs/sources/src/handbooks-extras/ingest.ts`.
- Drop the existing whole-doc derivative
  `handbooks/iph/FAA-H-8083-16B/iph-FAA-H-8083-16B.md` (replaced by the
  per-chapter / per-section tree the new ingest writes).
- Drop the IPH row from `handbooks/handbooks-extras-index.json`. (The
  Class A2 ingest does not use this index.)
- Run `bun run sources download --only handbooks` to fetch the chapter
  PDFs into the source cache, then run `bun run sources extract
  handbooks iph --edition FAA-H-8083-16B` to write the new derivative
  tree.
- Update the smoke-test count in
  `libs/sources/src/handbooks-extras/ingest.test.ts` (`expect(report.ingested).toBe(5)` → 4) and the
  `DOC_ID_TO_FRIENDLY` coverage assertion list.
- Update `docs/platform/REFERENCES.md`: IPH row from "⚠️ readable,
  whole-doc" → "✅ readable, section-tree" with chapter / section
  counts.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Strategy summary

- **Class**: A2 (chapter PDFs + ancillaries).
- **`outline_strategy`**: `content`. The chapter PDFs have empty
  PyMuPDF outlines, and the whole-doc PDF's outline is L1-only; the
  content scanner derives the chapter list from FAA-style page footers
  the same way AFH does.
- **`section_strategy`**: `toc`. Printed TOC at PDF pp. 12-16 inside
  the whole-doc PDF. The standalone `FAA-H-8083-16B_Table_of_Contents.pdf`
  is added as a `kind: toc` ancillary so it lands in the cache for
  audit, but the parser reads from the whole-doc TOC range.
- **TOC `pattern`**: `dotted_leader`. The printed IPH TOC uses
  dotted-leader formatting (`title ........ 1-2`), unlike AFH's
  right-column form.
- **Ancillaries**: `front` (Front_Cover + Front_Page combined), `toc`
  (the standalone TOC PDF), `glossary`, two appendices.

## File-ordinal layout

IPH's filenames use the bare chapter ordinal:
`FAA-H-8083-16B_Chapter_1.pdf` ... `FAA-H-8083-16B_Chapter_7.pdf`.

`direct_pattern` substitution: `{N}` is the chapter ordinal (1..7);
`{NN}` is the zero-padded `N + file_ordinal_offset`. With
`file_ordinal_offset: 0` and the pattern using only `{N}`, this works
out-of-the-box. No schema change required.

## URL inventory (verified by HEAD 2026-05-03 per research doc)

| Asset              | URL                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Whole-doc PDF      | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B.pdf`                      |
| Chapter 1..7 PDFs  | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B_Chapter_<N>.pdf`          |
| Front Cover PDF    | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B_Front_Cover.pdf`          |
| Front Page PDF     | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B_Front_Page.pdf`           |
| Summary of Changes | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B-3_Summary_of_Changes.pdf` |
| TOC PDF            | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B_Table_of_Contents.pdf`    |
| Appendix A         | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B_Appendix_A.pdf`           |
| Appendix B         | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B_Appendix_B.pdf`           |
| Glossary           | `https://www.faa.gov/.../instrument_procedures_handbook/FAA-H-8083-16B_Glossary.pdf`             |

(Truncated `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/`
for table readability.)

The downloader's existing `kind` enum (`front | toc | glossary | index | appendix`)
covers everything except `Summary_of_Changes`; that is treated as a `front`
extension or omitted from the YAML. Because `front` already maps to a single
PDF in AFH, we wire the IPH `Front_Page.pdf` as the `front` ancillary and skip
`Front_Cover.pdf` + `Summary_of_Changes` from the cached inventory (they are
duplicated in the whole-doc PDF and not load-bearing for derivative emission).

## Manifest expectations (post-extract)

- `kind: handbook` (not `whole-doc`).
- `sections[]` populated with one entry per chapter (7), one per section
  (TOC count, ~80 in chapter 4 alone), and subsection rows where the
  TOC depth permits (3-level cap; deeper TOC nesting flattens).
- `body_path` removed (each section now has its own `body_path`).
- `subjects: [procedures, navigation, flight-instruments]`,
  `primary_cert: instrument` carried through.

## References

- [research.md](../whole-doc-promotion/research.md) §IPH
- [ADR 022 chapter-source-ingestion](../../decisions/022-chapter-source-ingestion/decision.md)
- [ADR 021 source cache flat naming](../../decisions/021-source-cache-flat-naming/decision.md)
- [scripts/sources/config/handbooks/afh.yaml](../../../scripts/sources/config/handbooks/afh.yaml) -- Class A2 precedent
- [docs/ingestion-pipeline/section-extraction-strategies.md](../../ingestion-pipeline/section-extraction-strategies.md)
