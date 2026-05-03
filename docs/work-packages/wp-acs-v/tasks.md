---
title: 'WP-ACS-V -- task list'
type: tasks
status: pending
---

# Tasks

## Phase 0 -- spec docs

- [x] Author `docs/work-packages/wp-acs-v/spec.md` covering decisions, ground truth (5 cached, 7 YAML, slug-mismatch fix), in-scope / out-of-scope.
- [x] Author `docs/work-packages/wp-acs-v/tasks.md` (this file).
- [x] Author `docs/work-packages/wp-acs-v/test-plan.md`.
- [x] Commit spec docs.

## Phase 1 -- constants + schema

- [ ] Add `PUBLICATION`, `AREA`, `TASK`, `ELEMENT` to `REFERENCE_SECTION_LEVELS` + label entries in `libs/constants/src/study.ts`.
- [ ] Add `acsManifestElementSchema`, `acsManifestTaskSchema`, `acsManifestAreaSchema`, and `acsManifestSchema` (`kind: 'acs'`) to `libs/bc/study/src/manifest-validation.ts`.
- [ ] Export `AcsManifest`, `AcsManifestArea`, `AcsManifestTask`, `AcsManifestElement` types.
- [ ] Add `acsManifestSchema` to `manifestSchema = z.discriminatedUnion('kind', [...])`.
- [ ] Re-export `acsManifestSchema` + types from `libs/bc/study/src/index.ts`.
- [ ] Add ACS smoke tests in `manifest-validation.test.ts` + on-disk fixture parses (5 manifests).

## Phase 2 -- seed mapping registry

- [ ] Create `libs/sources/src/acs/seed-mapping.ts`. Hard-coded 5-entry registry mapping `(manifestSlug) -> { documentSlug, edition }`.
- [ ] Re-export `getAcsSeedMapping` from `libs/sources/src/acs/index.ts`.

## Phase 3 -- seed adapter

- [ ] Create `libs/bc/study/src/seeders/acs.ts` exporting `seedAcsManifest(manifest, context, summary): Promise<string>`.
- [ ] `section_schema = { levels: ['publication','area','task','element'], strictSequence: true }`.
- [ ] Walk areas -> tasks -> elements; produce one publication container row + N area + M task + K element rows.
- [ ] Read body from `<repoRoot>/<task.body_path>`; idempotent on `body_sha256` (tasks) + synthetic hash (elements).
- [ ] Throw a clear error if a task body file is missing (mirrors section-tree pattern).
- [ ] Lookup mapping via `getAcsSeedMapping`; throw on missing mapping (matches AC pattern).

## Phase 4 -- dispatcher wiring

- [ ] Add `case 'acs'` to dispatch in `scripts/db/seed-references-from-manifest.ts`.
- [ ] Add `'acs'` to `CORPUS_DIRS`.
- [ ] No walker changes needed (same `<corpus>/<slug>/manifest.json` layout as AC).

## Phase 5 -- backfill manifests + writer

- [ ] Add `"kind": "acs"` to all 5 cached `acs/*/manifest.json` files.
- [ ] Update `AcsManifestFile` interface in `libs/sources/src/acs/derivative-reader.ts` to carry `kind: 'acs'`.
- [ ] Update `libs/sources/src/acs/ingest.ts` so the manifest writer emits `kind: 'acs'` on re-runs.

## Phase 6 -- verify

- [ ] `bun run check` clean (0 errors / 0 warnings).
- [ ] `bun test libs/bc/study/src/` green.
- [ ] `bun test libs/sources/src/acs/` green.
- [ ] `bun run db reset --force && bun run db seed` clean.
- [ ] DB-side: 5 `study.reference WHERE kind='acs'` rows have populated `section_schema`.
- [ ] Per-publication section counts match the spec table (sum: 1910 sections).
- [ ] `getReadableReferenceIds()` returns all 5 ACS refs.
- [ ] Spot-check: PPL ACS Area I Task A body renders.

## Phase 7 -- ship

- [ ] One commit per phase. Stage explicitly.
- [ ] `bun run check` clean.
- [ ] Push, open PR titled `feat(study): WP-ACS-V -- 5 ACS publications seeded with task / element drill-down`.
- [ ] PR body: spec link, per-publication section count table, total seeded count, test-plan checklist, explicit out-of-scope.
- [ ] Merge with `gh pr merge <num> --squash` (no `--delete-branch`).
