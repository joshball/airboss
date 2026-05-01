---
title: 'Library substrate -- tasks'
product: study
feature: library-substrate
type: tasks
status: unread
---

# WP-SUB tasks

Single PR. Tasks are sequenced so the tree compiles and tests run after each phase, but a single squash commit at the end is the shipping unit.

## Phase A -- Schema rename + new columns

- [ ] `libs/bc/study/src/schema.ts`: rename `handbookSection` -> `referenceSection`, `handbookFigure` -> `referenceFigure`, `handbookSectionErrata` -> `referenceSectionErrata`, `handbookReadState` -> `referenceSectionReadState`. Rename inner SQL table names and all index/CHECK constraint names.
- [ ] Drop the `kind` CHECK on `reference`.
- [ ] Drop `handbook_section_level_check`, `handbook_section_code_shape_check`, `handbook_section_parent_level_check`.
- [ ] Add `reference.section_schema jsonb NOT NULL DEFAULT '{}'::jsonb`.
- [ ] Add `reference.metadata jsonb NOT NULL DEFAULT '{}'::jsonb`.
- [ ] Add `reference_section.depth int NOT NULL`.
- [ ] Add `reference_section.metadata jsonb NOT NULL DEFAULT '{}'::jsonb`.
- [ ] Update type exports: `HandbookSectionRow` -> `ReferenceSectionRow`, etc.
- [ ] `libs/utils/src/ids.ts`: `hbs_` -> `refsec_` (per ratify SUB.1 default).
- [ ] `libs/constants/src/study.ts`: `HANDBOOK_SECTION_*` -> `REFERENCE_SECTION_*` constants. Update doc comments that mention `handbook_section`.

## Phase B -- BC + seeders

- [ ] Rename `libs/bc/study/src/handbooks.ts` -> `references.ts` (or split: section/edition/read-state into `references.ts`, errata into `errata.ts`). Update barrel.
- [ ] `libs/bc/study/src/handbook-validation.ts` -> `manifest-validation.ts`. Add `wholeDocManifestSchema`. Replace single export with `manifestSchema = z.discriminatedUnion('kind', [sectionTree, wholeDoc])`.
- [ ] Rewrite `getReadableReferenceIds()` to probe `content_md IS NOT NULL AND content_md <> ''`.
- [ ] `scripts/db/seed-handbooks.ts` -> `scripts/db/seed-references-from-manifest.ts`. Refactor into:
    - `seed-references-from-manifest.ts` -- entry point + dispatch
    - `libs/bc/study/src/seeders/handbooks-section-tree.ts` -- existing logic
    - `libs/bc/study/src/seeders/handbooks-whole-doc.ts` -- new logic
- [ ] Whole-doc seeder reads `body_path`, upserts reference (preserving `subjects` + `primary_cert` from prior YAML seed), upserts single `reference_section` row at depth 0 / level `document` / code `1`.
- [ ] Set `reference.section_schema` per manifest kind on every upsert.
- [ ] Update `scripts/db/seed-all.ts` to call the renamed entry point.
- [ ] Confirm `scripts/db/seed-references.ts` (YAML seeder) needs zero changes.

## Phase C -- Routes + UI

- [ ] Update every `apps/study/src/routes/(app)/library/**` import from `@ab/bc-study` -- the BC barrel exports flip names; routes import the new names.
- [ ] `libs/ui/src/handbooks/HandbookSectionListItem.svelte` -- rename component to `ReferenceSectionListItem.svelte` (or keep handbook-named; it's UI-specific). Default: rename for consistency.
- [ ] `apps/study/src/lib/help/content/library.ts` -- update any prose referencing `handbook_section`.
- [ ] Verify `apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]` still works -- the lens routes share the substrate.

## Phase D -- External-URL resolver move (smell #4)

- [ ] `libs/sources/src/registry/corpus-resolver.ts` -- add `externalUrlFor(reference)` to the resolver protocol.
- [ ] Implement `externalUrlFor` on each corpus resolver: handbooks, aim, ac, acs, regs.
- [ ] Update library route loaders to call `resolverFor(kind).externalUrlFor(ref)` instead of `externalUrlForReference(kind, slug, edition, url)`.
- [ ] Delete `externalUrlForReference()` from `libs/constants/src/study.ts`.

## Phase E -- Tests

- [ ] `libs/bc/study/src/seeders/handbooks-section-tree.test.ts` (renamed from `seed-handbooks.test.ts`): assert section-tree manifest produces N rows, parent_id chains correct, content_hash idempotent.
- [ ] `libs/bc/study/src/seeders/handbooks-whole-doc.test.ts` (new): assert whole-doc manifest produces 1 row at depth 0 with content_md populated, idempotent on re-run.
- [ ] `libs/bc/study/src/references.test.ts` (renamed from `handbooks.test.ts`): assert `getReadableReferenceIds()` returns reference IDs for both section-tree handbooks and whole-doc handbooks.
- [ ] Update `tests/e2e/handbook-reader.spec.ts`, `tests/e2e/handbook-amendment.spec.ts`, `tests/e2e/library-by-cert.spec.ts` -- only the names imported from `@ab/bc-study` change; assertions stay identical.
- [ ] `tests/e2e/seed-errata.ts` -- rename column references.
- [ ] Add a smoke test in `libs/bc/study/src/seeders/` that asserts the discriminated-union validator rejects a manifest missing the `kind` field.

## Phase F -- Verify

- [ ] `bun run check` clean.
- [ ] `bun run db reset && bun run db seed handbooks` produces 9 references with the expected `reference_section` row counts (3 sectioned at full chapter trees + 6 whole-doc at 1 row each).
- [ ] Hit `/library/cert/private`, `/library/topic/aerodynamics`, `/library/regulations/cfr`, `/library/handbook/phak` in the dev server. Verify cards render and `isReadable` is true for the 9 handbooks.
- [ ] Open one chapter from each of PHAK / AFH / AVWX -- body content renders.
- [ ] Drill into one of the 6 whole-doc handbooks from the cert spine -- the document-level reader shows the body.
- [ ] Run `bun test` and `bun playwright test` -- all green.
- [ ] Confirm `course/references/handbooks-noningested.yaml` is untouched (smell #1 follow-up, not this WP).

## Phase G -- Ship

- [ ] Squash-merge PR.
- [ ] Update `docs/work-packages/library-completeness/spec.md` to mark §6 sequence position 1 (WP-SUB) as ✅ shipped.
- [ ] Open follow-up issue/WP for smell #1 cleanup (handbooks-noningested.yaml audit).
- [ ] Notify next WP authors (WP-MTN / WP-AIM) that the substrate is ready.
