---
title: 'Tasks: Reference source registry core'
product: cross-cutting
feature: reference-source-registry-core
type: tasks
status: unread
review_status: pending
---

# Tasks: Reference source registry core

## Pre-flight

- [ ] Read [ADR 019](../../decisions/019-reference-identifier-system/decision.md) end-to-end. Pay special attention to §1.3 (`--fix`), §2 (registry), §2.1 (`SourceEntry`), §2.2 (`CorpusResolver`), §2.3 (query API), §2.4 (lifecycle), §2.5 (render-time loading + JSON snapshot), §2.6 (registry population), §2.7 (availability/consistency), §6 (aliases / supersession / acks).
- [ ] Read [revisit.md](../../decisions/019-reference-identifier-system/revisit.md) for the deferred items so they don't get re-litigated here.
- [ ] Read [Phase 1's WP](../reference-identifier-scheme-validator/) end-to-end. Especially `design.md` for the seam between validator and `RegistryReader`.
- [ ] Read this WP's [spec.md](spec.md) and [design.md](design.md).
- [ ] Skim `libs/sources/src/{types,parser,validator,lesson-parser,check,registry-stub}.ts` -- the Phase 1 surface this WP extends.
- [ ] Read `libs/sources/src/check.test.ts` to understand the test directory conventions and fixture style.
- [ ] Read `scripts/check.ts` and `scripts/airboss-ref.ts` for the dispatch pattern.

## Phase 1 - Types + new files in libs/sources/src/

- [ ] Extend `libs/sources/src/types.ts` with the Phase 2 types:
  - `EditionId = string` (alias)
  - `LessonId = string` (alias; repo-relative path with `.md` stripped)
  - `IndexedContent` interface (placeholder shape per ADR 019 §2.5; can be empty for now -- the field is "indexed-tier content used by the renderer")
  - `ParsedLocator` and `LocatorError` (used by `CorpusResolver.parseLocator`)
- [ ] No file renames; no Phase 1 imports break.
- [ ] `bun run check` passes.
- [ ] Commit: `feat(sources): phase-2 types -- EditionId, LessonId, ParsedLocator, IndexedContent`.

## Phase 2 - Constants table + edition map

- [ ] Create `libs/sources/src/registry/sources.ts`:
  - `export const SOURCES: Readonly<Record<SourceId, SourceEntry>> = Object.freeze({})`
  - JSDoc explains the populate-via-ingestion pattern.
- [ ] Create `libs/sources/src/registry/editions.ts`:
  - `export const EDITIONS: ReadonlyMap<SourceId, readonly Edition[]> = new Map()`
- [ ] `bun run check` passes.
- [ ] Commit: `feat(sources): phase-2 constants -- SOURCES + EDITIONS empty tables`.

## Phase 3 - CorpusResolver registration

- [ ] Create `libs/sources/src/registry/corpus-resolver.ts`:
  - `export interface CorpusResolver` per ADR 019 §2.2.
  - `export const ENUMERATED_CORPORA: readonly string[]` -- the 14 corpora from §1.2 (`regs`, `aim`, `ac`, `interp`, `orders`, `handbooks`, `pohs`, `statutes`, `sectionals`, `plates`, `ntsb`, `acs`, `forms`, `tcds`, `asrs`).
  - `function makeDefaultResolver(corpus: string): CorpusResolver` -- the no-op resolver factory.
  - Module-scoped `const RESOLVERS = new Map<string, CorpusResolver>()`. At init, register `makeDefaultResolver(corpus)` for each corpus in `ENUMERATED_CORPORA`.
  - `export function registerCorpusResolver(resolver: CorpusResolver): void` -- replaces the default for that corpus. Idempotent; no-op if already replaced with same resolver.
  - `export function getCorpusResolver(corpus: string): CorpusResolver | null`.
  - `export function isEnumeratedCorpus(corpus: string): boolean` -- looks up `RESOLVERS.has(corpus)`.
- [ ] Create `libs/sources/src/registry/corpus-resolver.test.ts`:
  - Every enumerated corpus has a default resolver at module load.
  - `registerCorpusResolver` replaces the default; subsequent `getCorpusResolver` returns the new one.
  - `isEnumeratedCorpus` returns `true` for each of `ENUMERATED_CORPORA` and `false` for `not-a-corpus`.
  - The default resolver's methods return null/empty as documented.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-2 corpus-resolver registration map + defaults`.

## Phase 4 - Lifecycle state machine + promotion_batches

- [ ] Create `libs/sources/src/registry/lifecycle.ts`:
  - `export interface PromotionBatch` per spec.
  - Module-scoped `const BATCHES = new Map<string, PromotionBatch>()` and `const ENTRY_LIFECYCLES = new Map<SourceId, SourceLifecycle>()` (overlay map; default lifecycle comes from `SOURCES[id].lifecycle`).
  - `export function getEntryLifecycle(id: SourceId): SourceLifecycle | null` -- returns the overlay if present, else `SOURCES[id]?.lifecycle ?? null`.
  - `export interface PromotionInput { corpus, reviewerId, scope, inputSource, targetLifecycle }`.
  - `export function recordPromotion(input: PromotionInput): { ok: true; batch: PromotionBatch } | { ok: false; error: string }`. Validates each entry's current lifecycle allows the target transition; returns `{ ok: false }` without mutating if any entry fails. Otherwise mutates `ENTRY_LIFECYCLES` for every entry, appends to `BATCHES`, returns the batch.
  - `export function recordDePromotion(input: DePromotionInput): { ok: true; batch: PromotionBatch } | { ok: false; error: string }`. Runs the inverse for entries currently `accepted` going back to `pending` or `retired`. Records `previousBatchId` and `state: 'de-promoted'`.
  - `export function getBatch(id: string): PromotionBatch | null`.
  - `export function listBatches(): readonly PromotionBatch[]`.
  - `export function getValidTransitions(from: SourceLifecycle): readonly SourceLifecycle[]` -- pure helper used by `recordPromotion`.
  - Use `createId('batch')` from `@ab/utils` for batch IDs.
- [ ] Create `libs/sources/src/registry/lifecycle.test.ts`:
  - `getValidTransitions` returns the right targets per ADR 019 §2.4.
  - `recordPromotion` succeeds for a valid batch (`pending -> accepted`).
  - `recordPromotion` fails atomically when one entry's current lifecycle blocks the transition; no partial mutation.
  - `recordDePromotion` walks `accepted -> pending` and records `previousBatchId`.
  - `getBatch` and `listBatches` return the recorded data.
  - The "draft" state is allowed only as a starting state; transitioning back to `draft` from any other state returns `ok: false`.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-2 lifecycle state machine + promotion_batches`.

## Phase 5 - Query API

- [ ] Create `libs/sources/src/registry/query.ts` with the 12 functions per ADR 019 §2.3:
  - `resolveIdentifier(id)` -- strips `?at=` from the input, looks up `SOURCES[id]`. Returns null if not found.
  - `hasEntry(id)` -- the boolean form.
  - `getChildren(id)` -- walks `SOURCES` keys, returns entries whose stripped path starts with `id` + `/` (one level deeper -- not the entry itself, not grandchildren).
  - `walkSupersessionChain(id)` -- recursive walk via `superseded_by` pointer; cycle-detection via visited set.
  - `isSupersessionChainBroken(id)` -- returns `true` if any walk step's target isn't in `SOURCES`.
  - `findEntriesByCanonicalShort(short)` -- linear scan over `SOURCES` (small; not worth indexing in v1).
  - `findLessonsCitingEntry(id)` -- consults the reverse index (Phase 6 below) and returns matches for stripped-pin equality.
  - `findLessonsTransitivelyCitingEntry(id)` -- shipped as a degenerate alias of `findLessonsCitingEntry` until lesson-to-lesson refs land. Documented in JSDoc.
  - `findLessonsCitingMultiple(ids)` -- intersection of `findLessonsCitingEntry` per id.
  - `getCurrentEdition(corpus)` -- looks up `getCorpusResolver(corpus)?.getCurrentEdition() ?? null`.
  - `getEditions(id)` -- async; calls the resolver's `getEditions(id)`.
  - `isPinStale(id, pin)` -- returns `true` if the resolver's current edition exists, the pin is older, and the distance > 1 (handed to the registry's resolver via a helper).
- [ ] Create `libs/sources/src/registry/query.test.ts`:
  - Each of the 12 functions covered with at least one positive + one negative case.
  - `walkSupersessionChain` handles a 3-deep chain.
  - `walkSupersessionChain` cycle protection (defensive: detect a cycle, return the partial walk without infinite-looping).
  - `getChildren` returns one-level-deep children only (not grandchildren).
  - `findLessonsCitingMultiple` returns the set intersection.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-2 query API per ADR 019 §2.3`.

## Phase 6 - Reverse-index walk for findLessonsCiting*

- [ ] Add to `libs/sources/src/registry/query.ts` (or a sibling `reverse-index.ts`):
  - Lazy `cachedReverseIndex` per process.
  - `buildReverseIndex()` walks `LESSON_CONTENT_PATHS`, parses every lesson, builds `Map<SourceIdWithoutPin, LessonId[]>`.
  - `stripPin(raw: string): string` -- removes `?at=...` portion from a SourceId-shaped string.
  - `lessonId(file: string): LessonId` -- normalises file path to repo-relative + strips `.md`.
  - `clearReverseIndex()` -- exported test helper.
- [ ] Tests in `query.test.ts`:
  - Build index, query, find expected lessons.
  - Strip pin: `airboss-ref:regs/cfr-14/91/103?at=2026` -> `airboss-ref:regs/cfr-14/91/103`.
  - LessonId: `course/regulations/foo/bar.md` -> `course/regulations/foo/bar`.
  - Index handles malformed-YAML lessons (treats as zero occurrences).
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-2 reverse-index walk for findLessonsCiting`.

## Phase 7 - Production registry assembly

- [ ] Create `libs/sources/src/registry/index.ts`:
  - Imports from `./sources`, `./editions`, `./corpus-resolver`, `./lifecycle`, `./query`, `../types`.
  - Exports `productionRegistry: RegistryReader` (the 9 methods Phase 1 expects):
    - `hasEntry(id)` -> `query.hasEntry(stripPin(id))`
    - `getEntry(id)` -> `query.resolveIdentifier(id)`
    - `hasEdition(id, edition)` -> looks up `EDITIONS.get(stripPin(id))?.some(e => e.id === edition) ?? false`
    - `getEditionLifecycle(id, edition)` -> per-entry edition lifecycle is per-entry per ADR 019; the registry tracks one `lifecycle` field on the entry. For Phase 2 we return the entry's lifecycle when the edition exists; null otherwise. (The full per-edition lifecycle is a Phase 5+ enhancement.)
    - `getCurrentAcceptedEdition(corpus)` -> `query.getCurrentEdition(corpus)` (Phase 2 default resolvers all return null; Phase 3+ resolvers fill in).
    - `getEditionDistance(id, pin)` -> linear scan through `EDITIONS.get(stripPin(id))`. Returns the index difference between the current edition and `pin`; null if either isn't in the list.
    - `walkAliases(id, fromEdition, toEdition)` -> walks `EDITIONS.get(stripPin(id))`, collects `aliases` from editions in the range. (Phase 2 has no edition data; returns `[]`.)
    - `walkSupersessionChain(id)` -> `query.walkSupersessionChain(id)`.
    - `isCorpusKnown(corpus)` -> `corpus-resolver.isEnumeratedCorpus(corpus)`.
  - Re-exports the namespace: `export * as query from './query.ts'`, etc.
- [ ] Update `libs/sources/src/index.ts` to export `productionRegistry` and the registry namespace.
- [ ] Tests in `libs/sources/src/registry/registry.test.ts`:
  - `productionRegistry.isCorpusKnown('regs')` -> true.
  - `productionRegistry.isCorpusKnown('not-a-corpus')` -> false.
  - With test entries primed: `productionRegistry.hasEntry(...)` -> true.
  - `productionRegistry.getEntry` strips pin from input.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-2 production registry assembly`.

## Phase 8 - Validator row 1 activation + scripts/check.ts swap

- [ ] Edit `libs/sources/src/validator.ts`:
  - Activate the row-1 `isCorpusKnown` check (replacing the comment-out block).
  - Update the row-2 entry-not-found check to skip when row 1 already fired.
- [ ] Edit `libs/sources/src/check.ts`:
  - Default `registry` in `ValidateOptions` switches from `NULL_REGISTRY` to `productionRegistry`.
  - `NULL_REGISTRY` import remains so test fixtures can pass it explicitly.
- [ ] Update `libs/sources/src/validator.test.ts`:
  - Cases that wrote a non-enumerated corpus and expected row-2 ERROR now expect row-1 ERROR.
  - Add new cases for the row-1 corpus-not-enumerated path.
- [ ] Update `libs/sources/src/check.test.ts`:
  - The C-04 case (`course/regulations` walk) now uses the production registry by default; behavior unchanged because there are no airboss-ref: URLs in the regs lessons today.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): activate validator row 1 + swap to productionRegistry default`.

## Phase 9 - --fix mode

- [ ] Create `libs/sources/src/fix.ts`:
  - `runFixCli(opts?: ValidateOptions): number` -- the CLI entry. Refuses to run when `process.env.CI === 'true'`.
  - `applyFixes(opts?: FixOptions): FixReport` -- the underlying API. Walks `LESSON_CONTENT_PATHS`, parses each lesson, computes edits, writes files, re-runs validator for sanity.
  - `interface FixReport { filesModified: number; identifiersStamped: number; remainingErrors: ValidationFinding[] }`.
  - Uses `parseLesson` for occurrence detection (same skip-range logic).
  - Edits applied in reverse offset order per file.
- [ ] Create `libs/sources/src/fix.test.ts`:
  - Lesson with one unpinned identifier; corpus has accepted edition; fix stamps `?at=<edition>`.
  - Lesson with already-pinned identifier; fix no-op.
  - Lesson with slug-encoded edition (`airboss-ref:ac/61-65/j`); fix no-op.
  - Lesson with unknown corpus; fix no-op.
  - Lesson with malformed identifier; fix no-op.
  - Lesson with identifier inside fenced code block; fix no-op (skip range honored).
  - Multiple unpinned identifiers in one file; all stamped; offsets stay aligned.
  - `process.env.CI === 'true'` branch returns exit code 2 without writing.
  - Idempotence: running fix twice on the same file produces the same output as one run.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-2 --fix mode (auto-stamp current accepted edition)`.

