---
title: 'WP-AIM -- AIM seeded as section-tree reference'
product: study
feature: wp-aim
type: spec
status: unread
review_status: pending
created: 2026-05-02
---

# WP-AIM -- Aeronautical Information Manual

Sequence position 3 in [library-completeness](../library-completeness/spec.md). The AIM is already extracted (745 entries on disk under `aim/2026-04/`); this WP wires it through the post-WP-SUB seeder so it lands in `/library` as a readable card with a chapter-tree expansion (per spec §3.C).

## Goal

`/library` shows one *Aeronautical Information Manual* card. Click-through opens the chapter index; chapters expand into sections; sections expand into paragraphs. Each leaf renders the extracted markdown.

## Source

- Already cached + extracted: `aim/2026-04/manifest.json` + per-chapter / per-section / per-paragraph markdown files.
- Manifest covers 745 entries across kinds: `chapter`, `section`, `paragraph`, `appendix`, `glossary`.
- Source URL: `https://www.faa.gov/air_traffic/publications/media/aim.pdf`.

## Decisions (taken at WP author time)

- **Corpus**: `aim` (existing, not `handbooks`). The corpus dir, resolver, locator, citation, and URL helpers already exist at `libs/sources/src/aim/`. They're done.
- **Manifest shape**: `kind: 'aim'` is its own member of the discriminated union -- **not** reused as `kind: 'handbook'` because the AIM has its own level vocabulary (`chapter`/`section`/`paragraph`/`appendix`/`glossary`) and asymmetric depth (PCG glossary entries are flat; chapters go 3 deep). Per [WP-SUB spec §1 step 4](../library-substrate/spec.md): each manifest shape is a discriminator member, dispatched to its own seed adapter. AIM gets a new `aimManifestSchema` and a new `seeders/aim.ts` adapter.
- **`section_schema`**: `{ levels: ['chapter', 'section', 'paragraph', 'appendix', 'glossary'], strict_sequence: false }`. Asymmetric -- glossary entries sit at depth 0 alongside chapters, and the depth/level mapping varies. Loose form is correct.
- **Slug**: `aim`.
- **Edition**: `2026-04` (matches the on-disk manifest + the FAA's 28-day cycle).
- **`subjects`**: `['regulations', 'procedures', 'navigation']` (3, under the cap). The AIM is the operational rulebook companion to 14 CFR; these three topics dominate.
- **`primary_cert`**: `null` (cert-agnostic; relevant from PPL through ATP).

## Touch list

| Layer                                                      | Change                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `libs/bc/study/src/manifest-validation.ts`                | Add `aimManifestSchema` (discriminated union member with `kind: 'aim'`); export `AimManifest` type    |
| `libs/bc/study/src/manifest-validation.ts`                | Extend the `manifestSchema = z.discriminatedUnion('kind', [...])` to include the new schema          |
| `libs/bc/study/src/seeders/aim.ts`                        | New seed adapter: walks `entries[]`, builds parent/child tree by code prefix, produces `reference_section` rows |
| `libs/bc/study/src/seeders/types.ts`                      | (No change expected; reuses existing `SeedContext` + `SeedSummary`)                                   |
| `scripts/db/seed-references-from-manifest.ts`             | Add `case 'aim': return seedAimManifest(...)` to the dispatch switch                                  |
| `scripts/db/seed-references-from-manifest.ts`             | Add `'aim'` to `CORPUS_DIRS` so the seeder walks `aim/` as well as `handbooks/`                       |
| `aim/2026-04/manifest.json`                               | Backfill `subjects: ['regulations', 'procedures', 'navigation']` + `primary_cert: null`               |
| `aim/2026-04/manifest.json`                               | Add `document_slug: 'aim'` if absent (the existing manifest may not declare one explicitly)           |
| `course/references/handbooks-noningested.yaml` or similar | Drop any AIM placeholder row that's link-only (the pipeline now seeds the real one)                  |

## Tree-building strategy

The manifest's `entries[]` is flat. Build the parent/child tree from the `code` field:

- A `chapter` entry has `code` like `"1"`, `"7"`, `"9"`. Depth 0, parent_id null.
- A `section` entry has `code` like `"1-1"`, `"7-3"`. Depth 1; parent is the chapter whose code matches the prefix before the dash (`"1-1".split("-")[0]` -> `"1"`).
- A `paragraph` entry has `code` like `"1-1-3"`. Depth 2; parent is the matching section.
- An `appendix` entry has `code` like `"appendix-1"`. Depth 0, parent_id null. Treated as a top-level peer of chapters.
- A `glossary` entry has `code` like `"pilot-controller-glossary"` or per-letter buckets. Depth 0, parent_id null.

The seeder walks entries in two passes: first pass builds the depth-0 row (the AIM whole-doc index page); second pass walks `entries[]` in order, looks up parents from a `code -> id` map populated as the seed proceeds. Idempotent on `content_hash`.

## Acceptance

- `bun run db reset --force && bun run db seed` runs clean.
- Exactly one `study.reference` row for `(document_slug='aim', edition='2026-04')`.
- 745 `study.reference_section` rows exist, with parent/child structure intact:
  - 10 chapters at depth 0 (codes 1-10, 11 in newer editions)
  - ~80 sections at depth 1
  - ~600 paragraphs at depth 2
  - Appendix + glossary entries at depth 0
- `getReadableReferenceIds()` returns the AIM reference id.
- `/library` shows the *Aeronautical Information Manual* card as readable.
- Click-through renders the chapter list; click a chapter renders its section list; click a section renders the paragraph body.
- `bun run check` clean.
- `bun test` green (new `aimManifestSchema` smoke test in `manifest-validation.test.ts`; new seed integration test in `seed-references-from-manifest.test.ts`).

## Out of scope

- AIM **search** UI (per library-completeness spec §3, AIM is browsable; CFR is search-first because of its 7,218-section scale; AIM at 745 entries browses fine).
- AIM **figures/tables** extraction beyond what's already in the manifest. The existing extracted markdown is the source of truth.
- Cross-references between AIM and CFR. Lands when WP-CFR ships.
- Cross-edition migration: the AIM publishes every 28 days. Mid-edition refresh is its own future WP.

## Pre-existing risk

`libs/sources/src/aim/` already exists -- resolver, locator, citation, ingest. This WP doesn't touch the source side. If the seed adapter discovers that the manifest's `entries[]` has codes the resolver can't resolve (e.g. the resolver expects `pcg-letter-a` but the manifest writes `pilot-controller-glossary-a`), I'll surface that as a finding and stop, not silently bridge.
