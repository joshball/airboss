---
title: 'Spec: Reference source registry core'
product: cross-cutting
feature: reference-source-registry-core
type: spec
status: unread
review_status: pending
---

# Spec: Reference source registry core

Phase 2 of the 10-phase ADR 019 rollout. Replaces the `NULL_REGISTRY` stub shipped in [Phase 1](../reference-identifier-scheme-validator/) with the production registry that lives inside `@ab/sources`. After Phase 2 lands, the `airboss-ref:` validator stops emitting blanket row-2 ERRORs because (a) the registry can answer `isCorpusKnown` for every enumerated corpus, (b) entries can transition through the lifecycle state machine, (c) authors can run `bun run check --fix` to auto-stamp pins, and (d) non-TypeScript consumers can read a JSON snapshot of the static + indexed tier.

The Phase 2 registry ships **empty**. No corpus content lands here. CFR ingestion is Phase 3; handbooks Phase 6; AIM Phase 7; AC Phase 8; irregulars Phase 10. Phase 2's job is to build the substrate so each ingestion phase can register its own resolver and feed entries through `pending -> accepted` without amending the registry's interface.

## Why this matters

Phase 1's `NULL_REGISTRY` is correct as an interim ("any author who writes a real identifier today gets a row-2 ERROR until a corpus lands") but it leaves four loose ends:

1. **Authors cannot stamp pins.** Every `airboss-ref:` URL needs `?at=<edition>` (or a slug-encoded edition). The validator has no way to auto-stamp because the stub doesn't know "current accepted" for any corpus. The `--fix` mode is what makes the discipline tolerable; without it every author types the year by hand.
2. **The registry's lifecycle is theory, not code.** ADR 019 §2.4 specifies a 5-state machine with atomic batch promotion. Phase 1 has no implementation; Phase 3 cannot land entries as `pending` without it.
3. **Non-TypeScript consumers are blind.** ADR 019 §2.5 says a JSON snapshot of the static + indexed tier is published for Python RAG, Lambda image builders, etc. Phase 1 doesn't generate one.
4. **Validator row 1 is half-done.** Phase 1 leaves `isCorpusKnown` no-op'd because the stub returns false for every corpus and would double-fire with row 2. Phase 2's registry returns true for every enumerated corpus from §1.2 (even with no entries), so row 1 finally distinguishes "unknown corpus prefix" from "known corpus, unknown locator."

Closing those four loose ends unblocks Phase 3 (CFR ingestion), Phase 4 (renderer), Phase 5 (annual diff), and Phase 9 (lesson migration) without further substrate work.

## Success Criteria

- `libs/sources/src/registry/` directory exists with the production `RegistryReader` implementation, the `SOURCES` constants table, the per-corpus `CorpusResolver` registration map, and the lifecycle state machine.
- The query API surface (12 functions per ADR 019 §2.3) is callable from any TypeScript consumer.
- `bun run check --fix` rewrites unpinned identifiers in lesson files in place, stamping `?at=<currentAccepted>` when the corpus has an accepted edition. Already-pinned identifiers are left alone.
- `bun run check` (no `--fix`) is read-only as it was in Phase 1.
- `bun scripts/airboss-ref.ts snapshot` writes a JSON snapshot to a configurable path (default: `data/sources-snapshot.json`, gitignored) containing every static `SourceEntry` + every `Edition` known to the registry.
- `scripts/check.ts` invokes the production registry via `validateReferences({ registry: PRODUCTION_REGISTRY })` (or equivalent default).
- Validator row 1 fires "corpus is not enumerated" for `airboss-ref:not-a-corpus/foo` (Phase 1 silently passed those through to row 2).
- All 12 enumerated corpora from ADR 019 §1.2 register a default resolver. The default resolver returns `null` for `getCurrentEdition` and `getDerivativeContent` so the validator behaves identically to today (empty registry) for any corpus that hasn't shipped its real resolver yet.
- Vitest tests cover: query API correctness, lifecycle transitions, `--fix` rewrite correctness (file in / file out comparison), snapshot output shape, validator integration via the production registry, `findLessonsCitingEntry` walking lesson files.
- `bun run check` exits 0; `bun test libs/sources/` passes; svelte-check unaffected.

