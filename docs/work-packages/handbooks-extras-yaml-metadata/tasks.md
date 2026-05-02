---
title: 'WP-EXTRAS-YAML -- task list'
type: tasks
status: in-progress
---

# Tasks

## Phase 1 -- types + schema

- [ ] Extend `ExtrasYamlEntry` in `libs/sources/src/handbooks-extras/derivative-reader.ts` with `subjects: readonly AviationTopic[]` (1-3) and `primary_cert: CertApplicability | null`.
- [ ] Extend `loadHandbooksExtrasYaml()` validator to require `subjects` and accept `primary_cert` (null-or-enum).
- [ ] Extend `ExtrasManifestFile` (same file) so the produced manifest declares the new fields.

## Phase 2 -- ingest threading

- [ ] Carry `subjects` + `primary_cert` from `ExtrasYamlEntry` through `discover()` -> `CachedExtra` in `libs/sources/src/handbooks-extras/ingest.ts`.
- [ ] Write them into the produced `ExtrasManifestFile` literal at the manifest-write site.

## Phase 3 -- YAML backfill

- [ ] Add `subjects` + `primary_cert` rows to all 7 existing entries in `scripts/sources/config/handbooks-extras.yaml` per the backfill table in spec.md.

## Phase 4 -- verification

- [ ] `bun run sources register handbooks-extras` runs clean.
- [ ] All 7 produced `handbooks/<slug>/<faa-dir>/manifest.json` contain `subjects` + `primary_cert`.
- [ ] Re-run register: zero byte changes (idempotent).
- [ ] `bun run db reset --force && bun run db seed` clean. All 7 `reference` rows carry the YAML-authored values.

## Phase 5 -- tests + ship

- [ ] Add unit test: `loadHandbooksExtrasYaml()` rejects a row without `subjects`.
- [ ] Add unit test: `runHandbooksExtrasIngest` produces a manifest with `subjects` + `primary_cert` matching YAML.
- [ ] Existing live-cache smoke test still passes (already expects 7 entries from WP-MTN).
- [ ] `bun run check` clean.
- [ ] Commit, push, PR, merge, pull main, clean up worktree.