## Phase 10 - JSON snapshot generator

- [ ] Create `libs/sources/src/snapshot.ts`:
  - `interface SnapshotShape` per spec.
  - `generateSnapshot(): SnapshotShape` -- walks `SOURCES`, looks up `EDITIONS.get(id)`, calls `getCurrentEdition(entry.corpus)`, assembles record.
  - `writeSnapshotSync(path: string): void` -- writes `JSON.stringify(snapshot, null, 2)` plus trailing newline.
  - `runSnapshotCli(args: readonly string[]): number` -- parses `--out=<path>` arg; defaults to `data/sources-snapshot.json`. Returns 0 on success.
- [ ] Create `libs/sources/src/snapshot.test.ts`:
  - Empty registry -> `{ version: 1, generatedAt: <iso>, entries: {} }`.
  - With test entries primed: snapshot includes them.
  - `writeSnapshotSync` writes the file at the given path; readback round-trips.
  - `runSnapshotCli` parses `--out=` correctly; defaults when omitted.
- [ ] Add `/data/` to root `.gitignore` (or `/data/sources-snapshot.json` if `data/` is shared with other artifacts -- check first).
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-2 JSON snapshot generator`.

## Phase 11 - scripts/airboss-ref.ts subcommand parser

- [ ] Edit `scripts/airboss-ref.ts`:
  - Parse argv. Accepted forms:
    - `bun scripts/airboss-ref.ts` -> `runCli()` (validate, default).
    - `bun scripts/airboss-ref.ts --fix` -> `runFixCli()`.
    - `bun scripts/airboss-ref.ts snapshot [--out=path]` -> `runSnapshotCli(args)`.
    - `bun scripts/airboss-ref.ts --help` -> print usage; exit 0.
  - Invalid args print usage to stderr and exit 2.
- [ ] `bun scripts/airboss-ref.ts` smoke test exits 0 on the current `course/regulations/`.
- [ ] `bun scripts/airboss-ref.ts --help` prints usage.
- [ ] Commit: `feat(sources): airboss-ref subcommand parser (--fix, snapshot)`.

## Phase 12 - Verification + smoke

- [ ] `bun run check` exits 0.
- [ ] `bun test libs/sources/` -- all tests pass.
- [ ] svelte-check unaffected (1777 files).
- [ ] Smoke test 1 (validator behavior unchanged): `course/regulations/**` walk produces 0 identifiers, 0 findings.
- [ ] Smoke test 2 (--fix is no-op when no unpinned URLs): `bun scripts/airboss-ref.ts --fix` -> exit 0, "0 files modified".
- [ ] Smoke test 3 (--fix stamps): insert `[@cite](airboss-ref:regs/cfr-14/91/103)` (unpinned) into a temp lesson under `course/regulations/`. Run `bun scripts/airboss-ref.ts --fix`. Expect: file rewritten with `?at=<edition>` IF a real CFR resolver were registered. With Phase 2's default no-op resolver, `getCurrentAcceptedEdition('regs')` returns null; `--fix` leaves the URL unchanged. Validator still emits row-3 (or row-1 if pin missing) ERROR. Revert the test edit.
- [ ] Smoke test 4 (unknown corpus): insert `[@cite](airboss-ref:not-a-corpus/foo?at=2026)`. Run `bun run check`. Expect row-1 ERROR ("corpus 'not-a-corpus' is not enumerated"). Revert.
- [ ] Smoke test 5 (snapshot): `bun scripts/airboss-ref.ts snapshot --out=/tmp/snap.json`. Read back; expect `entries: {}`.
- [ ] Smoke test 6 (CI guard): `CI=true bun scripts/airboss-ref.ts --fix`. Expect exit code 2 and stderr message.
- [ ] Commit any documentation tweaks discovered along the way.

## Phase 13 - Update rollout tracker + ship PR

- [ ] Update `docs/work/plans/adr-019-rollout.md`:
  - Phase 2 row: WP link, PR link, status `✅`.
  - Update log: "Phase 2 -- registry core + --fix shipped (PR #XXX)."
- [ ] Stage files individually by name (no `git add -A`).
- [ ] Commit message: `feat(sources): ADR 019 phase 2 -- registry core + --fix mode`.
- [ ] Push branch.
- [ ] Open PR via `gh pr create` with title `feat(sources): ADR 019 phase 2 -- registry core + --fix mode`.
- [ ] PR body: link ADR 019, link Phase 1 PR (#241), link this WP, summary of phases shipped, manual test plan reference.
- [ ] Write PR URL to `.ball-coord/to-dispatcher.md`.
