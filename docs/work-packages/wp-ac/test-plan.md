# WP-AC: Test plan

## Automated

### Manifest validator (`libs/bc/study/src/manifest-validation.test.ts`)

- [ ] AC manifest from disk (e.g. `ac/61-98/d/manifest.json`) parses through `manifestSchema` as `kind: 'ac'`.
- [ ] Bogus revision (uppercase, non-letter) fails `acManifestSchema.safeParse`.
- [ ] Missing `body_sha256` fails parse.
- [ ] `manifestSchema.safeParse(VALID_AC).data.kind === 'ac'`.

### Seed adapter (`scripts/db/seed-references-from-manifest.test.ts`)

- [ ] Synthetic AC manifest at `ac/test-<token>/x/manifest.json` -> 1 `reference` row, 1 `reference_section` row.
- [ ] Section: `level='circular'`, `depth=0`, `code='1'`, `parentId=null`, body matches the file.
- [ ] Reference `section_schema = { levels: ['circular'], strictSequence: true }`.
- [ ] Idempotent re-run: 0 sections changed.
- [ ] Manifest with no mapping registry entry -> seeder throws clear error.

## Manual (run after `bun run db reset && bun run db seed`)

- [ ] DB query confirms 9 `study.reference WHERE kind='ac'` rows have a section_count of 1; 12 have 0.

  ```sql
  SELECT r.document_slug, r.edition, COUNT(rs.id) AS sections
  FROM study.reference r
  LEFT JOIN study.reference_section rs ON rs.reference_id = r.id
  WHERE r.kind = 'ac'
  GROUP BY r.id, r.document_slug, r.edition
  ORDER BY r.document_slug;
  ```

- [ ] `/library` shows AC cards with "Read in-app" affordance for the 9 readable ACs.
- [ ] `/library/handbook/ac-61-98` (or equivalent AC route) renders the full document body.
- [ ] The 12 link-only ACs still show with their FAA URL (no readable affordance).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
