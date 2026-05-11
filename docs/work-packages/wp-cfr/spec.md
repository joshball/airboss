---
id: wp-cfr
title: WP-CFR -- 14 CFR + 49 CFR seeded with section drill-down
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
  - cfr
  - regulations
legacy_fields:
  feature: wp-cfr
  type: spec
  review_status: pending
---

# WP-CFR -- Code of Federal Regulations

Sequence position 4 in [library-completeness](../library-completeness/spec.md). 14 CFR (full title) + 49 CFR (Parts 830 + 1552) are already extracted to per-section markdown derivatives; this WP wires them through the post-WP-SUB seeder so the 11 existing CFR `study.reference` rows land with their section trees populated and render in `/library` with a part / section drill-down.

## Goal

`/library` shows 11 CFR cards (one per Part: 1/14/23/61/68/71/73/91/135/141, plus 49 Part 830 + 1552). Each card is "Read in-app"; clicking it opens the part's flat section list; clicking a section renders the regulation body markdown.

## Source

- Inline derivatives: `regulations/cfr-14/2026-04-22/manifest.json` + `sections.json` (Title 14 = 226 parts, 6,328 sections).
- Inline derivatives: `regulations/cfr-49/2026-04-24/manifest.json` + `sections.json` (Title 49 = 2 in-scope parts, 22 sections).
- Per-section bodies: `<corpus>/cfr-<title>/<edition-date>/<part>/<part>-<section>.md` (gitignored per ADR 018; produced by `bun run sources register cfr ...`).
- DB rows: 11 `study.reference WHERE kind='cfr'` rows already exist via `course/references/cfr-titles.yaml`. Slug shape `<title>cfr<part>`, edition `current`.

## Decisions (taken at WP author time)

- **Manifest discriminator**: `kind: 'cfr'` is a NEW member of the `manifestSchema` discriminated union. The on-disk top-level `manifest.json` doesn't carry `kind` today; this WP backfills it on the two existing files and updates `derivative-writer.ts`'s manifest-write site so re-runs always emit it. Same migration pattern as WP-AC and WP-AIM.
- **Sections.json shape**: validated via a SEPARATE `cfrSectionsFileSchema`. The seed adapter loads `sections.json` independently from the top-level manifest -- it isn't part of the discriminator (the discriminator is over the on-disk shape that `manifestSchema` parses; sections.json is data the adapter pulls in).
- **Granularity**: one DB `reference` per Part (CFR-14 *and* CFR-49). The 11 existing DB rows already encode this. The library-completeness §3.A line "Part-level for CFR-14, title-level for CFR-49" is overruled here by the on-disk DB reality: 49 CFR has two rows (830 + 1552), each modelling a single Part. Treating CFR-49 the same as CFR-14 keeps the seeder uniform and matches the YAML.
- **`section_schema`**: `{ levels: ['part', 'subpart', 'section', 'paragraph', 'subparagraph', 'clause'], strict_sequence: false }`. Asymmetric -- some parts have subparts, some are flat. Loose form (`strict_sequence: false`) per library-completeness §1.
- **Row laydown**: per Part, the seeder produces one `reference_section` row per section in `sectionsByPart[part]`:
  - `level = 'section'`, `depth = 0`, `parent_id = null`.
  - `code = canonical_short` (e.g. `'§91.103'`).
  - `title = canonical_title` (e.g. `'Preflight action'`).
  - `content_md` = body file at `<corpus>/<edition-date>/<body_path>`.
  - `content_hash = body_sha256` from the sections.json entry.
  - Subpart rows: SKIPPED. Subpart is a grouping construct, not a separately citable unit. Sections sit flat under the reference. Paragraph / subparagraph / clause rows: also SKIPPED -- the section is the citable unit; paragraphs are addressed inline within the section body via `(b)(1)(i)` notation. A future WP can expand if cited-by panels need finer granularity.
- **Adapter shape**: NEW `libs/bc/study/src/seeders/cfr.ts` exporting `seedCfrManifest(manifest, sectionsFile, context, summary): Promise<string[]>`. Returns an ARRAY of reference IDs (one per Part), unlike whole-doc / aim / ac which each return a single string. The dispatcher uniformizes the contract: every adapter returns `string[]`; existing single-result adapters are wrapped to return a one-element array.
- **DB-side mapping**: deterministic. `(title, part) -> document_slug = '<title>cfr<part>'`. No registry file. If `sections.json` includes a part with no matching DB row, the seeder logs a one-line skip and moves on. The 11 existing slugs cover the major pilot-facing parts; the other ~217 unextracted-from-the-perspective-of-airboss CFR-14 parts are out of scope for this WP.
- **Skip rule for missing DB rows**: per library-completeness §3.A, only seed sections for Parts that have an authored YAML row. Auto-creating reference rows for the long-tail (Parts 33, 27, etc.) is explicitly out of scope -- those are regulator-facing rules pilots almost never cite.
- **No search UI**: library-completeness §3.B ratified "search-first inside CFR drill-down", but search is a separate concern. This WP just gets the rows + bodies into the DB. The flat section list per Part is the read path; a future WP layers search on top.

