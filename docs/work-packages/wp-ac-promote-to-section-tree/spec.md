---
title: 'Spec: WP-AC-PROMOTE -- promote the 9 existing ACs from whole-doc to section-tree'
product: study
feature: wp-ac-promote-to-section-tree
type: spec
status: shipped
review_status: pending
shipped_at: 2026-05-03
---

# WP-AC-PROMOTE: promote 9 existing ACs to section-tree

WP-AC (#480) shipped 9 Advisory Circulars as whole-doc references. Per the user's "no more whole-docs" direction (2026-05-03), promote each to section-tree shape based on the AC's internal structure.

This is a Wave 4 cleanup WP. Pre-condition: all 5 handbook section-tree promotions land first (those establish the section-tree extraction patterns this WP reuses).

## In scope: 9 ACs

| FAA number | DB slug | Common name | Page count (approx) |
|------------|---------|-------------|---------------------|
| AC 00-6B | ac-00-6 | Aviation Weather | 296 |
| AC 25-7D | ac-25-7 | Flight Test Guide for Transport Category Airplanes | 600 |
| AC 61-65J | ac-61-65 | Certification: Pilots and Flight/Ground Instructors | 80 |
| AC 61-83J | ac-61-83 | Industry-Conducted Flight Instructor Refresher Course | 30 |
| AC 61-98D | ac-61-98 | Flight Review and IPC Currency | 25 |
| AC 90-66C | ac-90-66 | Non-Towered Airport Flight Operations | 30 |
| AC 91-21.1D | ac-91-21-1 | Use of Portable Electronic Devices Aboard Aircraft | 15 |
| AC 91-79A | ac-91-79 | Mitigating Runway Overrun | 20 |
| AC 120-71B | ac-120-71 | SOPs and Pilot Monitoring Duties | 30 |

## Per-AC strategy

Each AC's PDF needs to be examined for:
1. Embedded TOC (`fitz.get_toc()`)
2. Printed TOC page
3. Internal heading structure

Apply the closest precedent strategy from the 5 handbook promotions:

- **bookmark extraction** (RMH precedent): if the AC has rich embedded outline
- **printed TOC parse** (PHAK/AFH precedent): if no embedded TOC but a clean printed one
- **TOC-file parser** (IFH precedent): if neither; hand-extract a TOC for parser input
- **flat single-section** (fallback): for very short ACs (< 20 pages) where chapter-level granularity adds no value; just split by H1 headings if any

AC 25-7D (600 pages, transport-category cert) is the outlier — engineering doc that may not be pilot-facing enough to warrant deep section parsing. Decide per-AC during the WP whether to fully section-tree it or leave at chapter-only depth.

## Phases

### Phase 1: Per-AC research

Mirror `docs/work-packages/whole-doc-promotion/research.md` shape. For each AC:
- Open the cached PDF
- Run `fitz.get_toc()`
- Inspect the printed TOC if no embedded
- Decide strategy
- Estimate effort

### Phase 2: Update AC ingest pipeline

The current AC seeder (#480) is whole-doc only. Extend to support section-tree shape:
- Schema: keep `kind: 'ac'` but add optional `sections[]` array (mirrors handbooks shape)
- Seeder: branch on `sections.length === 0` (whole-doc behavior — preserved) vs `sections.length > 0` (new section-tree behavior)
- Manifest writer: emit `sections[]` when extraction produces them

### Phase 3: Per-AC extraction

Run extraction per the strategy chosen in Phase 1. Idempotent — only writes the manifest if the body changed.

### Phase 4: Verify

```bash
bun run check
bun test libs/bc/study/src/seeders/ac.test.ts
bun run db reset --force && bun run db seed
```

Expected: all 9 ACs render in flightbag with chapter/section drill-down (or single-page if the strategy was "flat").

### Phase 5: Doc updates

- REFERENCES.md: AC table flips all 9 from "✅ readable, whole-doc" to "✅ readable, section-tree"
- AC card YAML rows update if needed
- Status.md entry

## Out of scope

- The 12 link-only AC cards — covered by WP-AC-LINK-ONLY (separate WP)
- Removing `kind: 'whole-doc'` from manifest schema — happens via WP-EXTRAS-RETIRE after handbooks-extras corpus is empty

## Anchors

- [PR #480 WP-AC-V](https://github.com/joshball/airboss/pull/480) — current whole-doc seeder
- [docs/work-packages/whole-doc-promotion/research.md](../whole-doc-promotion/research.md) — handbook promotion strategy precedents
- [WP-AC-LINK-ONLY](../wp-ac-link-only-pipeline/spec.md) — separate WP for the 12 missing ACs
