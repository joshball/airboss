---
title: 'WP-CFR -- test plan'
type: test-plan
status: done
---

# Test plan

## Automated

### Manifest validation

- `cfrManifestSchema` parses `regulations/cfr-14/2026-04-22/manifest.json` and `regulations/cfr-49/2026-04-24/manifest.json` cleanly (after the `kind: 'cfr'` backfill).
- `cfrManifestSchema` rejects a manifest with `kind: 'novel-shape'`.
- `cfrManifestSchema` rejects a manifest missing `partCount` or with a string title other than `'14' | '49'`.
- `cfrSectionsFileSchema` parses both on-disk `sections.json` files.
- `cfrSectionsFileSchema` rejects a sections file whose entries lack `body_sha256` or have a malformed hash.

### Seed integration

- Synthetic CFR-14 manifest + sections.json with Part 91 + 2 sections (one body file each) produces:
  - 1 `reference` row (the existing `14cfr91` YAML row, upserted with `section_schema` populated).
  - 2 `reference_section` rows (depth 0, level `'section'`, codes `§91.A` / `§91.B`).
- Re-running the seed against unchanged inputs produces 0 `sectionsChanged`.
- A Part in `sections.json` with no matching DB row is skipped (no row created, no error).
- Adapter returns an array of reference IDs (one per matched Part).
- Body file missing on disk -> seed throws a clear error naming the path.

### Dispatcher

- `seedReferencesFromManifest` walks `regulations/` correctly: finds `cfr-14/2026-04-22/manifest.json` + `cfr-49/2026-04-24/manifest.json` and dispatches both.
- Existing handbooks / aim / ac tests continue to pass (the uniformized `string[]` contract doesn't regress them).

## Manual

- `bun run sources register cfr --title=14 --edition=2026-04-22` produces inline derivatives under `regulations/cfr-14/2026-04-22/<part>/<section>.md`.
- `bun run sources register cfr --title=49 --edition=2026-04-24` produces the same for Title 49 (Parts 830 + 1552).
- `bun run db reset --force && bun run db seed`:
  - 11 rows in `study.reference WHERE kind='cfr'` with non-empty `section_schema`.
  - Per-part section counts match the spec table (sum: 825 sections).
- `/library` shows 11 CFR cards with "Read in-app" badge.
- Click 14 CFR Part 91 -> flat section list rendered.
- Click §91.103 -> "Preflight action" body renders with the regulation text.
- Topic spines: CFR Parts appear under their YAML-declared subjects (e.g. 14cfr91 under `regulations` and `procedures`).

## Out of scope

- Search UI (deferred per spec).
- Cross-edition supersession test (CFR is a single rolling edition for now).
- Citation deep-link interop with handbooks (lands when reverse-citation panels expand to non-handbook corpora).
