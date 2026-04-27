---
title: 'Test plan: Reference handbook ingestion'
product: cross-cutting
feature: reference-handbook-ingestion
type: test-plan
status: unread
review_status: pending
---

# Test plan: Reference handbook ingestion

## Automated tests

| Suite | Lib | Coverage |
| --- | --- | --- |
| `locator.test.ts` | `libs/sources/src/handbooks/` | Every accepted locator shape (chapter / section / subsection / paragraph / intro / figure / table) under each doc; rejection messages for malformed input |
| `citation.test.ts` | `libs/sources/src/handbooks/` | All three styles (`short`, `formal`, `title`) for chapter / section / intro |
| `url.test.ts` | `libs/sources/src/handbooks/` | Live URL for each doc (PHAK, AFH, AvWX) |
| `derivative-reader.test.ts` | `libs/sources/src/handbooks/` | Read fixture manifest; find section by parsed locator; null for paragraph / figure / table |
| `resolver.test.ts` | `libs/sources/src/handbooks/` | All `CorpusResolver` methods against fixture; `getCurrentEdition` returns the right slug |
| `ingest.test.ts` | `libs/sources/src/handbooks/` | Fixture-driven ingest produces expected SourceEntries + Edition; re-run idempotent; atomic batch failure surfaces |
| `smoke.test.ts` | `libs/sources/src/handbooks/` | Validator accepts `[@cite](airboss-ref:handbooks/phak/8083-25C/12/3)` after ingest |

## Fixture

`tests/fixtures/handbooks/phak-fixture/` contains:

- `manifest.json` -- 1 chapter (`code: '1'`) with 2 sections (`1.1`, `1.2`) and 1 subsection (`1.2.1`); `source_url` set; `fetched_at` set.
- `01/index.md` -- chapter body
- `01/01-introduction.md` -- section 1.1 body
- `01/02-history.md` -- section 1.2 body
- `01/02-01-mail-route.md` -- subsection 1.2.1 body

The fixture is small enough that ingest runs in milliseconds and tests can exercise every path without a real handbook.

## Manual smoke test

After the PR ships, the user runs the following to verify end-to-end:

```bash
bun run handbook-corpus-ingest --doc=phak --edition=8083-25C
bun run handbook-corpus-ingest --doc=afh --edition=8083-3C
bun run handbook-corpus-ingest --doc=avwx --edition=8083-28B
bun run check
```

Expected:

- Each `handbook-corpus-ingest` invocation exits 0 and prints `entriesIngested=<N> alreadyAccepted=0` on first run, `entriesIngested=0 alreadyAccepted=<N>` on re-run.
- `bun run check` exits 0 with zero ERROR / WARN findings (assuming no lessons cite invalid handbook identifiers).
- The user adds `[@cite](airboss-ref:handbooks/phak/8083-25C/12/3)` to a lesson; `bun run check` still exits 0; the renderer (Phase 4) substitutes "PHAK Ch.12.3" at render time.

## Acceptance

- All automated tests pass under `bun test libs/sources/`.
- `bun run check` exits 0 across the whole repo.
- The manual smoke test above passes against the live derivative tree.
- The PR body explicitly notes any pre-existing `bun run check` errors that are not Phase 6's responsibility.

## Risks + edge cases

| Risk | Mitigation |
| --- | --- |
| Manifest schema drift in PR #242 | The reader validates required fields (`document_slug`, `edition`, `sections`); throws clear error if missing |
| Doc slug collision (e.g. PHAK and PHAK-supplement under same `phak/` dir) | The locator parser enforces single doc slugs; the manifest's `document_slug` must match |
| Edition slug ambiguity (`8083-25C` vs `FAA-H-8083-25C`) | The resolver maps short -> long via `DOC_EDITIONS` constant; locator always uses short form |
| Figures / tables resolve as ERROR | Phase 6 only `parses` figures / tables; no registry entry. The validator's row-2 check (entry not in registry) is bypassed because the locator is well-formed; renderer Phase 4 descends to the on-disk file when bound to `@text` / `@quote` |
| Re-ingest after PR #242 re-runs and re-writes derivatives with different content_hash | Phase 6 doesn't depend on hash matching; the lifecycle overlay handles idempotence |
