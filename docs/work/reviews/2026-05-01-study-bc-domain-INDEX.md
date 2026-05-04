---
feature: study-bc-domain
date: 2026-05-01
branch: main
reviewers_run: 9
total_issues: 102
critical: 2
major: 29
minor: 45
nit: 26
review_status: done
---

## Final close-out as of 2026-05-04

| Category     | Critical | Major C/O | Minor C/O | Nit C/O | Total C/O |
| ------------ | :------: | :-------: | :-------: | :-----: | :-------: |
| correctness  |    -     |    4/0    |    2/4    |   0/2   |    6/6    |
| security     |    -     |    0/2    |    1/4    |   1/2   |    2/8    |
| perf         |    -     |    5/0    |    3/3    |   0/3   |    8/6    |
| architecture |   1/0    |    -      |    2/1    |   0/1   |    3/2    |
| patterns     |    -     |    -      |    1/0    |    -    |    1/0    |
| testing      |    -     |    5/0    |    2/7    |   2/2   |    9/9    |
| dx           |    -     |    3/1    |    3/2    |   1/2   |    7/5    |
| schema       |    -     |    4/1    |    1/5    |   0/4   |    5/10   |
| backend      |   1/0    |    4/0    |    3/3    |   1/3   |    9/6    |
| **TOTAL**    | **2/0**  | **24/5**  | **18/29** | **5/19**| **50/52** |

