---
id: wp-acs-v
title: WP-ACS-V -- 5 ACS publications seeded with task / element drill-down
product: course
category: content
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-05-02
owner: agent
depends_on: []
unblocks: []
tags:
  - acs
legacy_fields:
  feature: wp-acs-v
  type: spec
  review_status: pending
---

# WP-ACS-V -- Airman Certification Standards visibility

Sequence position 6 in [library-completeness](../library-completeness/spec.md). Five FAA airplane-track ACS publications (PPL, IR, CPL, CFI, ATP) are already extracted to per-task markdown derivatives under `acs/<slug>/area-<NN>/task-<x>.md`. This WP wires them through the post-WP-SUB seeder so the 5 matching ACS `study.reference` rows land with their full Area / Task / Element trees populated, the deepest tree shipped to date.

## Goal

`/library` shows 5 ACS cards (PPL / IR / CPL / CFI / ATP) each with "Read in-app". Clicking a card opens the Area list; clicking an Area opens its Tasks; clicking a Task renders the task body markdown with element bullets visible.

## Source

- Inline derivatives: `acs/<slug>/manifest.json` + `acs/<slug>/area-<NN>/task-<x>.md` for the 5 cached publications.
- Per-corpus catalog: `acs/index.json` (entries for all 5 cached slugs).
- Cached publications:

| Slug (manifest + YAML + DB) | edition (DB)    | sections produced                                        |
| --------------------------- | --------------- | -------------------------------------------------------- |
| `ppl-airplane-acs-6c`       | `FAA-S-ACS-6C`  | 1 publication + 12 areas + 61 tasks + 529 elements = 603 |
| `ir-airplane-acs-8c`        | `FAA-S-ACS-8C`  | 1 publication +  8 areas + 22 tasks + 143 elements = 174 |
| `cpl-airplane-acs-7b`       | `FAA-S-ACS-7B`  | 1 publication + 11 areas + 60 tasks + 476 elements = 548 |
| `cfi-airplane-acs-25`       | `FAA-S-ACS-25`  | 1 publication + 14 areas + 85 tasks +   0 elements = 100 |
| `atp-airplane-acs-11a`      | `FAA-S-ACS-11A` | 1 publication +  8 areas + 48 tasks + 428 elements = 485 |

  Counts derived directly from each manifest via `jq` (areas + tasks + elements + 1 publication container row). The CFI ACS extracts to 0 elements because the FAA's CFI ACS PDF stops at the task level in the on-disk extraction; the seeder treats this as a normal data fact.

  Total expected sections: **1910** rows across 5 references.

- DB rows: 7 entries in `course/references/acs-pts.yaml` cover all current ACS / PTS cards. Two of those entries lack on-disk manifests (see "Out of scope" below).

## Decisions (taken at WP author time)

- **Manifest discriminator**: `kind: 'acs'` is a NEW member of the `manifestSchema` discriminated union. The on-disk top-level `manifest.json` doesn't carry `kind` today; this WP backfills it on all 5 cached files and updates `libs/sources/src/acs/ingest.ts` so re-runs always emit it. Same pattern as WP-CFR (#491).
- **Tree shape (4 levels deep -- novel for this codebase)**:
  - depth 0: `level = 'publication'`, code = `'publication'`, parent = null. Container row carrying the publication title; `content_md` is empty so `getReadableReferenceIds()` keys off the deeper task rows that DO carry markdown.
  - depth 1: `level = 'area'`, code = the FAA Roman numeral (`'I'`, `'II'`, ...), parent = the publication row. Title = the area title from the manifest.
  - depth 2: `level = 'task'`, code = `<area-roman>.<task-letter-upper>` (e.g. `'I.A'`, `'V.G'`). Parent = the area row. Title = the task title. `content_md` = the file at `manifest.body_path`. `content_hash = body_sha256`.
  - depth 3: `level = 'element'`, code = the full FAA element code (`'PA.I.A.K1'`, `'IR.II.B.R3'`, etc.). Parent = the task row. Title = the element title. `content_md` is empty (elements are bullets within the task body); `content_hash` is computed deterministically from `<code>:<title>`.
