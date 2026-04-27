# CFR test fixtures

Hand-trimmed slices of the eCFR Versioner XML used by the Phase 3 ingestion
tests. Provenance:

- `title-14-2026-fixture.xml` -- a minimal but real-shaped slice of 14 CFR
  containing Parts 61 + 91, two subparts each, four sections in total, plus
  one reserved section. Constructed by hand from the eCFR schema documentation;
  the structure mirrors what the live Versioner returns at
  `https://www.ecfr.gov/api/versioner/v1/full/2026-01-01/title-14.xml`.

These fixtures are intentionally small. The walker, normalizer, derivative
writer, and ingest orchestration are exercised against them in
`libs/sources/src/regs/*.test.ts`. Live ingestion (against the real eCFR API)
is an operator action, not a CI action.
