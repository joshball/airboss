---
title: 'WP-EXTRAS-YAML -- handbooks-extras YAML carries subjects + primary_cert'
product: study
feature: handbooks-extras-yaml-metadata
type: spec
status: unread
review_status: pending
created: 2026-05-02
---

# WP-EXTRAS-YAML

Make `handbooks-extras-yaml` the canonical source of truth for `subjects` and `primary_cert` on whole-doc handbooks, and have the ingest pipeline write them into every produced `manifest.json`. Stops the "register strips authored fields" footgun surfaced by [WP-MTN](../wp-mtn-mountain-flying/spec.md).

## The bug

`bun run sources register handbooks-extras` rewrites `manifest.json` cleanly each run from `ExtrasManifestFile`, which doesn't carry `subjects` or `primary_cert`. Anything authored after register (per the post-WP-SUB convention) gets stripped on the next register pass. Today this means the 6 sibling whole-doc manifests (risk-management, aviation-instructor, IFH, IPH, AMT-G, AMT-P) lose their cert/topic placement every time someone runs register.

The `wholeDocManifestSchema` already accepts `subjects` and `primary_cert` (post-WP-SUB it ships `manifestSubjectsOptional`). The seeder reads them from the manifest. The gap is purely in the producer side.

## Decision: YAML-driven authoring

Two paths considered:

| Option                 | Shape                                                       | Cost                                                                      | Resilience                                                                |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| (1) Read-merge-write   | Ingest reads existing manifest, preserves authored fields   | Tiny patch in `runHandbooksExtrasIngest`                                  | Brittle. Loses fields on first run / fresh checkout. Tribal knowledge.    |
| (2) YAML-driven (this) | YAML row carries `subjects` + `primary_cert`; ingest writes | New YAML schema + thread the fields through; back-fill 7 existing rows    | Source-of-truth lives in version control next to the URL. Replayable.    |

Picking (2). It mirrors how `seed-references.ts` reads `course/references/*.yaml` for non-handbook references — same authoring pattern, same audit trail.

## Touch list

| File                                                          | Change                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `libs/sources/src/handbooks-extras/derivative-reader.ts`     | Extend `ExtrasYamlEntry` (subjects, primary_cert) + parse-time validate |
| `libs/sources/src/handbooks-extras/derivative-reader.ts`     | Extend `ExtrasManifestFile` so the manifest declares the fields         |
| `libs/sources/src/handbooks-extras/ingest.ts`                | Carry both fields through `CachedExtra` + write into manifest           |
| `scripts/sources/config/handbooks-extras.yaml`               | Backfill `subjects` + `primary_cert` per row (7 entries today)          |
| `libs/sources/src/handbooks-extras/ingest.test.ts`           | Test the YAML round-trip and the manifest contains the new fields       |

Estimated diff size: ~150 LOC (reader + ingest threading + tests + 7 YAML rows).

## YAML row shape (after)

```yaml
- doc_id: faa-h-8083-2
  edition: '2A'
  url: https://www.faa.gov/.../risk_management_handbook_2A.pdf
  filename: risk_management_handbook_2A.pdf
  subjects: [human-factors]
  primary_cert: private
```

Validation rules (mirror what `wholeDocManifestSchema` enforces):

- `subjects`: 1-3 entries from `AVIATION_TOPIC_VALUES`. **Required** (cannot be omitted; every authored handbook must declare topic placement).
- `primary_cert`: `null` or one of `CERT_APPLICABILITY_VALUES`. Optional in the parser; explicit `null` is preferred over omission for clarity.

The validator is in the YAML loader (zod or hand-rolled checks consistent with the existing `loadHandbooksExtrasYaml`). Failing rows abort `register` with a clear message.

## Backfill values (the 7 current rows)

| doc_id          | slug                  | subjects                                                  | primary_cert |
| --------------- | --------------------- | --------------------------------------------------------- | ------------ |
| faa-h-8083-2    | risk-management       | `[human-factors]`                                         | `private`    |
| faa-h-8083-9    | aviation-instructor   | `[training-ops, human-factors]`                           | `cfi`        |
| faa-h-8083-15   | ifh                   | `[procedures, navigation, flight-instruments]`            | `instrument` |
| faa-h-8083-16   | iph                   | `[procedures, navigation, flight-instruments]`            | `instrument` |
| faa-h-8083-30   | amt-general           | `[aircraft-systems]`                                      | `null`       |
| faa-h-8083-32   | amt-powerplant        | `[aircraft-systems]`                                      | `null`       |
| faa-mtn-tips    | tips-mountain-flying  | `[performance, weather, emergencies]`                     | `null`       |

These mirror the values from the existing manifests / the WP-MTN spec; they're the canonical truth, just relocating to YAML.

## Acceptance

- `bun run sources register handbooks-extras` writes `subjects` + `primary_cert` into every produced `manifest.json`.
- `bun run sources register handbooks-extras` is idempotent: a second run with no YAML changes produces zero file-byte changes (the existing idempotency invariant).
- `bun run db reset --force && bun run db seed` produces 7 `study.reference` rows with the correct `subjects[]` and `primary_cert` values.
- `bun run check` clean.
- Removing `subjects` from a YAML row aborts `register` with a clear validation error.

## Out of scope

- Extending the same pattern to chapter-aware handbooks (PHAK / AFH / AVWX). Their manifests already carry these fields because the section-tree extraction pipeline authors them. Different code path.
- Removing `subjects` from `wholeDocManifestSchema` (manifest still ships it; just no longer authored separately).
- Adding new YAML fields beyond `subjects` + `primary_cert`.
