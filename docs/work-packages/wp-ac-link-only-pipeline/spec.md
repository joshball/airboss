---
title: 'Spec: WP-AC-LINK-ONLY -- link-only stubs for the 12 link-only AC cards'
product: study
feature: wp-ac-link-only-pipeline
type: spec
status: shipped
review_status: done
---

# WP-AC-LINK-ONLY: link-only stubs for the 12 link-only AC cards

> **Wave 6 scope (shipped 2026-05-03):** stage-1 (Sourced) stubs only. The 12
> Advisory Circulars already had `study.reference` rows seeded from
> `course/references/advisory-circulars.yaml`, but no `url:` field, so library
> cards and citation chips fell back to the FAA AC index landing page. This WP
> added the canonical FAA Document Library PDF URL to each of the 12 YAML
> rows so chips and library cards now deep-link to the source PDF directly.
> Body extraction + section-tree (the "full pipeline" originally scoped below)
> moves to **WP-AC-FULL** (Wave 8 deferred per `REFERENCES_ROADMAP.md`).
>
> The text below is the original ambition; preserved as the design target for
> WP-AC-FULL. Wave 6 deliberately ships the cheap stubs first.

Build the download → extract → register → seed pipeline for the 12 Advisory Circulars currently link-only on `/library`. Pattern is established by WP-AC (#480) and the 9 already-seeded ACs; this WP just expands the cached corpus.

## In scope

The 12 AC cards in `course/references/advisory-circulars.yaml` that have no on-disk manifest:

| Card slug | FAA number | Common name |
|-----------|-----------|-------------|
| ac-00-24 | AC 00-24 | Thunderstorms |
| ac-00-45 | AC 00-45 | Aviation Weather Services |
| ac-60-22 | AC 60-22 | Aeronautical Decision Making |
| ac-61-27 | AC 61-27 | Instrument Flying Handbook (legacy AC superseded by FAA-H-8083-15) |
| ac-61-67 | AC 61-67 | Stall and Spin Awareness Training |
| ac-61-84 | AC 61-84 | Role of Preflight Preparation |
| ac-61-134 | AC 61-134 | GA Controlled Flight Into Terrain Awareness |
| ac-90-100 | AC 90-100 | RNAV Operations |
| ac-91-23 | AC 91-23 | Pilot's Weight and Balance Handbook |
| ac-91-44 | AC 91-44 | ELT Maintenance Practices |
| ac-91-74 | AC 91-74 | Flight in Icing Conditions |
| ac-91-75 | AC 91-75 | Attitude Indicator |

## Decisions

### AC 61-27 — superseded; ingest or drop?

AC 61-27 was the original Instrument Flying Handbook AC; it's been superseded by FAA-H-8083-15. Two paths:

- (a) Ingest anyway — it's still cited in some legacy training materials
- (b) Drop the YAML card entirely — the citation should redirect to FAA-H-8083-15

**Recommendation: (b) drop.** Knowledge nodes citing AC 61-27 are out of date; rewriting them to reference FAA-H-8083-15 is the right cleanup. If the citation must stay (regulatory-historical reference), keep the link-only card and don't ingest.

### Section-tree vs whole-doc

Per the user's "no more whole-docs" direction (2026-05-03), every AC ingested in this WP should land as section-tree shape. Existing 9 ACs from #480 are whole-doc; they'll be promoted by a separate WP-AC-PROMOTE.

For the 12 new ones, run the section-tree extraction during ingest. Strategies:
- Embedded TOC via PyMuPDF — for ACs that have one
- Printed TOC parse — for ACs with a visible TOC page
- Single-page-per-section flat tree — for very short ACs (< 20 pages) where chapter-level granularity is overkill

Determine per-AC during ingest. The pipeline branches on what the PDF actually has.

## Phases

### Phase 1: Add 12 entries to `scripts/sources/config/ac.yaml`

Source URLs from FAA Document Library (`https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_<NN>-<NN>.pdf`).

### Phase 2: Download

```bash
bun run sources download --only ac
```

12 new PDFs cached.

### Phase 3: Extract + section-tree per AC

Per-AC strategy decision (embedded TOC / printed TOC / flat). Run extract.

### Phase 4: Register

```bash
bun run sources register ac
```

Manifests with `kind: 'ac'` written; section trees populated.

### Phase 5: Seed verification

```bash
bun run db reset --force && bun run db seed
```

12 new readable references on `/library`. Each with section-level drill-down.

### Phase 6: Tests + docs

- Manifest validation tests for any new section-tree-shaped AC manifests
- Update REFERENCES.md: 12 link-only rows flip to readable section-tree
- Update library-completeness status.md

## Out of scope

- Promoting the existing 9 ACs from whole-doc to section-tree (separate WP-AC-PROMOTE)
- Discovery of additional ACs beyond these 12 (separate WP-AC-FULL spec exists; expansion to ~50 ACs)

## Anchors

- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) — full AC table
- [docs/work-packages/library-completeness/status.md](../library-completeness/status.md) — sequencing
- [PR #480](https://github.com/joshball/airboss/pull/480) — WP-AC pattern (whole-doc adapter; same dispatcher works for section-tree)
