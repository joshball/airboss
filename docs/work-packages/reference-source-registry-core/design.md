---
title: 'Design: Reference source registry core'
product: cross-cutting
feature: reference-source-registry-core
type: design
status: unread
review_status: pending
---

# Design: Reference source registry core

## The registry lives in `libs/sources/src/registry/`

**Question:** Where do the constants table, resolver registration map, lifecycle state machine, and query API live?

**Chosen:** A new `libs/sources/src/registry/` directory inside the existing `@ab/sources` lib. Each concern in its own file: `sources.ts` (constants), `editions.ts` (edition map), `corpus-resolver.ts` (resolver registration), `lifecycle.ts` (state machine + audit trail), `query.ts` (query API). `index.ts` assembles a `RegistryReader`-shaped `productionRegistry` plus the registry namespace.

**Why:**

- ADR 019 §2 explicitly names `@ab/sources` as the home. No new lib.
- Splitting by concern (table / resolver / lifecycle / query) keeps each file under 300 lines and lets phase-3+ ingestion code wire in cleanly: a phase that adds a corpus drops a `parser-cfr.ts` next to `corpus-resolver.ts` and registers it.
- The Phase 1 surface (parser, validator, lesson-parser, registry-stub) stays at `libs/sources/src/*.ts`. New surface goes under `registry/`. No file is renamed; no Phase 1 import path breaks.

**Cost accepted:** Six new files. Each is small. Each is testable in isolation.

## `productionRegistry` is a `RegistryReader` plus a namespace

**Question:** Phase 1's `RegistryReader` interface has 9 methods. ADR 019 §2.3 lists 12 query functions. Are these the same surface or different?

**Chosen:** They're complementary. The `RegistryReader` interface stays exactly as Phase 1 defined it (the validator depends on those 9 methods). The Phase 2 query API (`resolveIdentifier`, `getChildren`, `walkSupersessionChain`, `findLessonsCiting*`, etc.) is a separate namespace export from `@ab/sources/registry`.

```typescript
import { productionRegistry } from '@ab/sources';
// ^ a RegistryReader -- 9 methods, used by the validator

import * as registry from '@ab/sources/registry';
// ^ the query API -- 12 methods + lifecycle helpers, used by the renderer + scripts
```

**Why:**

- The validator should not depend on the wide query surface; it uses only the methods on `RegistryReader`. Coupling it to the broader API would force every test to mock 12+ methods even when only one matters.
- Phase 4 (renderer) uses the wide query API (`resolveIdentifier` for token substitution, `walkSupersessionChain` for ack annotations, `findEntriesByCanonicalShort` for `@list` adjacency). The wider namespace is the right import for it.
- The lifecycle helpers (`recordPromotion`, `getBatch`) are only ever called by ingestion scripts and tooling; they don't belong on `RegistryReader` either.

**Cost accepted:** Two import paths for downstream consumers. Standard pattern (`@ab/db` exposes both a Drizzle client and a query helpers namespace).

## Default no-op resolvers register eagerly at module init

**Question:** ADR 019 enumerates 14+ corpora. Phase 2 has no real resolvers for any of them. Should the resolver map start empty (and crash on lookup) or pre-populate with no-op defaults?

**Chosen:** Pre-populate. Each enumerated corpus from §1.2 has a default no-op resolver registered at `corpus-resolver.ts` module init. Phase 3+ each call `registerCorpusResolver` to replace its corpus's default.

**Why:**

- The validator's row-1 check needs `isCorpusKnown` to return `true` for every enumerated corpus, even when no real resolver is registered. Pre-populating with no-ops gives `isCorpusKnown` something to look up.
- The query API's `getCurrentEdition(corpus)` returns `null` when no real resolver exists. That's the right Phase 2 behavior: registry knows the corpus name; nobody has populated entries yet; no current edition.
- Phase 3+ replace, not add. The replacement is a single function call inside the corpus's ingestion module's import-time setup. No registration ceremony at lesson-render time.
- An unknown corpus prefix (`airboss-ref:not-a-corpus/...`) has no entry in the resolver map; `isCorpusKnown` returns `false`; row 1 fires.

