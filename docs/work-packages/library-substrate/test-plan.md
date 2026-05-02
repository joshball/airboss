---
title: 'Library substrate -- test plan'
product: study
feature: library-substrate
type: test-plan
status: shipped
---

# WP-SUB test plan

A substrate rename plus one new seed path. Tests fall into three buckets: substrate equivalence (existing behavior preserved), new whole-doc path (new behavior verified), and route/UI integration (the cert/topic/regulations spines stay green).

## Pre-flight

Run on a freshly-reset DB (`bun run db reset && bun run db seed`). Every test below assumes a clean post-seed state unless stated otherwise.

## Substrate equivalence (existing behavior preserved)

### Schema

- [ ] **`reference_section` table exists** with columns: `id`, `reference_id`, `parent_id`, `ordinal`, `depth`, `level`, `code`, `title`, `content_md`, `content_hash`, `faa_page_start`, `faa_page_end`, `source_locator`, `has_figures`, `has_tables`, `metadata`, `seed_origin`, `created_at`, `updated_at`.
- [ ] **`handbook_section` table does NOT exist** (rename completed; no leftover Drizzle generated DROP/CREATE state).
- [ ] **`reference.section_schema` and `reference.metadata` jsonb columns exist** with default `'{}'`.
- [ ] **`reference.primary_cert` column unchanged from PR #386.** CHECK against `CERT_APPLICABILITY_VALUES` still in place.
- [ ] **CHECKs dropped:** `reference_kind_check`, `reference_section_level_check`, `reference_section_code_shape_check`, `reference_section_parent_level_check` should all return zero rows from `pg_constraint` after seed.
- [ ] **CHECKs preserved:** `ordinal >= 0`, `faa_pages_check`, `document_slug_shape_check`, `edition_length_check`, `subjects_values_check`, `primary_cert_check`.

### Seed counts (the substrate's job is to reproduce these)

- [ ] PHAK FAA-H-8083-25C: ~850 `reference_section` rows.
- [ ] AFH FAA-H-8083-3C: ~531 rows.
- [ ] AVWX FAA-H-8083-28B: ~480 rows.
- [ ] Risk Management FAA-H-8083-2A: **1 row** at level `document`, depth 0, with `content_md` non-empty.
- [ ] Aviation Instructor FAA-H-8083-9: 1 row, same shape.
- [ ] IFH FAA-H-8083-15B: 1 row.
- [ ] IPH FAA-H-8083-16B: 1 row.
- [ ] AMT-G FAA-H-8083-30B: 1 row.
- [ ] AMT-P FAA-H-8083-32B: 1 row.

Total: 9 reference rows for handbooks + ~1,861 + 6 = ~1,867 `reference_section` rows.

### Idempotence

- [ ] Re-run `bun scripts/db/seed-references-from-manifest.ts` against an already-seeded DB. `sectionsTouched > 0`, `sectionsChanged == 0` (per the seeder summary).
- [ ] Modify one section's `content_md` in `handbooks/phak/.../01/index.md`, recompute the manifest's `content_hash`, re-seed. `sectionsChanged == 1`. The other ~849 PHAK rows are unchanged.

### Read state

- [ ] Mark a section as read via the existing API. Row appears in `reference_section_read_state` with the renamed FK column (`reference_section_id`).
- [ ] Re-seed the handbook (`bun scripts/db/seed-references-from-manifest.ts phak`). Read-state row survives if `(reference_id, code)` is preserved across re-seeds (which it is per the existing `unique(reference_id, code)` index).

## New whole-doc path (new behavior)

### Manifest validation

- [ ] **Section-tree manifest validates.** Parse `handbooks/phak/FAA-H-8083-25C/manifest.json` through `manifestSchema` -- succeeds with discriminator `kind: 'handbook'`.
- [ ] **Whole-doc manifest validates.** Parse `handbooks/risk-management/FAA-H-8083-2A/manifest.json` -- succeeds with discriminator `kind: 'whole-doc'`.
- [ ] **Manifest with missing `kind` rejected.** Smoke test: hand-craft an object without the field, parse fails with a clear discriminator error.
- [ ] **Manifest with unknown `kind` rejected.** Hand-craft `kind: 'something-else'`, parse fails.
- [ ] **Whole-doc with extra `sections` array rejected.** The discriminated union should not accept it.
- [ ] **Section-tree without `sections` rejected.** Same.

### Whole-doc seed

