---
title: 'Test plan: Reference CFR ingestion (bulk)'
product: cross-cutting
feature: reference-cfr-ingestion-bulk
type: test-plan
status: unread
review_status: pending
---

# Test plan: Reference CFR ingestion (bulk)

## Automated coverage

Vitest unit + integration suites under `libs/sources/src/regs/`. Every file has a sibling `.test.ts`; cross-file integration sits in `ingest.test.ts`, `idempotence.test.ts`, and `smoke.test.ts`.

| Suite | What it covers |
| --- | --- |
| `locator.test.ts` | All accepted shapes from spec; rejection with clear message for malformed input; `regs` payload structure for each shape. |
| `citation.test.ts` | All three styles (`'short'`, `'formal'`, `'title'`) for section, subpart, Part. Throws on unknown style. |
| `url.test.ts` | Section / subpart / Part URLs for current edition (`/current/`) and past editions (`/on/<date>/`). Title 14 + Title 49. |
| `xml-walker.test.ts` | Against the in-repo Title 14 fixture: expected Part / subpart / section counts; section text concatenation; `last_amended_date` extraction; reserved-section handling. |
| `normalizer.test.ts` | NFC normalization (NFD input -> NFC output); blank-line collapse; canonical fields for each entry kind; `last_amended_date` fallback. |
| `cache.test.ts` | `resolveCacheRoot` honors `AIRBOSS_HANDBOOK_CACHE`; `cacheXmlPath` shape; `loadFixtureXml` reads + hashes a known fixture. |
| `derivative-writer.test.ts` | First write creates files; second write with identical input is a no-op; one body change rewrites exactly that file plus `sections.json`. Manifest fields populated. |
| `resolver.test.ts` | Each `CorpusResolver` method returns expected shape with primed test entries + editions. `getCurrentEdition` returns most recent year. `getDerivativeContent` reads from temp dir. |
| `ingest.test.ts` | End-to-end fixture ingestion populates SOURCES + EDITIONS, writes derivatives, records batch promotion to `accepted`. |
| `idempotence.test.ts` | Two consecutive `runIngest` calls; second reports zero modifications. |
| `smoke.test.ts` | Real `airboss-ref:regs/cfr-14/91/103?at=2026` in a temp lesson resolves with zero ERROR findings via `validateReferences`. |

All suites use `withTestEntries` / `withTestEditions` / `resetRegistry` from `libs/sources/src/registry/__test_helpers__.ts` for isolation.

## Manual smoke (operator)

1. **Fixture ingestion.** `bun run sources register cfr --fixture=tests/fixtures/cfr/title-14-2026-fixture.xml --out=/tmp/cfr-smoke`. Expect exit 0, derivative tree at `/tmp/cfr-smoke/cfr-14/2026-01-01/` with `manifest.json`, `sections.json`, and per-Part / per-section markdown files.
2. **Idempotence.** Re-run the same command. Expect "0 entries written, 0 files modified, 0 promotion batches recorded" or equivalent.
3. **Help.** `bun run sources register cfr --help`. Expect usage block.
4. **CI guard.** `CI=true bun run sources register cfr --edition=2026-01-01`. Expect exit 2 + stderr "CI without --fixture is unsupported" message.
5. **Validator publish gate.** Create a temp lesson at `course/regulations/_smoke.md` with body `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)`; run `bun run check`. Expect zero ERROR findings (after fixture ingestion has primed the active SOURCES table). Delete the temp file.
6. **Live eCFR (optional).** With network available and `--fixture=` omitted: `bun run sources register cfr --edition=2026-01-01`. Expect cache hit on the second run, full ingestion on first run, derivatives committed to `regulations/cfr-14/2026-01-01/`. Bytes are large; only run when actually shipping a real edition.

## Edge-case coverage gates

Per spec edge cases, each gets a test (or is documented as covered indirectly):

- Reserved sections: `xml-walker.test.ts` + `normalizer.test.ts`.
- Newly-created sections (no `AMDDATE`): `normalizer.test.ts` (fallback to publication date).
- Whole-Part / whole-subpart entries: `ingest.test.ts` (asserts presence in SOURCES).
- `AMDDATE` malformed: `xml-walker.test.ts` (regex falls through; logged at INFO).
- 404 from eCFR Versioner: documented in spec; not exercised in CI (would require network mocking that isn't worth standing up for a one-line error path).
- NFC normalization: `normalizer.test.ts`.
- Trailing whitespace / line endings: `normalizer.test.ts`.
- Re-promotion of `accepted` entry: `idempotence.test.ts`.
- Resolver methods called pre-ingest: `resolver.test.ts` (with empty active tables, every method returns the documented null/empty value).

## Negative tests

- Atomic batch failure: `lifecycle.test.ts` already covers the registry side; `ingest.test.ts` adds a case where one entry has a pre-existing terminal lifecycle (`retired`) so `recordPromotion` returns `{ ok: false }`. The test asserts that SOURCES + EDITIONS are unchanged and the pipeline exits non-zero.
- Malformed XML: `xml-walker.test.ts` -- a fixture with garbled tag structure; expects a clear error.
- Cache miss + no fixture + no network: `cache.test.ts` -- with the cache root pointed at an empty temp dir and the fetch helper stubbed to throw, `runIngest` exits non-zero with the documented message.

## Performance gate

The Title 14 fixture ingestion completes under 200 ms in CI. The derivative writer's hash-compare keeps re-runs in the millisecond range. No automated perf gate; if a fixture run grows past a few seconds, that's the trigger to revisit.

## Acceptance gates

- [ ] `bun run check` exits 0 with no errors and no warnings.
- [ ] `bun test libs/sources/` exits 0; every new test file passes; every Phase 1 + Phase 2 test still passes.
- [ ] `bun run sources register cfr --fixture=...` smoke run exits 0 and produces the documented derivative tree.
- [ ] Fixture-driven `smoke.test.ts` confirms the validator emits zero ERRORs against `airboss-ref:regs/cfr-14/91/103?at=2026`.
- [ ] No new findings from `/ball-review-full` (or any blocking review run after Phase 3 lands) -- if findings surface, fix per CLAUDE.md "ALWAYS FIX EVERYTHING from a review."
- [ ] Documented placeholder reviewer ID is referenced in the PR body so the user can re-promote later.
