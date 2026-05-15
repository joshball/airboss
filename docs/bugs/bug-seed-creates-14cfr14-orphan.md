---
id: bug-seed-creates-14cfr14-orphan
title: Seed pipeline creates 14cfr14 reference row that's off-corpus since PR #682
product: platform
severity: minor
status: fixed
discovered_pr: null
discovered_date: 2026-05-14
fix_pr: null
fix_wp: null
tags: []
---

# Seed pipeline creates 14cfr14 reference row that's off-corpus since PR #682

## Symptom

On a freshly-seeded DB (e.g. `airboss_unit_test` provisioned by
`scripts/db/unit-test-setup.ts`), `study.reference` contains a row
`(document_slug='14cfr14', edition='current', kind='cfr')` with zero
matching `study.reference_section` rows. The CFR seed-shape contract
test in `scripts/db/seed-references-from-manifest.test.ts` fails with
`Missing: 14cfr14`.

## Background

PR #682 dropped 14 CFR Part 14 (Equal Access to Justice Act) from
`course/references/cfr-titles.yaml` because it's off-corpus for pilot
training. The CFR seeder (`libs/bc/study/src/seeders/cfr.ts`) skips
Parts not present in the YAML, so the CFR adapter does not create the
row.

The row is being inserted by `scripts/db/migrate-references-to-structured.ts`
(seed_origin = `migrate-references-to-structured-v1`). It pulls from
the canonical aviation reference list at
`libs/aviation/src/references/faa-docs.ts:1750` which still lists
`'14cfr14'` as a keyword.

A one-shot repair script (`scripts/db/cleanup-cfr-part-14-orphan.ts`)
existed to remove the orphan from DBs seeded before the fix. It was
deleted once PR #986 landed the root-cause fix and every dev DB was
reseeded -- a fresh seed no longer produces the orphan, so the repair
path is dead. Recover via `git log` if a stale DB ever resurfaces.

## Repro

```bash
bun scripts/db/unit-test-setup.ts
bun run vitest --run scripts/db/seed-references-from-manifest.test.ts
```

## Root fix candidates

1. Stop `migrate-references-to-structured.ts` from emitting a row for
   Parts not present in `cfr-titles.yaml`. Cleanest -- the YAML
   becomes the single source of truth for which CFR Parts get rows.
2. Add `cleanupCfrPart14Orphan` as a final step in `seed-all.ts`.
   Cheap but treats the symptom, not the cause.
3. Drop `'14cfr14'` from `faa-docs.ts` keywords. The doc entry stays
   (the canonical list documents it exists), but the migrator's
   inclusion criteria stop matching it.

Option 1 is the right answer.

## Surfaced by

The vitest-isolated-db infra work (2026-05-14). The dev DB had been
hand-cleaned over time so the orphan was invisible there; the
freshly-seeded test DB exposed it.
