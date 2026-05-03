# WP-RMH -- test plan

## Automated

### `bun run check`

Must pass clean (zero errors, zero warnings).

### Python pipeline unit tests

- `tools/handbook-ingest/tests/` -- existing tests still pass after the
  `bookmark_chapter_filter` and `primary_cert` additions
- A new test exercising `parse_outline` with a synthetic TOC that
  contains both front-matter L1 entries and chapter L1 entries, asserts
  only the chapter-shaped entries survive when the filter is set

### TS unit tests

- `libs/sources/src/handbooks-extras/ingest.test.ts`
  - `DOC_ID_TO_FRIENDLY` covers the 4 surviving doc_ids
  - live-cache smoke test ingests 4 entries (was 5)
  - `risk-management` no longer appears in any post-ingest assertion
- `libs/sources/src/handbooks/derivative-reader.test.ts`
  - existing manifest validation still passes
- `libs/bc/study/src/seeders/section-tree.test.ts`
  - existing tests pass; the RMH manifest is well-formed input

### End-to-end seed

- `bun run db reset --force && bun run db seed` finishes without errors
- Probe DB: `study.reference` row for slug `risk-management` exists and
  has `section_schema = {levels: ['chapter','section','subsection'],
  strict_sequence: true}`
- Probe DB: `study.reference_section` rows for that reference include at
  least 12 chapter-level rows (Chapter 1-8 + Appendix A-D)
- Probe DB: `getReadableReferenceIds([rmhId])` returns `{rmhId}`

## Manual

- Visit `/library` -- RMH card now shows chapter drill-down (was a
  whole-doc link)
- Click into chapter 4 (Assessing Risk) -- body renders with H1/H2
  headings consistent with the FAA PDF
- Citations widget for any RMH section produces
  `RMH Ch.<n>` short form

## Smoke gates before merge

- handbooks-extras smoke test passes against the LIVE cache (skips on
  machines without the cache)
- `bun run sources verify-urls` does not regress (RMH URL stays valid)