## Scope

### In

- `libs/sources/src/registry/sources.ts` -- the typed `Record<SourceId, SourceEntry>` constants table. Initially empty; the type signature is the contract every later phase loads against.
- `libs/sources/src/registry/editions.ts` -- in-memory `Map<SourceId, readonly Edition[]>` keyed by entry. Initial population: empty.
- `libs/sources/src/registry/corpus-resolver.ts` -- the `CorpusResolver` interface (per ADR 019 §2.2), the registration map, the default no-op resolver registered for each corpus from §1.2, and the resolver lookup helpers.
- `libs/sources/src/registry/lifecycle.ts` -- the 5-state machine, transition validation, atomic batch promotion (`promotion_batches` typed shape), de-promotion path. Backed by an in-memory `Map<batchId, PromotionBatch>`; later phases can persist.
- `libs/sources/src/registry/query.ts` -- the 12 query functions per ADR 019 §2.3. Supersession-chain walk, alias chain walk (consumed via `walkAliases` already in the `RegistryReader` interface), reverse-index walks for the `findLessonsCiting*` family.
- `libs/sources/src/registry/index.ts` -- assembles a single `productionRegistry: RegistryReader` plus a registry namespace export with the query API + lifecycle helpers.
- `libs/sources/src/snapshot.ts` -- the JSON snapshot generator. CLI entry point `bun scripts/airboss-ref.ts snapshot [--out=path]`.
- `libs/sources/src/fix.ts` -- the `--fix` rewriter. Walks lesson files, identifies unpinned `airboss-ref:` URLs, looks up `getCurrentAcceptedEdition(corpus)`, rewrites bodies in place. Idempotent.
- `scripts/airboss-ref.ts` extension: subcommand parser. `bun scripts/airboss-ref.ts` (default) -> validate. `bun scripts/airboss-ref.ts --fix` -> validate + rewrite. `bun scripts/airboss-ref.ts snapshot [--out=...]` -> write snapshot. `--fix` is local-only; CI never invokes it.
- `scripts/check.ts` swap: replace `NULL_REGISTRY` (the implicit Phase 1 default in `validateReferences`) with the production registry. Phase 1 still calls `validateReferences()` with the default; Phase 2 changes the default inside `check.ts` (the production registry is the new default).
- Validator row 1 activation: `validator.ts` removes the comment-out and calls `ctx.registry.isCorpusKnown(parsed.corpus)`. The production registry returns `true` for every enumerated corpus, so existing tests pass; an unknown corpus produces a fresh ERROR.
- `data/sources-snapshot.json` path added to `.gitignore` (the snapshot is generated per environment, not committed).
- Vitest tests in `libs/sources/src/registry/*.test.ts`, `libs/sources/src/snapshot.test.ts`, `libs/sources/src/fix.test.ts`. Existing parser/validator/lesson-parser/check tests remain valid.
- `findLessonsCitingEntry` and the transitive walk implementation: walks the same lesson paths the validator scans (`LESSON_CONTENT_PATHS`), parses each lesson, builds a forward-and-reverse index in memory, exposes the queries. Index is rebuilt on demand; later phases can cache.

### Out

- Actual corpus content. CFR (Phase 3), handbooks (Phase 6), AIM (Phase 7), AC (Phase 8), irregulars (Phase 10). Phase 2 ships empty; the table type is the contract.
- The annual diff job (Phase 5).
- The renderer (Phase 4).
- The lesson migration tool that rewrites pre-ADR-019 lessons (Phase 9).
- `apps/hangar/` UI for non-engineer registry editing (revisit.md R5, deferred until hangar ships).
- HTTP API for external tools. Per ADR 019 §2.7, external tools import the query API directly; no HTTP surface.
- Persisted lifecycle state. Phase 2's `promotion_batches` map is in-memory; later phases (or a follow-on registry-persistence WP) can move it to Postgres if real promotion runs require durability. The audit-trail shape is final; only the storage backend is provisional.
- Citation formatters beyond the per-corpus resolver's `formatCitation`. The token vocabulary lives in Phase 4 (renderer); Phase 2 exposes `formatCitation(entry, style)` so the renderer has a place to call.

