---
title: 'WP-ACS-V -- test plan'
type: test-plan
status: pending
---

# Test plan

## Automated

### Manifest validation

- `acsManifestSchema` parses all 5 on-disk ACS manifests cleanly (after the `kind: 'acs'` backfill): `acs/{ppl,ir,cpl,cfi,atp}-airplane-*/manifest.json`.
- `manifestSchema` (the discriminated union) routes every cached ACS manifest to the `'acs'` branch.
- `acsManifestSchema` rejects a manifest with `kind: 'novel-shape'`.
- `acsManifestSchema` rejects a manifest missing `areas[]`.
- `acsManifestSchema` rejects a manifest with a malformed task `body_sha256`.
- `acsManifestSchema` rejects an element with an unknown `triad` value.

### Seed integration

- Synthetic ACS manifest (1 area, 1 task, 2 elements) -> 1 reference + 1 publication + 1 area + 1 task + 2 elements (5 sections).
- Re-running the seed against unchanged inputs produces 0 `sectionsChanged`.
- A manifest whose computed YAML slug is not in the seed-mapping registry throws a clear `no DB mapping` error (mirrors AC pattern).
- Body file missing on disk -> seed throws a clear error naming the path.
- Reference row carries `section_schema = { levels: ['publication','area','task','element'], strictSequence: true }`.
- The publication row has no parent and no `content_md`; the task rows carry `content_md`; element rows carry deterministic synthetic content hashes.

### Slug mapping (broad-survey gap 2)

- `getAcsSeedMapping('ppl-airplane-6c')` returns `{ documentSlug: 'ppl-airplane-acs-6c', edition: 'FAA-S-ACS-6C' }`.
- Same coverage for the other 4 cached publications.
- `getAcsSeedMapping('cfii-airplane-pts-9e')` returns `null` (not an ACS).

### Dispatcher

- `seedReferencesFromManifest` walks `acs/` correctly: finds all 5 cached manifests and dispatches each.
- Existing handbooks / aim / ac / cfr tests continue to pass (the new `case 'acs'` doesn't regress them).

## Manual

- `bun run sources register acs --cache=$HOME/Documents/airboss-handbook-cache --out=acs` produces inline derivatives under `acs/<slug>/area-<NN>/task-<x>.md` for the 5 cached publications.
- `bun run db reset --force && bun run db seed`:
  - 5 rows in `study.reference WHERE kind='acs'` with non-empty `section_schema`.
  - Per-publication section counts match the spec table (sum: 1910 sections).
- `/library` shows 5 ACS cards with "Read in-app" badge.
- Click PPL ACS -> Area list rendered (12 areas).
- Click Area I Preflight Preparation -> Task list rendered (8 tasks: A through H).
- Click Task A Pilot Qualifications -> body markdown renders with the 5 K-elements + 2 R-elements + 1 S-element visible.

## Out of scope

- Cited-by panels for ACS elements (cert-syllabus WP territory).
- Cross-edition supersession test (each ACS slug is one publication).
- CFI ACS element extraction (the on-disk manifest carries 0 elements; that's a separate ingest improvement).