- [ ] Risk Management seed produces:
    - 1 `reference` row, `kind = 'handbook'`, `section_schema = { levels: ['document'], strict_sequence: true }`.
    - 1 `reference_section` row: `level = 'document'`, `depth = 0`, `code = '1'`, `parent_id = NULL`, `content_md` matches the body file contents.
    - `content_hash` matches `body_sha256` from the manifest.
- [ ] All 6 whole-doc handbooks repeat the above pattern.
- [ ] If `body_path` file is missing, seed errors clearly (not a silent success with empty `content_md`).

### Mixed-shape directory

- [ ] `handbooks/` contains both kinds. Seeding the whole directory walks all 9 manifests without skipping or erroring on the kind mismatch.

## Readability probe

- [ ] `getReadableReferenceIds([all 9 handbook IDs])` returns a set of size 9.
- [ ] Pre-substrate equivalence: any reference that returned `true` from the old probe still returns `true`. Any reference that returned `false` (because no rows existed at all) still returns `false`.
- [ ] Whole-doc handbooks now return `true` (the gap closure).

## Route + UI integration

### Library landing page

- [ ] `/library` renders the four-spine landing (cert / topic / regulations / aircraft) with non-zero counts on each card.

### Cert spine

- [ ] `/library/cert/private` lists references including PHAK + Risk Management. Both show as `isReadable: true`.
- [ ] `/library/cert/instrument` lists IFH + IPH. Both show as `isReadable: true`.
- [ ] `/library/cert/cfi` lists Aviation Instructor's Handbook. Shows as `isReadable: true`.
- [ ] Click into a cert card -> navigates to the corresponding reader without a 500.

### Topic spine

- [ ] `/library/topic/aerodynamics` lists references including PHAK + AFH. Readable.
- [ ] `/library/topic/human-factors` lists Risk Management + Aviation Instructor's Handbook. Readable.

### Regulations spine

- [ ] `/library/regulations/cfr` renders. Cards present, even though no CFR rows exist in `reference_section` yet (this WP doesn't seed CFR -- that's WP-CFR-V).

### Handbook reader

- [ ] `/library/handbook/phak` -- TOC renders all chapters.
- [ ] `/library/handbook/phak/01` -- chapter 1 renders.
- [ ] `/library/handbook/phak/01/01-purpose-of-flight-training` (or whatever the first section slug is) -- body content renders, figures present.
- [ ] `/library/handbook/risk-management` -- the whole-doc reader renders the document body. (UI may need a tweak to handle a single-row reference; flag if not.)

## Lens routes

- [ ] `/lens/handbook/phak/01` -- the lens-side reader still works (it shares the substrate).

## Existing test suites

- [ ] `bun test` -- all green. Specifically:
    - `libs/bc/study/src/handbooks.test.ts` -> renamed to `references.test.ts`, all assertions pass.
    - `libs/bc/study/src/handbooks-errata.test.ts` -- import names updated, assertions pass.
    - `libs/bc/study/src/library-by-cert.test.ts` -- unchanged in structure, passes.
    - `libs/bc/study/src/library-by-cert.orphan.test.ts` -- passes.
    - `scripts/db/seed-handbooks.test.ts` -> renamed, passes.
- [ ] `bun playwright test` -- all green:
    - `tests/e2e/library-by-cert.spec.ts` -- passes unchanged.
    - `tests/e2e/handbook-reader.spec.ts` -- passes; only fixture-loading column references change.
    - `tests/e2e/handbook-amendment.spec.ts` -- passes.

## Manual sanity

- [ ] `bun run dev` -- app boots without warnings about renamed tables.
- [ ] Open one new whole-doc handbook in the browser. Confirm body renders, scroll position works, no console errors.
- [ ] `bun run db seed handbooks` from a fresh `db reset`, then immediately again -- second run is a no-op summary (`sectionsChanged: 0`).

## Negative checks

- [ ] Grep for stale references -- `grep -r "handbook_section\|handbookSection\|HandbookSection\|HANDBOOK_SECTION" --include="*.ts" --include="*.svelte" apps/ libs/ scripts/ tests/` returns only:
    - Comments referring to historical context (acceptable).
    - Generated `.svelte-kit/types/` files (cleared on next `svelte-kit sync`).
- [ ] Grep for stale ID prefix -- `grep -r "hbs_" libs/ scripts/` returns zero hits in source code (test fixtures may need updating).
- [ ] No `// removed`, `// TODO(retire)`, or commented-out code blocks introduced by the rename.

## Rollback

Pre-launch, no production data. If WP-SUB ships and surfaces an issue:

1. Revert the PR.
2. `bun run db reset && bun run db seed`.
3. Old schema names back in place.

The squash-and-reset workflow makes rollback genuinely trivial.