## Data Model

### `SOURCES` constants table

```typescript
// libs/sources/src/registry/sources.ts
import type { SourceEntry, SourceId } from '../types.ts';

/**
 * Static identity table for every entry in every corpus. Populated by per-corpus
 * ingestion phases (Phase 3 CFR, Phase 6 handbooks, etc.). Phase 2 ships empty.
 *
 * The type is the contract; later phases append entries by appending to this
 * record. Keys are the canonical `airboss-ref:` URI strings (without `?at=`).
 */
export const SOURCES: Readonly<Record<SourceId, SourceEntry>> = Object.freeze({});
```

### Edition data

```typescript
// libs/sources/src/registry/editions.ts
import type { Edition, SourceId } from '../types.ts';

/**
 * Per-entry edition history. Phase 2 ships empty; later phases populate via
 * ingestion-pipeline runs. Keyed by the entry's `SourceId` (the `?at=`-stripped
 * canonical form).
 */
export const EDITIONS: ReadonlyMap<SourceId, readonly Edition[]> = new Map();
```

### `CorpusResolver` (ADR 019 §2.2)

```typescript
// libs/sources/src/registry/corpus-resolver.ts
import type { Edition, IndexedContent, SourceEntry, SourceId } from '../types.ts';

export type CitationStyle = 'short' | 'formal' | 'title';
export type EditionId = string;

export interface CorpusResolver {
	readonly corpus: string;
	parseLocator(locator: string): ParsedLocator | LocatorError;
	formatCitation(entry: SourceEntry, style: CitationStyle): string;
	getCurrentEdition(): EditionId | null;
	getEditions(id: SourceId): Promise<readonly Edition[]>;
	getLiveUrl(id: SourceId, edition: EditionId): string | null;
	getDerivativeContent(id: SourceId, edition: EditionId): string | null;
	getIndexedContent(id: SourceId, edition: EditionId): Promise<IndexedContent | null>;
}
```

The resolver registry is `Map<corpus, CorpusResolver>`. Default no-op resolver registered for each corpus listed in ADR 019 §1.2 (`regs`, `aim`, `ac`, `interp`, `orders`, `handbooks`, `pohs`, `statutes`, `sectionals`, `plates`, `ntsb`, `acs`, `forms`, `tcds`, `asrs`).

The default no-op resolver returns:

- `parseLocator` -> `{ kind: 'ok', segments: locator.split('/') }` (treats locator as opaque path segments)
- `formatCitation` -> the entry's `canonical_short` / `canonical_formal` / `canonical_title` field directly (no per-corpus formatting)
- `getCurrentEdition` -> `null` (no editions known)
- `getEditions` -> resolves to `EDITIONS.get(id) ?? []`
- `getLiveUrl` -> `null`
- `getDerivativeContent` -> `null`
- `getIndexedContent` -> resolves to `null`

Phase 3+ each register a real resolver via `registerCorpusResolver(resolver: CorpusResolver)`, which replaces the default for that corpus. The validator never knows the difference.

### Lifecycle state machine (ADR 019 §2.4)

```typescript
// libs/sources/src/registry/lifecycle.ts
import type { SourceLifecycle, SourceId } from '../types.ts';

export interface PromotionBatch {
	readonly id: string;
	readonly corpus: string;
	readonly reviewerId: string;
	readonly promotionDate: Date;
	readonly scope: readonly SourceId[];
	readonly inputSource: string;
	readonly state: 'promoted' | 'de-promoted';
	readonly previousBatchId?: string;
}

export type LifecycleTransition =
	| { from: 'draft'; to: 'pending' }
	| { from: 'pending'; to: 'accepted' }
	| { from: 'accepted'; to: 'retired' }
	| { from: 'accepted'; to: 'superseded' }
	| { from: 'pending'; to: 'retired' }
	| { from: 'accepted'; to: 'pending' }; // de-promote
```

State machine invariants:

- `pending -> accepted` and `accepted -> pending` (de-promote) are batch operations; every entry in a batch transitions atomically.
- `accepted -> retired` and `accepted -> superseded` can transition single entries.
- `draft -> pending` is the bulk-load path (one batch per ingestion run).
- Half-promoted batches are forbidden: every transition records its batch id; batch transitions either succeed for all scoped IDs or none.

