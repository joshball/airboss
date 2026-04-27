---
title: 'Test plan: Reference AIM ingestion'
product: cross-cutting
feature: reference-aim-ingestion
type: test-plan
status: unread
review_status: pending
---

# Test plan: Reference AIM ingestion

## Automated tests

| Suite                       | Lib                       | Coverage                                                                                                                              |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `locator.test.ts`           | `libs/sources/src/aim/`   | Every accepted locator shape (chapter / section / paragraph / glossary entry / appendix); rejection messages for malformed input      |
| `citation.test.ts`          | `libs/sources/src/aim/`   | All three styles (`short`, `formal`, `title`) for paragraph / section / chapter / glossary / appendix                                 |
| `url.test.ts`               | `libs/sources/src/aim/`   | Live URL for paragraph, chapter, glossary entry, appendix; null for malformed SourceId; pin stripping                                  |
| `derivative-reader.test.ts` | `libs/sources/src/aim/`   | Read fixture manifest; find entry by parsed locator; null for unknown locator                                                          |
| `resolver.test.ts`          | `libs/sources/src/aim/`   | All `CorpusResolver` methods against fixture; `getCurrentEdition` returns the right slug                                              |
| `ingest.test.ts`            | `libs/sources/src/aim/`   | Fixture-driven ingest produces expected SourceEntries + Edition; re-run idempotent; manifest-missing surfaces clear error             |
| `smoke.test.ts`             | `libs/sources/src/aim/`   | Validator accepts `[@cite](airboss-ref:aim/5-1-7?at=2026-09)` after ingest                                                            |

## Fixture

`tests/fixtures/aim/aim-fixture/aim/2026-09/` contains:

- `manifest.json` -- 1 chapter (`5`) with 1 section (`5-1`) and 2 paragraphs (`5-1-7`, `5-1-8`); 1 glossary entry (`pilot-in-command`); 1 appendix (`appendix-1`); `source_url` set; `fetched_at` set.
- `chapter-5/index.md` -- chapter 5 body
- `chapter-5/section-1/index.md` -- section 5-1 body
- `chapter-5/section-1/paragraph-7.md` -- paragraph 5-1-7 body
- `chapter-5/section-1/paragraph-8.md` -- paragraph 5-1-8 body
- `glossary/pilot-in-command.md` -- glossary entry body
- `appendix-1.md` -- appendix body

The fixture is small enough that ingest runs in milliseconds and tests can exercise every path without a real AIM derivative tree.

## Manual smoke test

After the PR ships, the user runs the following to verify end-to-end against the fixture:

```bash
bun run ingest aim --edition=2026-09 --out=tests/fixtures/aim/aim-fixture/aim
bun run check
```

Expected:

- `aim-corpus-ingest` exits 0 and prints `entriesIngested=<N> alreadyAccepted=0` on first run, `entriesIngested=0 alreadyAccepted=<N>` on re-run.
- `bun run check` exits 0 with zero ERROR / WARN findings (assuming no lessons cite invalid AIM identifiers).
- The user adds `[@cite](airboss-ref:aim/5-1-7?at=2026-09)` to a lesson; `bun run check` still exits 0; the renderer (Phase 4) substitutes "AIM 5-1-7" at render time.

## Acceptance

- All automated tests pass under `bun test libs/sources/`.
- `bun run check` exits 0 across the whole repo.
- The PR body explicitly notes any pre-existing `bun run check` errors that are not Phase 7's responsibility.

## Risks + edge cases

| Risk                                                        | Mitigation                                                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest schema drift across editions                        | The reader validates required fields (`edition`, `entries`); throws clear error if missing.                                                                |
| Year-month edition slug collision (multiple cycles per year) | The slug is `YYYY-MM`; the FAA publishes at most one revision per month, so collisions are not realistic.                                                  |
| Glossary slug ambiguity                                     | Slugs are kebab-case lowercase, normalized at ingest from the manifest's title; the parser enforces the format.                                            |
| Sub-paragraph identifiers requested                         | Phase 7 only parses the documented shapes. Sub-paragraph requests are a follow-up; ADR 019 §1.2 currently stops at paragraph.                              |
| Re-ingest after operator re-runs source pipeline             | Phase 7 doesn't depend on hash matching; the lifecycle overlay handles idempotence.                                                                        |
