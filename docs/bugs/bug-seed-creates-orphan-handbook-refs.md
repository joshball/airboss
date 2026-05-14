---
id: bug-seed-creates-orphan-handbook-refs
title: Seed pipeline creates 6 handbook/other refs unreachable from any library spine
product: platform
severity: minor
status: open
discovered_pr: null
discovered_date: 2026-05-14
fix_pr: null
fix_wp: null
tags: []
---

# Seed pipeline creates 6 handbook/other refs unreachable from any library spine

## Symptom

On a freshly-seeded DB, the library-by-cert orphan test flags 6
references that fall through every library spine (cert / topic /
regulations / aircraft):

- `phak@FAA-H-8083-25` (kind=handbook)
- `ifh@8083-15B` (kind=handbook)
- `avwx@FAA-H-8083-28` (kind=handbook)
- `risk-management@8083-2A` (kind=handbook)
- `faa-pamphlet-p-8740-25@unspecified` (kind=other)
- `faa-s-8081-14@unspecified` (kind=other)

Each row has `primary_cert = NULL`, `subjects = []`, and a non-regs
non-poh kind. Learners cannot reach them from the library navigation.

## Background

Library spines (per
`libs/bc/study/src/library-by-cert.orphan.test.ts`):

1. Cert spine -- `ref.primaryCert != null`
2. Topic spine -- `ref.subjects.length > 0`
3. Regulations spine -- `kind in {cfr, ac, aim, pcg, ntsb}`
4. Aircraft spine -- `kind == poh`

Handbooks (`phak`, `ifh`, `avwx`, `risk-management`) are arguably
foundational references and should have `primaryCert` and/or
`subjects` populated. `faa-pamphlet-p-8740-25` and `faa-s-8081-14`
(kind=other) may belong on a new spine or need taxonomy assignment.

## Repro

```bash
bun scripts/db/unit-test-setup.ts
bun run vitest --run libs/bc/study/src/library-by-cert.orphan.test.ts
```

## Root fix candidates

1. **Populate `primaryCert` / `subjects` for the 4 handbooks** in the
   seed source data (`course/references/handbook-*.yaml` or wherever
   PHAK/IFH/AVWX/Risk-Management metadata is authored). PHAK -> ppl;
   IFH -> ifr; AVWX -> ppl (with weather subject); Risk-Management ->
   ppl. This is product-shape and needs your call.
2. **Decide what to do with the 2 `kind=other` rows.** Either give
   them subjects, drop them from the seed, or expand the spine
   taxonomy to surface them somewhere meaningful.
3. **Loosen the orphan test** to accept some `kind` values as
   library-routable without spine membership. Not recommended -- the
   test exists precisely to catch unreachable refs.

## Surfaced by

The vitest-isolated-db infra work (2026-05-14). The dev DB had been
hand-modified over time so these refs had subjects/primaryCert
populated locally; the freshly-seeded test DB exposed that the seed
source is missing the metadata.