Phase 2 ships the in-memory implementation. The audit trail (`promotion_batches`) is a `Map<batchId, PromotionBatch>` exposed via `getBatch(id)` / `listBatches()` / `recordPromotion(...)`. Persistence is deliberately out of scope; later phases can move it to Postgres without changing the surface.

### Query API (ADR 019 §2.3)

```typescript
// libs/sources/src/registry/query.ts
import type { Edition, EditionId, LessonId, SourceEntry, SourceId } from '../types.ts';

export function resolveIdentifier(id: SourceId): SourceEntry | null;
export function hasEntry(id: SourceId): boolean;
export function getChildren(id: SourceId): readonly SourceEntry[];
export function walkSupersessionChain(id: SourceId): readonly SourceEntry[];
export function isSupersessionChainBroken(id: SourceId): boolean;
export function findEntriesByCanonicalShort(short: string): readonly SourceEntry[];
export function findLessonsCitingEntry(id: SourceId): Promise<readonly LessonId[]>;
export function findLessonsTransitivelyCitingEntry(id: SourceId): Promise<readonly LessonId[]>;
export function findLessonsCitingMultiple(ids: readonly SourceId[]): Promise<readonly LessonId[]>;
export function getCurrentEdition(corpus: string): EditionId | null;
export function getEditions(id: SourceId): Promise<readonly Edition[]>;
export function isPinStale(id: SourceId, pin: EditionId): Promise<boolean>;
```

`getChildren` is computed via slug prefix on the SourceId path. Example: `airboss-ref:regs/cfr-14/91/103` is a child of `airboss-ref:regs/cfr-14/91` and a parent of `airboss-ref:regs/cfr-14/91/103/b`.

`findLessonsCitingEntry` walks `LESSON_CONTENT_PATHS`, parses each lesson via `parseLesson`, and matches identifier occurrences whose pin-stripped form equals the queried `SourceId`. Transitive walk extends this to lessons that reference other lessons (lesson-to-lesson refs are not in scope today; the function handles the direct-ref case and reserves the walk algorithm for when lesson-to-lesson refs land).

`isPinStale` returns `true` when the pin's edition distance from the current accepted edition exceeds 1.

### `--fix` mode

Behavior per ADR 019 §1.3:

| Case | `--fix` action |
| --- | --- |
| Identifier has no `?at=` AND its corpus's resolver has no slug-encoded edition convention | Look up `getCurrentAcceptedEdition(corpus)`. If non-null, append `?at=<edition>` to the URL in the lesson file. If null, leave alone (validator still emits row-3 ERROR). |
| Identifier has `?at=...` already | Leave alone. (`--fix` does not advance stale pins; the diff job in Phase 5 owns that.) |
| Identifier uses slug-encoded edition (e.g. `airboss-ref:ac/61-65/j`) | Leave alone. Per ADR 019 §1.3 the slug satisfies the pinning rule. |
| Identifier is unknown-corpus (`airboss-ref:unknown/...`) | Leave alone. `--fix` does not invent corpora. |
| Identifier is malformed (path-absolute, authority-based, etc.) | Leave alone. `--fix` does not repair shape errors. |

The rewriter:

1. Walks `LESSON_CONTENT_PATHS`, reads each `.md` file.
2. Parses via `parseLesson` to locate identifier occurrences. Skips fenced code blocks and inline code (same skip logic as the validator).
3. For each occurrence whose `pin` is null (parsed) and whose corpus has a `getCurrentAcceptedEdition` value, builds the rewritten URL `<original>?at=<edition>`.
4. Applies edits to the file body in reverse-source-order so byte offsets remain valid mid-rewrite.
5. Writes the file back via `writeFileSync`. Reports per-file edits.
6. Runs the validator again (without `--fix`) on the rewritten files for sanity. The second pass should be 0 ERRORs assuming the first run only had unpinned-identifier errors.

`--fix` is opt-in. CI never runs it. The script's CI guard: refuse to run when `process.env.CI === 'true'`.

### JSON snapshot (ADR 019 §2.5)

