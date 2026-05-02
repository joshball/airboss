---
title: 'WP-EXTRAS-YAML -- test plan'
type: test-plan
status: in-progress
---

# Test plan

## Automated

- **YAML loader rejects missing subjects**: a row without `subjects:` fails parse with a clear error.
- **YAML loader rejects out-of-range subjects**: 0 entries or 4+ entries fail.
- **YAML loader rejects unknown topic**: a `subjects: [made-up-topic]` row fails.
- **Manifest carries fields**: after `runHandbooksExtrasIngest`, the produced manifest contains `subjects` + `primary_cert` matching the YAML row.
- **Idempotent on re-run**: existing `Cluster J` invariant still holds (zero file mutations on identical inputs).
- **Live-cache smoke**: still expects 7 entries; manifests now carry the new fields.

## Manual

- `bun run sources register handbooks-extras` -> all 7 manifests have `subjects` + `primary_cert`.
- `bun run db reset --force && bun run db seed` -> 7 `study.reference` rows for the extras with the YAML-authored values.
- Visit `/library` (logged in as Abby): all 7 cards show under their declared cert/topic spines, none orphaned.

## Out of scope

- E2E for the seed -> render path; the existing library-by-cert e2e covers cert/topic placement.
