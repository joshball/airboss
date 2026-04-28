# References

ACS / PTS / companion-guide / endorsement-source `study.reference` rows seeded by `bun run db seed references`.

This directory holds YAMLs for non-handbook references appended to the `reference` table. Handbook references are seeded separately by `bun run db seed handbooks` (the handbook ingestion pipeline owns those rows).

Each YAML carries:

- `slug` -- stable cross-edition document slug (PK component on `(document_slug, edition)`).
- `kind` -- `acs` / `pts` / `cfr` / `ac` / `aim` / `pcg` / `ntsb` / `poh` / `other` per `REFERENCE_KINDS`.
- `edition` -- FAA edition tag (e.g. `FAA-S-ACS-6C`, `FAA-S-8081-9E`).
- `title` -- display name.
- `publisher` -- defaults to `FAA`.
- `url` -- live URL to the FAA-published PDF or landing page.

The seed step is idempotent on `(document_slug, edition)` -- re-running with no changes is a no-op.