```typescript
// libs/sources/src/snapshot.ts
import type { SourceEntry, Edition, SourceId } from './types.ts';

export interface SnapshotShape {
	readonly version: 1;
	readonly generatedAt: string; // ISO-8601
	readonly entries: Record<SourceId, SnapshotEntry>;
}

export interface SnapshotEntry {
	readonly entry: SourceEntry;
	readonly editions: readonly Edition[];
	readonly currentEdition: string | null;
}

export function generateSnapshot(): SnapshotShape;
export function writeSnapshotSync(path: string): void;
```

`writeSnapshotSync` calls `generateSnapshot()` and writes JSON.stringify(..., null, 2) to the named path. Default path: `data/sources-snapshot.json` (gitignored).

The CLI entry: `bun scripts/airboss-ref.ts snapshot [--out=path]`. Exit 0 on success.

## Behavior

### Validator integration

`validator.ts` row 1 currently has a comment-out for the `isCorpusKnown` check. After Phase 2:

```typescript
// Row 1 -- identifier parses; corpus enumerated; non-empty locator.
if (parsed.locator.length === 0) {
    pushFinding('error', 1, 'identifier has empty locator');
} else if (!ctx.registry.isCorpusKnown(parsed.corpus)) {
    pushFinding('error', 1, `corpus "${parsed.corpus}" is not enumerated in ADR 019 §1.2`);
}
```

The production registry's `isCorpusKnown` returns `true` for every corpus from §1.2 (regardless of whether the corpus has any entries yet) and `false` otherwise. This makes "unknown corpus prefix" a row-1 ERROR (precedes row 2's "no entry" ERROR), which gives authors a clearer signal.

Tests that previously passed `NULL_REGISTRY` and expected row-2 to fire continue to work because `NULL_REGISTRY` still returns `false` for `isCorpusKnown`; row 1 fires first. The Phase 1 validator tests are updated accordingly.

### `scripts/check.ts` swap

Phase 1 invokes `validateReferences()` with no opts; the function defaults to `NULL_REGISTRY`. Phase 2 changes the default inside `validateReferences` to the production registry imported from `@ab/sources/registry`. Tests that need the empty-registry semantics continue to pass `{ registry: NULL_REGISTRY }` explicitly. The named symbol `NULL_REGISTRY` stays exported for tests + downstream consumers.

### Reverse-index walk for `findLessonsCiting*`

The reverse index is built on demand. Implementation:

1. Walk `LESSON_CONTENT_PATHS` (same paths the validator scans).
2. For each lesson, run `parseLesson` and collect identifier occurrences.
3. Build a `Map<SourceIdWithoutPin, LessonId[]>`. Strip `?at=` from each occurrence's URL to get the pin-agnostic key.
4. Cache the index in memory for the lifetime of the process. (For long-running processes, future phases can add filesystem-watch invalidation. For one-shot CLI invocations, the cache is rebuilt per run.)

`LessonId` is the lesson's repo-relative path with the `.md` extension stripped (e.g. `course/regulations/week-04-part-91-general-and-flight-rules/05-preflight-action`).

## Dependencies

