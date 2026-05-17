---
title: 'WP-MTN-section-tree -- test plan'
product: study
feature: wp-mtn-section-tree
type: test-plan
status: unread
review_status: pending
created: 2026-05-03
---

# Test plan

Three layers: parser units, ingest integration, end-to-end manifest+seed.

## 1. Parser units (`libs/sources/src/handbooks-extras/section-tree-parser.test.ts`)

| Test                                                           | Expectation                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Happy path: real mtn-tips override                             | Returns 12 chapters with the right titles + section counts                                                     |
| Heading hierarchy: H1 doc, H2 chapter, H3 section              | Tree built correctly                                                                                           |
| Body prose between H2 and first H3 ends up in chapter overview | Chapter `body` includes prose, sections start fresh                                                            |
| Body prose after last H3 in a chapter belongs to that section  | Section `body` includes trailing prose                                                                         |
| Chapter with no H3 sections                                    | `sections: []`, all prose in chapter `body`                                                                    |
| H4 (`####`) encountered                                        | Throws / returns error -- parser is strict                                                                     |
| Zero H1                                                        | Returns parser error "no document title"                                                                       |
| Zero H2                                                        | Returns sentinel "not a section-tree, fall back"                                                               |
| Duplicate chapter slug                                         | Throws / returns error                                                                                         |
| Duplicate section slug within a chapter                        | Throws / returns error                                                                                         |
| Slug derivation: punctuation / case / whitespace               | `Density Altitude` -> `density-altitude`; `IFR and Night Mountain Flights` -> `ifr-and-night-mountain-flights` |

## 2. Ingest integration (`libs/sources/src/handbooks-extras/ingest.test.ts`)

Fixtures use the existing `tempCache` + `tempDerivative` + `tempYaml` helpers.

| Test                                                                        | Expectation                                                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Override with structured H2/H3 markdown emits `kind: 'handbook'` manifest   | Manifest has `kind: 'handbook'`, non-empty `sections[]`, `figures: []`              |
| Per-chapter overview file written at `<chapter-dir>/00-<slug>.md`           | File exists, content matches the chapter overview body                              |
| Per-section file written at `<chapter-dir>/<NN>-<slug>.md`                  | File exists, content matches the section body                                       |
| Manifest section rows carry valid `parent_code` and `code` shape            | `parent_code` is null for chapters; `parent_code` matches chapter code for sections |
| `body_path` on each section row is repo-relative starting with `handbooks/` | Matches the existing PHAK/AVWX shape                                                |
| `content_hash` is the SHA-256 of the per-section file                       | Recomputable from the file content                                                  |
| Idempotent: running ingest twice produces byte-equal manifest + body files  | Second run leaves files unchanged                                                   |
| Override without `##` headings falls through to whole-doc                   | Manifest is `kind: 'whole-doc'` with empty `sections[]` (existing behaviour)        |
| No `body_override` -> existing whole-doc behaviour                          | Unchanged (existing test continues to pass)                                         |
| Stale whole-doc body file removed when promoting                            | Old `<slug>-<faaDir>.md` is gone after promotion run                                |
| Subjects / primary_cert flow from YAML row into manifest                    | Match the fixture YAML                                                              |
| Manifest validates against `sectionTreeManifestSchema`                      | `sectionTreeManifestSchema.safeParse(produced).success === true`                    |

## 3. Manifest validation (`libs/bc/study/src/manifest-validation.test.ts`)

| Test                                            | Expectation                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| The actual produced mtn-tips manifest validates | `sectionTreeManifestSchema.safeParse(realManifest).success === true` |

(Read the on-disk file, parse it, assert success. Defensive against any drift in the produced shape.)

## 4. Seed integration

- Confirmed by an end-to-end check (no separate test):
  - `bun run db reset --force && bun run db seed`
  - Query `study.reference WHERE document_slug='tips-mountain-flying'` -> 1 row, `kind='handbook'`, section schema with 3 levels.
  - Query `study.reference_section WHERE reference_id=<mtn-id>` -> > 12 rows.
  - The section-tree seeder is shared with PHAK/AFH/AVWX; if it works for them, it works for mtn-tips.

## 5. Manual UI test (reader)

After `db seed`:

1. Visit `/library`. Confirm the mtn-tips card shows "Read in-app" and the chapter count matches the manifest (12 chapters).
2. Click into the card. Confirm chapter list renders.
3. Open chapter 3 (Introduction): confirm overview body renders + 4 subsection links.
4. Open chapter 3 -> Safety Window: confirm body renders.
5. Spot-check chapter 5 (Weather Factors) -- many sections; confirm all render.
6. Spot-check chapter 6 (Density Altitude) -- has sections but the override has been split into `### Effects on the Airplane` / `### Effects on Performance`; confirm both render.
7. Open chapter 12 (References) -- bullet list renders correctly.

## 6. Lint and types

- `bun run check` -- 0 errors, 0 warnings.
- `bun test libs/sources/src/` -- all green.
- `bun test libs/bc/study/src/` -- all green.

## 7. Regression checks

- Re-run `bun run sources register handbooks-extras` against the four other handbooks-extras rows (RMH, AIH, IFH, IPH) -- confirm they continue to produce `kind: 'whole-doc'` manifests untouched.
- Spot-check that the existing `risk-management-FAA-H-8083-2A.md` whole-doc body is byte-equal to the prior run.
