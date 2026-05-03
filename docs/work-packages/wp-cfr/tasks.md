---
title: 'WP-CFR -- task list'
type: tasks
status: in-progress
---

# Tasks

## Phase 1 -- manifest schema

- [ ] Add `cfrManifestSchema` to `libs/bc/study/src/manifest-validation.ts` with `kind: 'cfr'`, `title: '14' | '49'`, `editionSlug`, `editionDate`, `sourceUrl`, `sourceSha256`, `fetchedAt`, `partCount`, `subpartCount`, `sectionCount`, optional `sources[]`.
- [ ] Add `cfrSectionsFileSchema` (NOT part of the discriminator) -- validates `{ schemaVersion, edition, sectionsByPart: Record<string, CfrSectionEntry[]> }`.
- [ ] Add `cfrManifestSchema` to `manifestSchema = z.discriminatedUnion('kind', [...])`.
- [ ] Export `CfrManifest`, `CfrSectionsFile`, `CfrSectionEntry` types.
- [ ] Add smoke tests in `manifest-validation.test.ts` against on-disk CFR-14 + CFR-49 manifests.

## Phase 2 -- seed adapter

- [ ] Create `libs/bc/study/src/seeders/cfr.ts` exporting `seedCfrManifest(manifest, sectionsFile, context, summary): Promise<string[]>`.
- [ ] `section_schema = { levels: ['part','subpart','section','paragraph','subparagraph','clause'], strict_sequence: false }`.
- [ ] Per-part loop: compute `document_slug = '<title>cfr<part>'`; check DB; skip with log line if missing.
- [ ] Per matched Part: upsert reference (preserves YAML metadata via `subjects: undefined` on conflict); for each section in `sectionsByPart[part]`, upsert a `reference_section` at depth 0, level `'section'`, parent_id null.
- [ ] Read body from `<corpusDir>/<edition-date>/<body_path>`; idempotent on `body_sha256`.
- [ ] Throw a clear error if a body file is missing (mirrors section-tree pattern).
- [ ] Source locator: `'<title> CFR §<part>.<section>'` style.

## Phase 3 -- dispatcher wiring

- [ ] Add `case 'cfr'` to dispatch in `scripts/db/seed-references-from-manifest.ts` -- loads sibling `sections.json`, calls `seedCfrManifest`.
- [ ] Uniformize adapter return contract to `string[]`. Wrap `seedSectionTreeManifest`, `seedWholeDocManifest`, `seedAimManifest`, `seedAcManifest` to return single-element arrays.
- [ ] Add `'regulations'` to `CORPUS_DIRS`.
- [ ] Extend the walker for the `regulations/cfr-<title>/<edition>/` layout (the corpus dir contains `cfr-<title>` subdirs, each with editions). Effective slug for supersede chains is `cfr-<title>` (or refine to skip CFR from supersede entirely).

## Phase 4 -- manifest backfill

- [ ] Add `"kind": "cfr"` to `regulations/cfr-14/2026-04-22/manifest.json`.
- [ ] Add `"kind": "cfr"` to `regulations/cfr-49/2026-04-24/manifest.json`.
- [ ] Add `"kind": "cfr"` to `regulations/cfr-49/2026-04-20/manifest.json` (if present and walked by the dispatcher).
- [ ] Update `libs/sources/src/regs/derivative-writer.ts` `ManifestRecord` shape so re-runs always emit `kind: 'cfr'`. Manifest-write site only -- do NOT touch the per-section / subpart / part-overview body-path-writing logic.

## Phase 5 -- verify

- [ ] `bun run check` clean (0 errors / 0 warnings).
- [ ] `bun test libs/bc/study/src/` green.
- [ ] (Local-only) Run `bun run sources register cfr --title=14 --edition=2026-04-22` + `--title=49 --edition=2026-04-24` to populate inline derivative tree.
- [ ] `bun run db reset --force && bun run db seed` clean.
- [ ] DB-side: 11 `study.reference WHERE kind='cfr'` rows have populated `section_schema` and the section counts in the spec table.
- [ ] `getReadableReferenceIds()` returns all 11 CFR refs.
- [ ] Spot-check: §91.103 ("Preflight action") body renders.

## Phase 6 -- tests

- [ ] `manifest-validation.test.ts`: parse on-disk CFR-14 + CFR-49 manifests through `manifestSchema`. Validate sections.json against `cfrSectionsFileSchema`. Negative cases (missing kind, bad partCount).
- [ ] `seed-references-from-manifest.test.ts`: synthetic CFR manifest + sections.json with 1 in-scope part + 2 sections -> 1 reference + 2 sections; idempotent re-run = 0 changes; missing-DB-row Part is skipped silently.

## Phase 7 -- ship

- [ ] One commit per phase. Stage explicitly.
- [ ] `bun run check` clean.
- [ ] Push, open PR titled `feat(study): WP-CFR -- 11 CFR parts seeded with section drill-down`.
- [ ] PR body: spec link, per-part section count table, total seeded count, test-plan checklist, explicit out-of-scope (search UI + long-tail parts), depends-on note for the rename PR.
