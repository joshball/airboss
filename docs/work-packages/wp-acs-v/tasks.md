---
title: 'WP-ACS-V -- task list'
type: tasks
status: done
---

# Tasks

## Phase 0 -- spec docs

- [x] Author `docs/work-packages/wp-acs-v/spec.md` covering decisions, ground truth (5 cached, 7 YAML, slug-mismatch fix), in-scope / out-of-scope.
- [x] Author `docs/work-packages/wp-acs-v/tasks.md` (this file).
- [x] Author `docs/work-packages/wp-acs-v/test-plan.md`.
- [x] Commit spec docs.

## Phase 1 -- constants + schema

- [x] Add `PUBLICATION`, `AREA`, `TASK`, `ELEMENT` to `REFERENCE_SECTION_LEVELS` + label entries in `libs/constants/src/study.ts`.
- [x] Add `acsManifestElementSchema`, `acsManifestTaskSchema`, `acsManifestAreaSchema`, and `acsManifestSchema` (`kind: 'acs'`) to `libs/bc/study/src/manifest-validation.ts`.
- [x] Export `AcsManifest`, `AcsManifestArea`, `AcsManifestTask`, `AcsManifestElement` types.
- [x] Add `acsManifestSchema` to `manifestSchema = z.discriminatedUnion('kind', [...])`.
- [x] Re-export `acsManifestSchema` + types from `libs/bc/study/src/index.ts`.
- [x] Add ACS smoke tests in `manifest-validation.test.ts` + on-disk fixture parses (5 manifests).

## Phase 2 -- seed mapping registry

- [x] Create `libs/sources/src/acs/seed-mapping.ts`. Hard-coded 5-entry registry mapping `(manifestSlug) -> { documentSlug, edition }`.
- [x] Re-export `getAcsSeedMapping` from `libs/sources/src/acs/index.ts`.

## Phase 3 -- seed adapter

- [x] Create `libs/bc/study/src/seeders/acs.ts` exporting `seedAcsManifest(manifest, context, summary): Promise<string>`.
- [x] `section_schema = { levels: ['publication','area','task','element'], strictSequence: true }`.
- [x] Walk areas -> tasks -> elements; produce one publication container row + N area + M task + K element rows.
- [x] Read body from `<repoRoot>/<task.body_path>`; idempotent on `body_sha256` (tasks) + synthetic hash (elements).
- [x] Throw a clear error if a task body file is missing (mirrors section-tree pattern).
- [x] Lookup mapping via `getAcsSeedMapping`; throw on missing mapping (matches AC pattern).

## Phase 4 -- dispatcher wiring

- [x] Add `case 'acs'` to dispatch in `scripts/db/seed-references-from-manifest.ts`.
- [x] Add `'acs'` to `CORPUS_DIRS`.
- [x] No walker changes needed (same `<corpus>/<slug>/manifest.json` layout as AC).

## Phase 5 -- backfill manifests + writer

- [x] Add `"kind": "acs"` to all 5 cached `acs/*/manifest.json` files.
- [x] Update `AcsManifestFile` interface in `libs/sources/src/acs/derivative-reader.ts` to carry `kind: 'acs'`.
- [x] Update `libs/sources/src/acs/ingest.ts` so the manifest writer emits `kind: 'acs'` on re-runs.

## Phase 6 -- verify

- [x] `bun run check` clean (0 errors / 0 warnings).
- [x] `bun test libs/bc/study/src/` green.
- [x] `bun test libs/sources/src/acs/` green.
- [x] `bun run db reset --force && bun run db seed` clean.
- [x] DB-side: 5 `study.reference WHERE kind='acs'` rows have populated `section_schema`.
- [x] Per-publication section counts match the spec table (sum: 1910 sections).
- [x] `getReadableReferenceIds()` returns all 5 ACS refs.
- [x] Spot-check: PPL ACS Area I Task A body renders.

## Phase 7 -- ship

- [x] One commit per phase. Stage explicitly.
- [x] `bun run check` clean.
- [x] Push, open PR titled `feat(study): WP-ACS-V -- 5 ACS publications seeded with task / element drill-down`.
- [x] PR body: spec link, per-publication section count table, total seeded count, test-plan checklist, explicit out-of-scope.
- [x] Merge with `gh pr merge <num> --squash` (no `--delete-branch`).