(Format: `Closed/Open`. Both chunk-2 CRITICALs (architecture package boundaries + backend transaction-wrap) are now closed -- see per-category detail. The library-by-cert perf pair (GIN index + `arrayContains` + `LATERAL` unnest) closed in the wave-2 perf cluster. The chunk-2 BC error-class hygiene sweep also closed: dx MAJOR (`SourceRefRequiredError` dedupe), dx MINOR (`UpsertReturnedNoRowError` shared), dx MINOR (`CitationNotOwnedError` typed), dx NIT (`LensError` `[lensKind]` prefix, prior PR #468), backend MINOR (upsert typed errors), backend NIT (`CredentialPrereqUnresolvedNodesError` typed).)

### Total tally

- **Closed: 50 / 102 (49%)** -- includes 2 of 2 critical, 24 of 29 major, 18 of 45 minor (plus 1 minor counted as patterns), 5 of 26 nit.
- **Still open: 52 / 102 (51%)** -- 0 criticals, 5 majors, 29 minors, 19 nits.
- All open items have concrete triggers documented in the per-category audit sections.

### Convergent fixes that landed (root cause -> closed children)

| Convergent finding | Landed via | Children closed |
| ------------------ | ---------- | --------------- |
| `recordItemResult` rewrite (typed errors, no upsert, single tx, audit emit) | PR #437 | correctness MAJOR ×2, backend MAJOR, dx MAJOR (`SessionNotFoundError` mislabel) |
| `applyCertGoals` batched reads | PR #481 | perf MAJOR, backend (partial CRITICAL) |
| Library-by-cert SQL-side filter (GIN index + `arrayContains` + `LATERAL` unnest counts) | this PR | perf MAJOR ×2 |
| `applyCertGoalsToPrimaryGoal` transaction wrap | this PR | backend CRITICAL |
| `updateCard` card+snooze transaction wrap | this PR | correctness MAJOR, backend MAJOR |
| `renameSavedDeck` / `deleteSavedDeck` -> `onConflictDoUpdate` | this PR | backend MAJOR |
| Package-boundary hardening (`@ab/bc-hangar` dep + barrel imports, explicit `exports` on `@ab/db`/`@ab/auth`/`@ab/bc-sim`) | this PR | architecture CRITICAL, architecture MINOR ×2 |
| `getCredentialIdsCoveredBy` recursive CTE | PR #479 | perf MAJOR, backend MAJOR |
| Per-test isolation across mastery / knowledge.progress / credentials / engine-targeting | PR #546 | testing MAJOR ×4 |
| `sessions.test.ts` coverage expansion | PR #547 | testing MAJOR |
| ENGINE_SCORING-style weak-area constants | PR #468 | patterns MINOR |
| Schema indexes (chosen_option, card/goal updated_at, card_feedback created_at) | landed via #468 + earlier | schema MAJOR ×3 |
| `knowledge_edge_no_self_loop_check` | landed via #468 + earlier | schema MINOR |
| `library-by-cert` stderr -> `createLogger` | landed prior | dx MAJOR |
| `seeders/section-tree.ts` consistent error throwing | landed prior | dx MINOR |
| `MAX_SEARCH_LIMIT` clamping on citations search | landed prior | security MINOR |
| `restoreCardByCard` userId leak | landed prior | security NIT |
| `previewSession` plan dedupe | landed prior | perf MINOR |
| `getHandbookProgress` Promise.all | landed prior | perf MINOR |
| `fetchRecentSessionDomains` Promise.all | landed prior | perf MINOR |
| `createGoal` primary clear narrowed | landed prior | correctness MINOR |
| `submitAttemptSchema.chosenOptionId` cap raise | landed prior | correctness MINOR |
| `createPlan` SQLSTATE | landed prior | backend MAJOR |
| `getRepDashboard` docstring fix | landed prior | correctness MAJOR |
| Calibration / dashboard dead-seed NITs | landed prior | testing NIT ×2 |
| `escapeLikePattern` reuse from `@ab/db` | landed prior | backend MINOR |
| `snooze.ts` magic-string + raw SQL | landed prior | backend MINOR |
| BC error-class hygiene sweep (`SourceRefRequiredError` dedupe + shared `UpsertReturnedNoRowError` + typed `CitationNotOwnedError` + typed `CredentialPrereqUnresolvedNodesError`) | this PR | dx MAJOR + dx MINOR ×2 + backend MINOR + backend NIT |
| `LensError` `[lensKind]` prefix removed | landed prior (PR #468) | dx NIT |

### Audit-pass mechanical fixes (this PR)

- Deleted the no-op `error classes exist` describe block from `plans.test.ts` and dropped the unused `NoActivePlanError` import. Closes testing MINOR.

### Open work clusters (root-cause groupings of still-open items)

1. **Goals validation gap (security)** -- 1 major. Wire `createGoalInputSchema.parse` etc. at the BC boundary.
2. **Build-only barrel split (security)** -- 1 major. Split `@ab/bc-study` and `@ab/bc-study/build` (or add actor assertions).
3. **Knowledge-node updater audit column (schema)** -- 1 major tied to deferred `knowledge_node_version` work.
4. **Schema cleanup migration (schema)** -- 3 minors. `lifecycle` notNull tightening, `references_v2_migrated` drop, `cert_goals` deprecated drop.
5. **Test-polish sweep (testing)** -- 7 minors + 2 nits. `withFreshUser` propagation, scenarios reject regex pinning, smoke-test pinning.

The package-boundary hardening cluster, the transaction-wrap cluster, and the BC error-class hygiene sweep (formerly open) all closed in this PR-series; both chunk-2 CRITICALs are now closed and the cluster list is no longer required to track them.

### Per-category status

All nine per-category files have `review_status: done`. The user controls `status`. The INDEX now declares `review_status: done` -- the audit walk-through is complete; remaining open items are tracked with concrete triggers in the per-category bodies and grouped above.

# 10x Review -- Chunk 2: study-bc domain

9 reviewers, all complete.

## Summary table

| Category     | Critical | Major | Minor | Nit | Total | File |
|--------------|---------:|------:|------:|----:|------:|------|
| correctness  |        0 |     4 |     6 |   2 |    12 | [link](2026-05-01-study-bc-domain-correctness.md) |
| security     |        0 |     2 |     5 |   3 |    10 | [link](2026-05-01-study-bc-domain-security.md) |
| perf         |        0 |     5 |     6 |   3 |    14 | [link](2026-05-01-study-bc-domain-perf.md) |
| architecture |        1 |     0 |     3 |   1 |     5 | [link](2026-05-01-study-bc-domain-architecture.md) |
| patterns     |        0 |     0 |     1 |   0 |     1 | [link](2026-05-01-study-bc-domain-patterns.md) |
| testing      |        0 |     5 |     9 |   4 |    18 | [link](2026-05-01-study-bc-domain-testing.md) |
| dx           |        0 |     4 |     5 |   3 |    12 | [link](2026-05-01-study-bc-domain-dx.md) |
| schema       |        0 |     5 |     6 |   4 |    15 | [link](2026-05-01-study-bc-domain-schema.md) |
| backend      |        1 |     4 |     6 |   4 |    15 | [link](2026-05-01-study-bc-domain-backend.md) |
| **TOTAL**    |    **2** |**29** |**47** |**24**|**102**| |

## Critical findings (2)

- **architecture** -- `libs/bc/study/package.json` does not declare `@ab/bc-hangar` as a dependency, yet `libs/bc/study/src/citations/citations.ts:18` and `libs/bc/study/src/citations/search.ts:10` import `hangarReference` from `@ab/bc-hangar/schema`. Undeclared cross-BC dep that resolves only via workspace fallthrough; also a deep-subpath import bypassing the bc-hangar barrel.
- **backend** -- `applyCertGoalsToPrimaryGoal` (`libs/bc/study/src/goals.ts:527-579`) writes a targeting patch + N `addGoalSyllabus` calls outside any transaction. Mid-loop failure leaves a partially-built primary goal that `getDerivedCertGoals` can briefly read.

## Convergent / root-cause findings

### Missing transactions on multi-step writes
- **backend (critical)**: `applyCertGoalsToPrimaryGoal` -- targeting patch + N `addGoalSyllabus` not wrapped
- **correctness (major)**: `applyCertGoalsToPrimaryGoal` -- minor flag for same defect
- **correctness (major)**: `updateCard` mutates `card` then `cardSnooze` outside a transaction; partial failure drops bad-question re-entry banner
- **backend (major)**: `renameSavedDeck` / `deleteSavedDeck` (saved-decks.ts) read-then-write outside a transaction, racing on `(user_id, deck_hash)` unique. Should use `onConflictDoUpdate`.
- **Root cause**: a small set of multi-write paths missed the project's transaction-wrap pattern (which is correctly applied across `submitReview`, `undoReview`, `commitSession`, `replaceNodeEdges`, `setPrimaryGoal`, etc.).

### `recordItemResult` upsert/error-mode bug
- **correctness (major)**: `recordItemResult` upserts when slot is missing (contradicts docstring); `SessionSlotNotFoundError` throw is unreachable; caller-fabricated `slotIndex` produces ghost rows with wrong `presentedAt`
- **correctness (major)**: `skipSessionSlot` inherits the upsert bug inside its outer transaction (phantom slot + content suspension applied)
- **backend (major)**: `recordItemResult` (sessions.ts:874-881) throws `SessionNotFoundError` when bad input is foreign `reviewId`, conflating two failure modes
- **dx (major)**: `sessions.ts:880` throws `SessionNotFoundError` when a *review* row lookup failed -- 2am operator chases the wrong primary key
- **Root cause**: rewrite `recordItemResult` to (1) raise `SessionSlotNotFoundError` when the slot is missing instead of upserting, and (2) emit the correct error class for review-row vs session-row vs slot-row failures.

### N+1 fan-outs (resolves chunk-1 N+1 majors)
- **perf (major)**: `library-by-cert.ts:224-269` -- `listReferencesByTopic` + `getReferenceCountsByTopic` load every active reference and filter/sum in JS (function header even acknowledges Drizzle's `arrayContains`). Add GIN index on `subjects` and SQL-level filter.
- **perf (major)**: missing `getHandbookProgressBatch` -- chunk-1 lens index does N parallel calls each costing 2 round-trips
- **perf (major)**: missing batch variant of `getNodesCitingSection` -- multiple library/lens routes will fan out per-section
- **perf (major)**: `getCredentialIdsCoveredBy` (credentials.ts:139-167) BFS-with-await-in-loop; one round-trip per DAG level inside a `while` loop. Called by `getReferencesForCertWithCarryover` on every cert library page.
- **perf (major)**: `applyCertGoalsToPrimaryGoal` (goals.ts:559-577) serial per-cert reads in a `for` loop
- **backend (major)**: `getCredentialIdsCoveredBy` -- replace with one recursive CTE
- **Root cause**: BC layer needs four batch helpers (`getHandbookProgressBatch`, `getNodesCitingSectionBatch`, `getCredentialIdsCoveredBy` rewritten as recursive CTE, `applyCertGoalsToPrimaryGoal` rewritten with batched reads). These close all the chunk-1 route N+1s automatically.

### Unprotected build-only upserts in BC barrel
- **security (major)**: build-only upserts (`upsertKnowledgeNode`, `replaceNodeEdges`, `upsertCredential*`, `upsertSyllabus*`, `upsertReference*`) are exported from the BC barrel without admin/actor checks. Any future route importing `@ab/bc-study` could mutate shared data.
- **Root cause**: split the barrel into `@ab/bc-study` (read/user-write) and `@ab/bc-study/build` (admin/seeder upserts), or add actor assertions on the upsert path.

### Validation-schema bypass on goals
- **security (major)**: `goals.ts` write paths skip the Zod schemas defined in `credentials.validation.ts` that the BC contract requires. Cards/scenarios honor it; goals don't.

### Mislabeled errors
- **dx (major)**: `sessions.ts:880` throws `SessionNotFoundError` when review row lookup failed
- **dx (major)**: `citations.ts:313` throws `CitationNotFoundError` when ownership failed (BC layer lies about ground truth)
- **dx (major)**: two `SourceRefRequiredError` classes (cards.ts + scenarios.ts) are name-identical but different; only cards version barreled, so `instanceof` checks miss scenarios variant
- **backend (major)**: `createPlan` (plans.ts:178) detects unique-violation by regex on error message; should use SQLSTATE `'23505'` (citations.ts already does this)
- **Root cause**: error-class hygiene pass -- align thrown errors with the actual failure mode, dedupe identically-named classes, route through SQLSTATE not regex.

### Inconsistent logging
- **dx (major)**: only `dashboard.ts` + `engine-targeting.ts` use `createLogger`. `library-by-cert.ts:94` writes raw prose to `process.stderr` (no level, no logger name, unsearchable). `syllabi.ts:154-160` silently surfaces orphans at root with a comment claiming the opposite.
- **dx (major)**: seeder inconsistency -- `seeders/section-tree.ts:57-58` silently substitutes empty body for missing files while sibling `seeders/whole-doc.ts:34-38` throws.

### Test independence (shared mutable state)
- **testing (5x major)**: `mastery.test.ts`, `knowledge.progress.test.ts`, `credentials.test.ts`, `engine-targeting.test.ts` carry state across `it`/describe blocks. Comments confirm the coupling ("seedAttachedCards has already run from the prior test"). `sessions.test.ts` exercises only 1 of ~10 exports from `sessions.ts`.
- **Root cause**: propagate the `withFreshUser` pattern (used correctly by `calibration.test.ts` + `dashboard.test.ts`) across these suites.

### Schema indexing gaps
- **schema (major)**: missing FK index on `session_item_result.chosen_option_id`
- **schema (major)**: un-covered ORDER BYs on `card.updated_at`, `goal.updated_at`, and `card_feedback` LIMIT 1
- **schema (major)**: missing `updated_by` audit column on `knowledge_node`

## What's clean (preserve)

- **patterns**: cleanest review of the chunk -- 0 critical, 0 major, 1 minor, 0 nit. ENGINE_SCORING discipline tight (zero inline scoring literals in engine.ts/engine-targeting.ts), no `any`, no `!`, no `@ts-*` suppressions, no raw `nanoid()`/`ulid()`, all `@ab/*` aliases, Drizzle exclusively (only the typed `sql` template tag where needed).
- **schema**: composite FKs lock denormalized `user_id` to parent (`card_state_card_owner_fk`, `session_item_result_session_owner_fk`) backed by storage-layer tests; partial UNIQUE indexes used correctly in 4+ places; CHECK constraints route through `@ab/constants`; ON DELETE behaviors deliberate per-column with rationale comments; GIN indexes on jsonb where reverse-containment exists.
- **architecture**: no app imports, no Svelte/SvelteKit imports, no raw SQL outside Drizzle index/check constructs, `runEngine` is pure (`@ab/constants` + local types only), `studySchema` correctly reused by `citations/schema.ts`, seeders not exported from BC barrel.
- **security**: consistent `userId` scoping, Drizzle exclusively, Zod at the boundary on cards/scenarios, no secrets in schema, hot transactional paths correctly wrapped with FOR UPDATE locks where serialization matters.
- **dx**: 40+ named typed errors carrying entity ids, deck-spec preserves `cause`, `mapToPanelError` in dashboard.ts is the gold-standard pattern (logs raw cause server-side via createLogger, returns user-safe phrase, maps known domain errors).
- **correctness**: FSRS row lock for review submit dedupe, plan-archive transactional pattern, dual-gate mastery, evidence-kind-gating, lens rollups, calibration math, credential DAG cycle detection -- all correct.
- **testing**: no `vi.mock`, no `it.skip`/`it.todo`, no commented-out tests; assertions in pure-function suites (`srs`, `engine`, `deck-spec`, `sim-bias`, `cards-public`, all `*.validation`) are tight.

## Recommended fix order

1. **Critical first**: declare `@ab/bc-hangar` dep on bc-study + replace deep-subpath import with barrel; wrap `applyCertGoalsToPrimaryGoal` in a transaction.
2. **Convergent root-causes** (one fix closes many findings):
   - Rewrite `recordItemResult` (closes 4 findings across correctness/backend/dx)
   - Add the four batch BC helpers (closes chunk-1's 5+ N+1 majors AND chunk-2 perf majors)
   - Split BC barrel for build-only upserts
   - Fix mislabeled errors and dedupe `SourceRefRequiredError`
   - Propagate `withFreshUser` across the 4 stateful test suites
   - Add the missing schema indexes
3. **Targeted majors**: `updateCard` transaction, `renameSavedDeck`/`deleteSavedDeck` race fix via `onConflictDoUpdate`, `createPlan` SQLSTATE check, `goals.ts` Zod schema enforcement.
4. **Logging consistency**: route everything through `createLogger`; remove `process.stderr` writes; reconcile seeder error behavior.
5. **Schema gaps + audit columns**: missing indexes and `updated_by` on `knowledge_node`.

## Severity guide

- **critical**: data corruption, undeclared cross-BC dep that breaks builds, transaction-missing path that leaves visible partial state
- **major**: plausible-edge-case bug, missing transaction, N+1 won't-scale, mislabeled error, build-only path exported without auth
- **minor**: defensive gap, suboptimal, naming/comments, missing test
- **nit**: polish, style preference
