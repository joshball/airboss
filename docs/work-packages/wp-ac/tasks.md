# WP-AC: Tasks

## Phase 1: Manifest schema

- [ ] Add `circular` to `REFERENCE_SECTION_LEVELS` in `libs/constants/src/study.ts`. Update label map.
- [ ] Add `acManifestSchema` to `libs/bc/study/src/manifest-validation.ts` next to `wholeDocManifestSchema`. Discriminator `kind: 'ac'`. Required fields per spec.
- [ ] Wire `acManifestSchema` into the `manifestSchema` discriminated union.
- [ ] Export `AcManifest` type and `acManifestSchema` from `libs/bc/study/src/index.ts` barrel.

## Phase 2: Seed adapter

- [ ] Create `libs/bc/study/src/seeders/ac.ts` exporting `seedAcManifest(manifest, context, summary): Promise<string>`.
- [ ] Pattern from `seeders/whole-doc.ts`. Translate `(doc_slug, revision)` to `(document_slug, edition)` via the mapping module.
- [ ] `section_schema = { levels: ['circular'], strict_sequence: true }`.
- [ ] ONE `reference_section` row at depth 0, level `'circular'`, code `'1'`, body from `<corpusDir>/<doc_slug>/<revision>/<body_path>`.
- [ ] Idempotent on `body_sha256`.

## Phase 3: Dispatcher wiring

- [ ] Add `case 'ac': return seedAcManifest(...)` to the discriminator switch in `scripts/db/seed-references-from-manifest.ts`.
- [ ] Add `'ac'` to `CORPUS_DIRS`.

## Phase 4: Backfill manifests + writer

- [ ] Add `"kind": "ac"` field after `"corpus": "ac"` in the 9 manifests on disk.
- [ ] Update `libs/sources/src/ac/derivative-reader.ts` `AcManifestFile` interface to include the `kind` field.
- [ ] Update `libs/sources/src/ac/ingest.ts` writer so every re-run includes the field.

## Phase 5: Seed mapping registry

- [ ] Create `libs/sources/src/ac/seed-mapping.ts` with the 9-entry registry. Export `getAcSeedMapping(docSlug, revision)`.
- [ ] Export from `libs/sources/src/index.ts`.

## Phase 6: YAML reference backfill

- [ ] Add 4 missing entries to `course/references/advisory-circulars.yaml` (25-7, 61-65, 91-21-1, 120-71).
- [ ] Adjust 2 edition tags so they match manifest revisions: ac-61-83 J, ac-91-79 A.

## Phase 7: Verify

- [ ] `bun run check` clean.
- [ ] `bun test libs/bc/study/src/manifest-validation.test.ts`.
- [ ] `bun test scripts/db/seed-references-from-manifest.test.ts`.
- [ ] `bun run db reset --force` + `bun run db seed`.
- [ ] DB query: count `reference_section` per AC reference -> 9 ACs at 1 section, 12 ACs at 0 sections.
- [ ] Spot-check: AC 61-98D body renders.

## Phase 8: Tests

- [ ] `manifest-validation.test.ts`: parse one on-disk AC manifest through `manifestSchema`. Negative: bogus revision fails parse.
- [ ] `seed-references-from-manifest.test.ts`: synthetic AC manifest -> 1 reference + 1 section, idempotent on re-run.

## Phase 9: Ship

- [ ] Per-phase commits, files staged individually.
- [ ] `bun run check` clean.
- [ ] PR opened with spec link + before/after counts.
- [ ] PR squash-merged.
