# WP-AC: Advisory Circulars as readable library cards

Wire the FAA Advisory Circulars (already extracted to `ac/<doc-slug>/<rev>/`) through the post-WP-SUB seeder so they land in `/library` as readable cards (open-and-read in-app), not link-only catalogue entries.

## Background

Phase 8 ingest (`libs/sources/src/ac/ingest.ts`) populated 9 AC manifests on disk:

```text
ac/00-6/b
ac/120-71/b
ac/25-7/d
ac/61-65/j
ac/61-83/j
ac/61-98/d
ac/90-66/c
ac/91-21-1/d
ac/91-79/a
```

Each manifest is a flat whole-doc shape:

```json
{
  "schema_version": 1,
  "corpus": "ac",
  "doc_slug": "61-98",
  "doc_number": "61-98",
  "revision": "d",
  "title": "AC 61-98D",
  "publisher": "FAA",
  "publication_date": "2018-04-30",
  "source_url": "...",
  "source_sha256": "...",
  "fetched_at": "2026-04-27T21:20:43.205Z",
  "page_count": 49,
  "body_path": "ac/61-98/d/ac-61-98-d.md",
  "body_sha256": "...",
  "sections": [],
  "changes": []
}
```

The `sections` array is empty - AC PDFs are extracted as a single whole-doc body today. Section-level extraction is a follow-up WP.

The DB already holds 17 `study.reference` rows with `kind='ac'` (link-only catalogue from `course/references/advisory-circulars.yaml`). 5 of those slugs match an on-disk manifest (00-6, 61-83, 61-98, 90-66, 91-79); the other 4 slugs in the manifest set (25-7, 61-65, 91-21-1, 120-71) have no DB row yet.

## Decisions

### 1. Manifest shape: NEW discriminator `kind: 'ac'`

Add `acManifestSchema` next to `wholeDocManifestSchema` as a new member of the `manifestSchema` discriminated union.

NOT a reuse of `whole-doc` because:

- AC manifests use `doc_slug` + `revision`, not `document_slug` + `edition`.
- AC manifests carry `changes: []` (cancellations / supersessions list).
- The semantic level is `circular`, not `document`.

### 2. New section level: `circular`

`REFERENCE_SECTION_LEVELS.CIRCULAR = 'circular'` -- the AC's whole-document body row sits at depth 0 with `level: 'circular'`. Same shape as the whole-doc adapter (one row per AC), different label so the reader can render AC-specific chrome later.

### 3. Section schema

`{ levels: ['circular'], strict_sequence: true }` on every AC reference. One legal level at one legal depth.

### 4. Seed adapter

`libs/bc/study/src/seeders/ac.ts` exports `seedAcManifest(manifest, context, summary): Promise<string>`.

- Translates `(doc_slug, revision)` to DB `(document_slug, edition)` via `libs/sources/src/ac/seed-mapping.ts`.
- Produces ONE `reference_section` row at depth 0, level `'circular'`, code `'1'`, body from `<repo>/<body_path>`.
- Idempotent on `body_sha256` (matches the existing `upsertReferenceSection` content-hash short-circuit).
- Subjects + `primary_cert` come from the existing YAML row (preserved via `upsertReference`'s null-defaulting); the seed adapter does NOT carry subjects on the manifest itself - the YAML is the canonical authoring location for AC metadata.

### 5. Seed mapping registry

`libs/sources/src/ac/seed-mapping.ts` (new file) declares the explicit mapping:

| Manifest                | DB document_slug | DB edition |
| ----------------------- | ---------------- | ---------- |
| ac/00-6/b               | ac-00-6          | AC 00-6B   |
| ac/120-71/b             | ac-120-71        | AC 120-71B |
| ac/25-7/d               | ac-25-7          | AC 25-7D   |
| ac/61-65/j              | ac-61-65         | AC 61-65J  |
| ac/61-83/j              | ac-61-83         | AC 61-83J  |
| ac/61-98/d              | ac-61-98         | AC 61-98D  |
| ac/90-66/c              | ac-90-66         | AC 90-66C  |
| ac/91-21-1/d            | ac-91-21-1       | AC 91.21-1D|
| ac/91-79/a              | ac-91-79         | AC 91-79A  |

Manifests not in the map -> clear seed-time error ("AC manifest at <path> has no DB mapping; add an entry to seed-mapping.ts").

### 6. YAML backfill

The DB-side YAML (`course/references/advisory-circulars.yaml`) currently has 17 entries. To make the 9 manifests seedable, we add the 4 missing slugs (25-7, 61-65, 91-21-1, 120-71) to the YAML and adjust 2 mismatched edition tags so they match the manifest revisions:

- `ac-61-83`: edition `AC 61-83K` -> `AC 61-83J` (manifest is rev `j`).
- `ac-91-79`: edition `AC 91-79B` -> `AC 91-79A` (manifest is rev `a`).

Post-backfill: 21 AC YAML rows (and DB rows). 9 are readable; 12 stay link-only (the 8 originally and the 4 newly-added that don't have manifests... wait, all 4 new ones DO have manifests, so it's 12 link-only originals minus the 2 edition-corrected = 12 link-only and 9 readable, totalling 21).

## Acceptance criteria

- 9 of 21 `study.reference WHERE kind='ac'` rows have exactly 1 `reference_section` after `bun run db reset && bun run db seed`.
- The other 12 stay at 0 sections (link-only by design).
- `getReadableReferenceIds()` returns the 9 reference ids when probed against all 21.
- AC 61-98D body renders in `/library/<slug>` (spot check).
- `bun run check` clean.
- All existing manifest-validation + seed-references tests pass.
- New tests cover: AC manifest validation (positive + negative), AC seed adapter (synthetic AC -> 1 reference + 1 section, idempotent re-run).

## Out of scope

- Section-level extraction of AC PDFs (Changes, paragraphs). The `sections: []` and `changes: []` arrays stay empty until a follow-up WP.
- Importing the 8 ACs that have no on-disk manifest. They stay link-only until their PDFs are downloaded + ingested.
- AC paragraph citation reverse-lookup (the citation BC already has an `ac` kind; locator-level filtering happens in a separate pass).

## References

- ADR 018 -- source artifact storage policy
- ADR 019 -- canonical identifier scheme (`airboss-ref:ac/<doc-number>/<rev>`)
- ADR 020 -- errata flow
- ADR 021 -- per-corpus manifest layout
- `libs/bc/study/src/manifest-validation.ts` -- discriminated-union manifest schema
- `libs/bc/study/src/seeders/whole-doc.ts` -- pattern this adapter mirrors
- `libs/sources/src/ac/ingest.ts` -- writes the manifest shape this WP consumes
- `course/references/advisory-circulars.yaml` -- YAML source of truth for AC metadata