- **Upstream:** ADR 019 (accepted v3); Phase 1 (`reference-identifier-scheme-validator`, PR #241).
- **Downstream:** Phase 3 (CFR ingestion) registers a real `regs` resolver; Phase 4 (renderer) consumes the query API for token substitution; Phase 5 (annual diff) uses the `promotion_batches` audit trail; Phase 9 (lesson migration) uses the `--fix` mode.

## Validation

| Concern | Where it runs |
| --- | --- |
| Query API correctness (12 functions) | Vitest unit (`registry/query.test.ts`) |
| Lifecycle transitions per §2.4 | Vitest unit (`registry/lifecycle.test.ts`) |
| Atomic batch promotion all-or-nothing | Vitest unit |
| `--fix` rewrites only unpinned identifiers; preserves slug-encoded editions | Vitest unit (`fix.test.ts`) using temp directory + fixture lessons |
| `--fix` is idempotent: second run is a no-op | Vitest unit |
| `--fix` refuses to run in CI (`CI === 'true'`) | Vitest unit (process.env stub) |
| Snapshot JSON shape matches schema | Vitest unit (`snapshot.test.ts`) |
| Validator row 1 fires on unknown corpus via production registry | Vitest unit |
| `findLessonsCitingEntry` walks lesson files correctly | Vitest unit |
| `bun run check` exits 0 on `course/regulations/**` (no airboss-ref: URLs today) | Manual gate |
| `bun run check --fix` is a no-op when no unpinned URLs exist | Manual gate |

## Edge Cases

- **Unknown corpus.** `airboss-ref:not-a-corpus/foo?at=2026` -> row 1 ERROR ("corpus 'not-a-corpus' is not enumerated in ADR 019 §1.2"). Phase 1's behavior was a row-2 ERROR; Phase 2 distinguishes shape errors from registry-empty-for-known-corpus errors.
- **Unpinned identifier in a corpus with no accepted edition.** `--fix` cannot stamp because `getCurrentAcceptedEdition` returns null. Lesson is left unchanged; validator continues to emit row-1 (or row-3) ERROR. This is correct: don't invent pins.
- **Identifier inside a fenced code block.** Both `--fix` and the validator skip these. Identifiers inside code are documentation, not authoring.
- **Lesson with `?at=` already present.** `--fix` leaves it alone, even if stale (> 1 edition gap). Stale-pin advancement is the diff job's role (Phase 5).
- **Slug-encoded edition.** `airboss-ref:ac/61-65/j` (no `?at=`). `--fix` leaves it alone; the slug satisfies §1.3's pinning rule. The validator's row 1 still passes because the corpus is enumerated and the locator is non-empty.
- **Snapshot generated when registry is empty.** Output is `{ "version": 1, "generatedAt": "...", "entries": {} }`. Valid snapshot; downstream tools just see no entries.
- **`promotion_batches` map de-promotion.** A single entry transitioning back to `pending` records a new batch with `state: 'de-promoted'` and a `previousBatchId` pointer. The original batch record is preserved.
- **Reverse-index walk on a lesson with malformed YAML.** `parseLesson` returns the parser-level finding; the reverse-index walk treats the lesson as having zero identifier occurrences for that file. The malformed YAML is the validator's problem to surface; the index doesn't double-report.

## Out of Scope (resolved, not deferred)

| Surfaced consideration | Resolution |
| --- | --- |
| Persisting lifecycle state to Postgres | Drop. Phase 2 keeps `promotion_batches` in-memory. Future WP if/when promotion runs need durability across processes. The shape is final; only the backend is provisional. |
| HTTP API for external tools | Drop. Per ADR 019 §2.7, external tools import `@ab/sources` directly. |
| Citation formatters (academic style, etc.) | Drop. Token vocabulary in Phase 4. The per-corpus `formatCitation` is the substrate. |
| Lesson-to-lesson reference graph | Drop from Phase 2. `findLessonsTransitivelyCitingEntry` ships but degrades to `findLessonsCitingEntry` until lesson-to-lesson refs are introduced (no ADR 019 phase has them yet). |
| Hangar UI | Drop. revisit.md R5; hangar revival ADR. |
| Annual diff job | Drop. Phase 5. |
| Renderer + token substitution | Drop. Phase 4. |
| Lesson migration tool (rewrites pre-ADR-019 lessons) | Drop. Phase 9. |

## Open Items

Ratified during this spec; not deferred:

- `productionRegistry` is the new default in `validateReferences`. `NULL_REGISTRY` is still exported for tests that need empty-registry semantics.
- `--fix` writes one file at a time, in reverse offset order within each file, then re-runs the validator on the rewritten files for sanity. If the second pass surfaces new ERRORs, `--fix` reports them and exits non-zero (a defensive gate; should be impossible in practice).
- The default no-op `CorpusResolver` for each enumerated corpus is registered eagerly at module import time; per-corpus phases call `registerCorpusResolver` to replace the default with their real resolver. No race; module init order is deterministic.
- The snapshot path is configurable via `--out=`. Default: `data/sources-snapshot.json`. The file is gitignored by adding `/data/sources-snapshot.json` to `.gitignore`.
- `LessonId` is the repo-relative path of the lesson file with the `.md` extension stripped (no leading slash).