## Touch list

| Layer                                         | Change                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/bc/study/src/manifest-validation.ts`    | Add `cfrManifestSchema` (kind: 'cfr'); export `CfrManifest`; add to `manifestSchema` discriminated union                                                                        |
| `libs/bc/study/src/manifest-validation.ts`    | Add `cfrSectionsFileSchema` (NOT part of the discriminator; validates sections.json)                                                                                            |
| `libs/bc/study/src/seeders/cfr.ts`            | New seed adapter; per-part loop; skips parts with no DB row                                                                                                                     |
| `libs/bc/study/src/seeders/types.ts`          | (no change)                                                                                                                                                                     |
| `scripts/db/seed-references-from-manifest.ts` | Add `case 'cfr'`; uniformize adapter return contract to `string[]`; add `'regulations'` to `CORPUS_DIRS` and extend the walker for the `<corpus>/cfr-<title>/<edition>/` layout |
| `regulations/cfr-14/2026-04-22/manifest.json` | Add `"kind": "cfr"`                                                                                                                                                             |
| `regulations/cfr-49/2026-04-24/manifest.json` | Add `"kind": "cfr"`                                                                                                                                                             |
| `regulations/cfr-49/2026-04-20/manifest.json` | Add `"kind": "cfr"` (older edition; superseded but parses cleanly)                                                                                                              |
| `libs/sources/src/regs/derivative-writer.ts`  | Manifest-write site only: add `kind: 'cfr'` to `ManifestRecord` so re-runs always author it. Body-path-writing logic (per-section markdown, subpart, part overview) UNCHANGED.  |

Per-part section counts (from `sections.json`):

| Slug      | Part | Sections |
| --------- | ---- | -------- |
| 14cfr14   | 14   | 19       |
| 14cfr23   | 23   | 68       |
| 14cfr61   | 61   | 149      |
| 14cfr68   | 68   | 6        |
| 14cfr71   | 71   | 15       |
| 14cfr73   | 73   | 11       |
| 14cfr91   | 91   | 286      |
| 14cfr135  | 135  | 200      |
| 14cfr141  | 141  | 49       |
| 49cfr830  | 830  | 6        |
| 49cfr1552 | 1552 | 16       |

Total in-scope: **825 sections** seeded across **11 references**.

Note: the prompt's verify list mentions `14cfr1` (3 sections in the manifest), but `course/references/cfr-titles.yaml` has no row for Part 1 (only `14cfr14`, which the YAML title clarifies is "Equal Access to Justice Act"). The seeder skips Part 1 with a log line; this matches the "do NOT auto-create reference rows for unextracted parts" rule.

## Acceptance

- `bun run db reset --force && bun run db seed` runs clean.
- 11 `study.reference WHERE kind='cfr'` rows have `section_schema = { levels: [...6 levels...], strict_sequence: false }`.
- 825 `study.reference_section` rows distributed per the table above.
- `getReadableReferenceIds()` returns IDs for all 11 CFR references.
- `/library` shows 11 CFR cards each with "Read in-app".
- Clicking 14 CFR Part 91 opens the section list; clicking §91.103 renders the body.
- `bun run check` clean.
- `bun test` green (new `cfrManifestSchema` smoke test, new seed integration test).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Pre-existing risk

- Section bodies (`<part>/<part>-<section>.md`) are gitignored per ADR 018; they're produced by `bun run sources register cfr --title=14|49 --edition=YYYY-MM-DD`. The seed adapter must be run AFTER ingest has produced the inline derivative tree, otherwise it raises a clear missing-body error per the section-tree precedent. CI scenarios that don't run the ingest first will produce zero CFR sections; the synthetic-fixture test in `seed-references-from-manifest.test.ts` is the CI signal.
- The `derivative-writer.ts` body-path-writing logic (lines around 137 -- the `<part>/index.md` overview write) is intentionally NOT touched. That logic is flagged for a separate `regs-derivative-cleanup` WP; this WP's manifest-write update is independent.