- **`section_schema`**: `{ levels: ['publication', 'area', 'task', 'element'], strict_sequence: true }`. ACS is symmetric: publication -> area -> task -> element with no skipping.
- **Slug shape**: the on-disk manifest slug, YAML row slug, and DB `document_slug` all share a single canonical form, `<rating>-airplane-acs-<edition>` (e.g. `ppl-airplane-acs-6c`). The seed-mapping registry no longer translates between shapes; it survives only as the authored source of the canonical FAA `edition` designator (`FAA-S-ACS-6C`, `FAA-S-ACS-25`, ...) and as a per-test injection surface. If a manifest has no entry the seeder logs a one-line skip and continues, mirroring the CFR adapter.
- **Edition handling**: the YAML row's `edition` field is the canonical FAA designator (e.g. `FAA-S-ACS-6C`). The on-disk manifest does not carry that string; the seed adapter computes the DB edition by uppercasing + canonicalising the manifest slug to `FAA-S-ACS-<EDITION>`. The mapping is hard-coded in a tiny per-slug registry (5 entries) in `libs/sources/src/acs/seed-mapping.ts`, identical pattern to `libs/sources/src/ac/seed-mapping.ts`. The registry is the single review surface for "this ACS is now readable" deltas.
- **Adapter shape**: NEW `libs/bc/study/src/seeders/acs.ts` exporting `seedAcsManifest(manifest, context, summary): Promise<string>` (single result -- one ACS = one reference). The dispatcher wraps the result in a one-element array so the existing string[] contract holds.
- **Skip rule for missing DB rows**: only seed sections for ACS publications that have an authored YAML row (`getAcsSeedMapping` returns `null` for unmapped slugs -> the dispatcher logs and skips). Adding a new publication is a 4-step change (manifest cache + ingest mapping + YAML row + DB seed mapping), not a silent auto-create.
- **No new generic helper**: ACS is the first depth-4 tree in the codebase. The existing `seeders/section-tree.ts` has hardcoded handbook level vocabulary (`chapter / section / subsection`); it's not pluggable across corpora. Per the AIM and CFR precedent, ACS gets its own dedicated adapter rather than retrofitting the section-tree generic. If a future corpus reuses the publication / area / task / element shape exactly, that's the trigger to extract a shared helper -- not now.

## Touch list

| Layer                                               | Change                                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/constants/src/study.ts`                       | Add `PUBLICATION`, `AREA`, `TASK`, `ELEMENT` to `REFERENCE_SECTION_LEVELS` + corresponding label entries.                                                                                    |
| `libs/bc/study/src/manifest-validation.ts`          | Add `acsManifestSchema` (kind: 'acs') with nested `acsManifestAreaSchema` / `acsManifestTaskSchema` / `acsManifestElementSchema`. Export types. Add to `manifestSchema` discriminated union. |
| `libs/bc/study/src/index.ts`                        | Re-export `acsManifestSchema` and types.                                                                                                                                                     |
| `libs/sources/src/acs/seed-mapping.ts`              | NEW. Hard-coded 5-entry registry mapping `(manifestSlug) -> (documentSlug, edition)`. Same pattern as `libs/sources/src/ac/seed-mapping.ts`.                                                 |
| `libs/sources/src/acs/index.ts`                     | Re-export `getAcsSeedMapping`.                                                                                                                                                               |
| `libs/bc/study/src/seeders/acs.ts`                  | New seed adapter; depth-4 walk; idempotent on body_sha256 + element synthetic hash.                                                                                                          |
| `scripts/db/seed-references-from-manifest.ts`       | Add `case 'acs'` to dispatcher; add `'acs'` to `CORPUS_DIRS`.                                                                                                                                |
| `acs/{ppl,ir,cpl,cfi,atp}-airplane-*/manifest.json` | Add `"kind": "acs"` to all 5 cached manifests.                                                                                                                                               |
| `libs/sources/src/acs/ingest.ts`                    | Update `AcsManifestFile` write-site so re-runs always emit `kind: 'acs'`. Body parser logic unchanged.                                                                                       |
| `libs/sources/src/acs/derivative-reader.ts`         | Add `kind: 'acs'` to the `AcsManifestFile` interface (matches what the ingest writer emits).                                                                                                 |
| `libs/bc/study/src/manifest-validation.test.ts`     | Add ACS smoke tests + on-disk fixture parses for all 5 cached manifests.                                                                                                                     |
| `libs/bc/study/src/seeders/acs.test.ts`             | New unit tests covering the slug transformation, depth-4 walk, multi-publication scenario.                                                                                                   |
| `scripts/db/seed-references-from-manifest.test.ts`  | Synthetic ACS manifest -> 1 reference + N sections. Idempotency + missing-mapping skip.                                                                                                      |

## Acceptance

- `bun run db reset --force && bun run db seed` runs clean.
- 5 `study.reference WHERE kind='acs'` rows have `section_schema = { levels: ['publication','area','task','element'], strictSequence: true }`.
- 1910 `study.reference_section` rows distributed per the table above.
- `getReadableReferenceIds()` returns IDs for all 5 ACS references.
- `/library` shows 5 ACS cards each with "Read in-app".
- Spot-check: PPL ACS Area I Task A renders the body markdown.
- `bun run check` clean.
- `bun test` green (new ACS schema test, new ACS seed test, new dispatcher test).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) for the deferred items, rationale, and revisit triggers.

## Pre-existing risk

- Task body files (`acs/<slug>/area-<NN>/task-<x>.md`) are written by `libs/sources/src/acs/ingest.ts` during `bun run sources register acs`. The seed adapter must run AFTER ingest has produced the inline derivative tree, otherwise it raises a clear missing-body error. CI scenarios that don't run the ingest first will produce zero ACS sections; the synthetic-fixture test in `seed-references-from-manifest.test.ts` is the CI signal.
- Per-corpus dispatcher walker handles `acs/<slug>/manifest.json` (one slug per directory under `acs/`). The existing dispatcher already handles this layout (it's the same as the AC corpus); just adding `'acs'` to `CORPUS_DIRS` is enough.