**Cost accepted:** One default resolver per corpus, even when nobody's using it yet. Each is ~10 lines; total ~150 lines of boilerplate. Acceptable for the clarity it buys.

## Atomic batch promotion is the audit trail's primary unit

**Question:** ADR 019 §2.4 says entries are promoted in batches or not at all. How do we represent that in the in-memory store, and what gets recorded?

**Chosen:** A `promotion_batches` `Map<batchId, PromotionBatch>` keyed by ULID. Every transition runs through `recordPromotion(batch)` which updates entry lifecycles + appends the batch record. Failures are detected before any entry is mutated; either every entry transitions or none does.

```typescript
function recordPromotion(input: PromotionInput): { ok: true; batch: PromotionBatch } | { ok: false; error: string } {
	// 1. Validate every entry in scope can transition (current lifecycle allows the target lifecycle)
	// 2. If any entry fails validation, return { ok: false } -- no mutation
	// 3. Otherwise: update entry lifecycles, append batch record, return success
}
```

**Why:**

- ADR 019 explicitly forbids half-promoted batches. The implementation must be defensive: validate all, then mutate.
- Batch ID lets de-promotion record `previousBatchId`. Audit trail is durable in memory; future persistence is a swap-in.
- The reviewer-id field is mandatory per §2.4. Phase 2 stores it as a string; later phases can validate against `identity.users` if/when the registry connects to the database.

**Cost accepted:** Two-phase mutation (validate, apply). Adds a few lines per promotion but eliminates a class of corruption bugs.

## `--fix` is byte-precise, in-place, idempotent

**Question:** How does the rewriter avoid breaking surrounding text? Lessons have authored prose; the rewriter must not touch anything but the URL portion of an unpinned `airboss-ref:` link.

**Chosen:** The rewriter:

1. Calls `parseLesson` to get `IdentifierOccurrence` records, each with a precise byte offset within the body.
2. For each occurrence whose pin is null, computes a one-byte-precise edit: insert `?at=<edition>` immediately after the URL's existing path-and-corpus segments. The URL inside an inline link `[text](airboss-ref:...)` is bounded by `(` ... `)`; the rewriter inserts `?at=<edition>` before the closing `)`.
3. Applies edits in reverse byte-offset order so each edit's offset remains valid after preceding edits have been applied.
4. Writes the file back via `writeFileSync(path, newSource, 'utf-8')`. No partial writes; failure surfaces as an exception that aborts the whole pass.
5. Re-runs the validator on the rewritten files. If new ERRORs appear, prints a diagnostic and exits non-zero. (Defensive; should be impossible in practice.)

**Why:**

- Reverse-order application is the standard trick for in-place edits on a string with multiple non-overlapping mutations. Avoids the "did I update the offset table after each edit" bookkeeping.
- The edit is one operation per identifier; complexity is O(n) where n is the number of unpinned identifiers. A pass over a 200-lesson corpus completes in milliseconds.
- The validator re-run is the safety net. If the rewriter accidentally mangles surrounding text, the validator will surface a fresh parse error.

### Why not regex-replace?

We rejected `body.replace(unpinnedUrlRegex, replacement)` because:

- Regex doesn't know about fenced code blocks. We'd need to mask code blocks first, do the replace, unmask. Brittle.
- The lesson-parser already gives us precise occurrences with skip-range awareness. Reusing it is cheaper than reproducing it.
- Using `parseLesson` ensures the rewriter and the validator agree on what counts as an identifier occurrence. No drift.

## Reverse-index walk is on-demand, cached per process

**Question:** `findLessonsCitingEntry` requires reverse-mapping every identifier in every lesson. Build the index eagerly at module load, or lazily on first call?

