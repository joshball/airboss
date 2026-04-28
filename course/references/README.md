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

## Files

- `acs-pts.yaml` -- per-cert ACS and PTS publications.
- `advisory-circulars.yaml` -- AC NN-NN editions.
- `aim-pcg.yaml` -- Aeronautical Information Manual + Pilot/Controller Glossary.
- `cfr-titles.yaml` -- 14 CFR parts.
- `handbooks-noningested.yaml` -- FAA handbooks referenced from knowledge nodes but not yet ingested via the `handbooks/` derivative pipeline.
- `ntsb.yaml` -- NTSB accident-reports umbrella row.
- `poh.yaml` -- POH / AFM umbrella row.
- `other-publications.yaml` -- non-FAA-handbook / non-CFR publications cited from knowledge nodes (AOPA ASI, FAA-P-8740-36, FAA Order 8260.3 / TERPS, approach plates, Jeppesen charts, Rogers AIAA paper, plus the `generic-acs` / `generic-pts` umbrella fallbacks).

The seed step is idempotent on `(document_slug, edition)` -- re-running with no changes is a no-op.