**Chosen:** Lazily, with a process-scoped cache. The first call to any `findLessonsCiting*` function builds the index by walking `LESSON_CONTENT_PATHS`; subsequent calls in the same process reuse it.

**Why:**

- One-shot CLI invocations (snapshot, validation) shouldn't pay the index-build cost if they don't ask for reverse lookups.
- For long-running processes (Phase 4 renderer in dev), the index is built once and reused. Filesystem-watch invalidation is a future enhancement; for Phase 2, the cost of restart-on-content-change is acceptable (lessons don't change at runtime in production).
- Lazy + cached is the right default. Eager forces every CLI to pay the cost; uncached forces every call to pay it.

**Implementation:**

```typescript
let cachedReverseIndex: ReverseIndex | null = null;

function getReverseIndex(): ReverseIndex {
	if (cachedReverseIndex !== null) return cachedReverseIndex;
	cachedReverseIndex = buildReverseIndex();
	return cachedReverseIndex;
}

function buildReverseIndex(): ReverseIndex {
	const index = new Map<SourceId, LessonId[]>();
	for (const path of LESSON_CONTENT_PATHS) {
		for (const file of walkMarkdownFiles(path)) {
			const lesson = parseLesson(relPath(file), readFileSync(file, 'utf-8'));
			for (const occ of lesson.occurrences) {
				const stripped = stripPin(occ.raw);
				const list = index.get(stripped) ?? [];
				list.push(lessonId(file));
				index.set(stripped, list);
			}
		}
	}
	return index;
}
```

`stripPin` removes `?at=...` so callers can query by canonical-form `SourceId` without the pin.

## `findLessonsTransitivelyCitingEntry` ships, even though lesson-to-lesson refs don't exist yet

**Question:** ADR 019 §2.3 lists `findLessonsTransitivelyCitingEntry` in the query API. No phase introduces lesson-to-lesson refs. Should we ship the function or defer it?

**Chosen:** Ship it. Implementation degrades to `findLessonsCitingEntry` for now (since no transitive edges exist). When lesson-to-lesson refs are introduced (a Phase 4+ concern), the function's body fills in.

**Why:**

- Shipping the surface now means downstream consumers can target a stable API. The function exists; its result happens to be the same as the direct query today.
- Removing the function and adding it back later is an API churn. Deferring inside a single function body is invisible to callers.
- ADR 019 explicitly lists this in the query API; not shipping it would be a spec drift.

**Cost accepted:** A function whose internal walk is a one-liner today. The implementation note says "extends to lesson-to-lesson edges when those land."

## JSON snapshot is a hash-map, not a list

**Question:** ADR 019 §2.5 says the snapshot is "a hash-map lookup, no async, no Postgres connection required." What's the file shape?

**Chosen:** Top-level object with `version`, `generatedAt`, and `entries` (a record keyed by `SourceId`). Each entry is an object with `entry`, `editions`, `currentEdition`.

```json
{
	"version": 1,
	"generatedAt": "2026-04-27T18:30:00.000Z",
	"entries": {
		"airboss-ref:regs/cfr-14/91/103": {
			"entry": { /* full SourceEntry */ },
			"editions": [ /* Edition[] */ ],
			"currentEdition": "2026"
		}
	}
}
```

**Why:**

- A record (object) keyed by `SourceId` lets a non-TypeScript consumer do `snapshot.entries[id]` for O(1) lookup. Lists would force a linear scan or a per-consumer index build.
- `version: 1` lets the consumer detect schema drift if/when we evolve the snapshot shape.
- `generatedAt` ISO-8601 timestamp is metadata for debugging cache freshness.

**Cost accepted:** JSON files keyed by full URI strings can be unwieldy in browser dev-tools, but the snapshot is meant for programmatic consumers, not human reading. (Humans can use `jq '.entries["airboss-ref:..."]' data/sources-snapshot.json`.)

## Snapshot path is gitignored, not committed

**Question:** Should the snapshot be committed (so consumers can pin to a known-good version) or gitignored (so each environment generates fresh)?

**Chosen:** Gitignored, regenerated on demand.

**Why:**

- Phase 2 ships an empty registry. The snapshot would be a one-line file (`{"version":1,"generatedAt":"...","entries":{}}`). Committing it would create churn on every regenerate.
- Later phases populate the registry from ingestion runs, which already write entries to `pending` lifecycle. Re-snapshotting is cheap; the source of truth stays in TypeScript.
- Consumers (Python RAG, Lambda image builders) regenerate during their own deploy step. No coupling between airboss commits and consumer cache freshness.

**Cost accepted:** Consumers must run `bun scripts/airboss-ref.ts snapshot` as a deploy step. Documented; standard for generated artifacts.

## CI guard on `--fix`

**Question:** ADR 019 says `--fix` is local-only; CI never invokes it. How do we enforce that?

**Chosen:** The `--fix` script checks `process.env.CI === 'true'` (the standard Github Actions / most-CI flag) and refuses to run with a clear error message.

```typescript
if (process.env.CI === 'true') {
	process.stderr.write('--fix is local-only; CI must not write to lesson files.\n');
	process.exit(2);
}
```

**Why:**

- The simplest possible guard. CI sets `CI=true`; local dev does not.
- A defensive measure -- nothing in `bun run check`'s wiring should pass `--fix` from CI, but the guard catches accidents.
- Exit code 2 distinguishes "guard tripped" from "validation found errors" (exit code 1).

## Backward compatibility with Phase 1 tests

**Question:** Phase 1's tests pass `NULL_REGISTRY` explicitly or implicitly (via the default in `validateReferences`). Phase 2 changes that default. Do existing tests still pass?

**Chosen:** Yes, with two tweaks:

1. `validateReferences()` default switches to `productionRegistry`. Tests that assumed the empty-registry semantics now pass `{ registry: NULL_REGISTRY }` explicitly.
2. The validator-row-1 activation means a few existing test cases that wrote `airboss-ref:not-real-corpus/foo?at=2026` and expected row-2 ERROR now expect row-1 ERROR. We update those test expectations.

**Why:**

- The default-flip is the right Phase 2 behavior: production code paths use the production registry. Test code paths can still inject the stub when they want empty-registry semantics.
- The Phase 1 tests that ride on row-2 firing for unknown corpora are testing a behavior that Phase 2 explicitly changes. Updating expectations is correct, not regression.

## Test fixtures: real registry vs in-memory stubs

**Question:** Phase 1 tests injected fixture `RegistryReader` instances. Phase 2 has a real registry, but its `SOURCES` table is empty. How do tests cover entries-exist scenarios?

**Chosen:** Two patterns:

1. **Query API tests** populate a test-only `Map`s before each test (using helper functions like `withTestEntries({...})`). The query API reads from the underlying maps, which the test has primed. After the test, the maps reset.
2. **Validator integration tests** continue to inject fixture `RegistryReader` instances inline. They don't need the real registry plumbing; they want isolated semantic checks.

**Why:**

- Mixing real-registry-with-test-data and stub-registry tests gives us coverage at both levels: the query API's semantics (real plumbing, fake data) and the validator's integration (stub plumbing, scripted scenarios).
- Test-only mutation of the underlying maps is fine because the maps are module-scoped, not exported from the public API. Tests import from a `__test_helpers__.ts` (or similar) module to access them.

**Cost accepted:** A `__test_helpers__.ts` file. Standard pattern for libs that ship with both production data and test fixtures.

## File map

```text
libs/sources/src/
  index.ts                       (Phase 1 -- adds productionRegistry export)
  types.ts                       (Phase 1 -- adds IndexedContent, ParsedLocator, LessonId)
  parser.ts                      (Phase 1 -- unchanged)
  validator.ts                   (Phase 1 -- row 1 activation)
  lesson-parser.ts               (Phase 1 -- unchanged)
  registry-stub.ts               (Phase 1 -- NULL_REGISTRY exported for tests)
  check.ts                       (Phase 1 -- default registry flips to production)
  fix.ts                         (Phase 2 -- new; --fix mode rewriter)
  fix.test.ts                    (Phase 2 -- new)
  snapshot.ts                    (Phase 2 -- new; JSON snapshot generator)
  snapshot.test.ts               (Phase 2 -- new)
  registry/
    index.ts                     (Phase 2 -- assembles productionRegistry + namespace)
    sources.ts                   (Phase 2 -- SOURCES constants)
    editions.ts                  (Phase 2 -- EDITIONS map)
    corpus-resolver.ts           (Phase 2 -- CorpusResolver interface + registration)
    corpus-resolver.test.ts      (Phase 2 -- new)
    lifecycle.ts                 (Phase 2 -- state machine + promotion batches)
    lifecycle.test.ts            (Phase 2 -- new)
    query.ts                     (Phase 2 -- 12-function query API)
    query.test.ts                (Phase 2 -- new)
    registry.test.ts             (Phase 2 -- production registry integration)
    __test_helpers__.ts          (Phase 2 -- test-only mutation helpers)

scripts/
  airboss-ref.ts                 (Phase 2 -- subcommand parser; --fix and snapshot)
  check.ts                       (Phase 2 -- unchanged; airboss-ref.ts subcommand stays the entry)
```

## Reference flow (end-to-end)

### Author runs `bun run check --fix`

```text
bun scripts/airboss-ref.ts --fix
                               |
                               | (subcommand parser)
                               v
                       runFixCli(opts)
                               |
                               | (walks LESSON_CONTENT_PATHS)
                               v
                  parseLesson(file) for each .md
                               |
                               | (filter: pin === null && corpus has currentAccepted)
                               v
                       computed edits per file
                               |
                               | (apply in reverse offset order)
                               v
                       writeFileSync(file, newBody)
                               |
                               | (re-run validator for sanity)
                               v
                       runCli({ registry: productionRegistry })
                               |
                               v
                          exit 0 (or non-zero if new errors surfaced)
```

### Renderer (Phase 4) resolves an identifier

```text
[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)
                       |
                       | (extractIdentifiers)
                       v
                ['airboss-ref:regs/cfr-14/91/103?at=2026']
                       |
                       | (batchResolve)
                       v
   resolveIdentifier(stripPin(id)) -> SourceEntry
                       |
                       | (token substitution)
                       v
                "§91.103 Preflight action"
```

### Annual diff job (Phase 5) advances pins

```text
diff job
   |
   | (registry.getEditions(id))
   v
   [{ id: '2025', ... }, { id: '2026', ... }, { id: '2027', ... }]
   |
   | (hash-compare normalized text per edition)
   v
   for each lesson citing the entry: rewrite ?at=2026 -> ?at=2027 if hash match
```

Phase 2 ships the substrate; Phase 5 ships the rewrite logic.

## What this WP does NOT do

| Capability | Phase |
| --- | --- |
| Rewrite stale pins (`?at=2024 -> ?at=2026`) | Phase 5 (annual diff job) |
| Render tokens (`@cite -> §91.103 Preflight action`) | Phase 4 (renderer) |
| Populate `regs` corpus with CFR text | Phase 3 (CFR ingestion) |
| Populate `handbooks` corpus with PHAK/AFH text | Phase 6 |
| Populate `aim` corpus | Phase 7 |
| Populate `ac` corpus | Phase 8 |
| Migrate pre-ADR-019 lessons | Phase 9 |
| Hangar UI for non-engineer authoring | revisit.md R5 (deferred) |
| Persist lifecycle state to Postgres | Future WP if/when needed |
