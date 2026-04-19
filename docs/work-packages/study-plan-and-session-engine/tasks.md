---
title: 'Tasks: Study Plan + Session Engine'
product: study
feature: study-plan-and-session-engine
type: tasks
status: unread
review_status: pending
---

# Tasks: Study Plan + Session Engine

Depends on: Spaced Memory Items (schema + BC), Decision Reps (schema + BC), Knowledge Graph (consumed via injected reads -- engine ships with stubs for node-based pools until graph BC exists).

> **Depends on knowledge-graph spec.** Tasks below that integrate with graph reads are flagged with a `[graph]` marker. These can be deferred; the engine ships with injection points and test stubs so the rest of the feature can land independently. Reconciliation task at the end of the plan lifts the stubs once the graph BC is available.

## Pre-flight

- [ ] Read `libs/bc/study/src/schema.ts` -- understand existing `card`, `review`, `card_state`, `scenario`, `rep_attempt` tables.
- [ ] Read `libs/bc/study/src/index.ts` -- understand existing exports. Plan new additions.
- [ ] Read `libs/constants/src/study.ts` -- understand existing constants and the value-array pattern.
- [ ] Read `libs/constants/src/routes.ts` -- understand the `ROUTES` pattern. New routes must go here.
- [ ] Read `docs/work-packages/spaced-memory-items/spec.md`, `decision-reps/spec.md` -- understand the two feature layers this builds on.
- [ ] Read `docs/work-packages/knowledge-graph/PRD.md` -- understand what graph reads this feature will need to consume once the graph spec signs off.
- [ ] Confirm DB is running: OrbStack postgres on port 5435.

## Implementation

### 1. Constants

- [ ] Add `CERTS` + labels + values array to `libs/constants/src/study.ts`.
- [ ] Add `PLAN_STATUSES` + values array.
- [ ] Add `SESSION_MODES` + labels + values array.
- [ ] Add `SESSION_SLICES` + values array.
- [ ] Add `SESSION_ITEM_KINDS` + values array.
- [ ] Add `SESSION_SKIP_KINDS` + values array.
- [ ] Add `DEPTH_PREFERENCES` + values array.
- [ ] Add `SESSION_REASON_CODES` + values array.
- [ ] Add `MODE_WEIGHTS` map (SessionMode -> Record<SessionSlice, number>).
- [ ] Add `DEFAULT_SESSION_LENGTH`, `MIN_SESSION_LENGTH`, `MAX_SESSION_LENGTH`, `RESUME_WINDOW_MS`. (No mastery threshold here -- `isNodeMastered` lives in the knowledge-graph BC; study-plan is a consumer.)
- [ ] Export all new constants from `libs/constants/src/index.ts`.
- [ ] Assert in a unit (or inline `as const` check) that `Object.values(MODE_WEIGHTS[mode])` sums to 1.0 for every mode.
- [ ] Run `bun run check` -- 0 errors.

### 2. Route constants

- [ ] Add `PLANS`, `PLANS_NEW`, `PLAN`, `SESSION_START`, `SESSIONS`, `SESSION` to `libs/constants/src/routes.ts`.
- [ ] Run `bun run check` -- 0 errors, commit.

### 3. ID prefixes

- [ ] Add `plan_`, `ses_`, `sir_` prefix helpers to `libs/utils/src/ids.ts` (or equivalent) that wrap `createId()`. Match the pattern used by `generateCardId`, `generateReviewId`.
- [ ] Export from `libs/utils/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 4. Drizzle schema -- study_plan

- [ ] Append `studyPlan` table to `libs/bc/study/src/schema.ts` per design.md.
- [ ] Include CHECKs for `status`, `depth_preference`, `default_mode`, `session_length BETWEEN 3 AND 50`.
- [ ] Export row types (`StudyPlanRow`, `NewStudyPlanRow`).
- [ ] Run `bun run check` -- 0 errors.

### 5. Drizzle schema -- session + session_item_result

- [ ] Append `session` and `sessionItemResult` tables per design.md.
- [ ] Include FKs to `studyPlan`, `card`, `scenario`, `review`, `repAttempt` with sensible on-delete semantics (restrict for plan, set null for review/attempt so the trail survives hard-deletes; cascade from session -> result).
- [ ] Include CHECKs for enum columns.
- [ ] Export row types (`SessionRow`, `NewSessionRow`, `SessionItemResultRow`, `NewSessionItemResultRow`).
- [ ] Run `bun run check` -- 0 errors.

### 6. Migration + partial UNIQUE index

- [ ] `bunx drizzle-kit push` to create the new tables.
- [ ] Hand-write a SQL statement (commit as `scripts/db/001-plan-active-unique.sql` or append to the migration pipeline per repo convention) to add the partial UNIQUE index: `CREATE UNIQUE INDEX IF NOT EXISTS plan_user_active_uniq ON study.study_plan (user_id) WHERE status = 'active';`.
- [ ] Verify tables + index exist in DB (`\d study.study_plan`, `\di study.*`).
- [ ] Run `bun run check` -- 0 errors, commit.

### 7. Validation schemas

- [ ] Create `libs/bc/study/src/plans.validation.ts` -- Zod schemas for `createPlan`, `updatePlan`, `addSkipNode`, `addSkipDomain`. Enforce rules from spec Validation section (cert_goals 1-4, focus/skip disjoint, session_length 3-50, mode/depth/status enums).
- [ ] Create `libs/bc/study/src/sessions.validation.ts` -- Zod schemas for `previewSession` opts, `commitSession` input, `recordItemResult` input.
- [ ] Unit tests for validation schemas (`plans.validation.test.ts`, `sessions.validation.test.ts`).
- [ ] Run `bun test` -- all pass.
- [ ] Run `bun run check` -- 0 errors, commit.

### 8. Plan BC functions

- [ ] Create `libs/bc/study/src/plans.ts`:
  - `createPlan(db, data)` -- transactional: if `status='active'` and the user already has an active plan, archive the old one first.
  - `updatePlan(db, planId, userId, data)`.
  - `getActivePlan(db, userId)` -- single row or NULL.
  - `getPlan(db, planId, userId)`.
  - `archivePlan(db, planId, userId)`.
  - `activatePlan(db, planId, userId)` -- transactional with archive-others.
  - `addSkipNode(db, planId, userId, nodeId)`.
  - `addSkipDomain(db, planId, userId, domain)`.
- [ ] Error classes: `PlanNotFoundError`, `PlanNotActiveError`, `DuplicateActivePlanError` (shouldn't trigger if the partial UNIQUE is in place, but defensive).
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 9. Plan BC tests

- [ ] Create `libs/bc/study/src/plans.test.ts`:
  - Create plan with `status='active'`; second create archives the first.
  - Update plan in place.
  - `addSkipNode` / `addSkipDomain` mutates the array idempotently (no duplicates).
  - Archive via `archivePlan`; `getActivePlan` returns NULL.
  - Validation rejections for out-of-range fields.
- [ ] Run `bun test` -- all pass, commit.

### 10. Candidate-query helpers

- [ ] Extend `libs/bc/study/src/cards.ts` with `getCandidateCards(db, userId, filters)` returning `{ cardId, domain, state, dueAt, lastRating, stability }[]` filtered by domains, skip_domains, due windows, and status='active'.
- [ ] Extend `libs/bc/study/src/scenarios.ts` (from decision-reps) with `getCandidateReps(db, userId, filters)` returning `{ scenarioId, domain, difficulty, accuracyLast5, lastAttemptedAt }[]`.
- [ ] Add `getRecentSessionDomains(db, userId, sessionLookback=2)` to `libs/bc/study/src/sessions.ts` (scaffolded next).
- [ ] Unit tests for each helper with fixture data.
- [ ] Run `bun run check` -- 0 errors, commit.

### 11. Engine -- pure function

- [ ] Create `libs/bc/study/src/engine.ts`:
  - `modeWeights(mode)` -- returns `Record<SessionSlice, number>` from `MODE_WEIGHTS`.
  - `allocateSlots(weights, length)` -- largest-remainder rounding. Tiebreaker: strengthen > continue > expand > diversify.
  - `scoreContinue`, `scoreStrengthen`, `scoreExpand`, `scoreDiversify` -- pure functions per spec rules.
  - `runEngine(inputs)` -- the top-level pure function. Takes `EngineInputs` bundling plan, filters, mode, seed, session_length, and five pool-query callbacks (`cards`, `reps`, `recentDomains`, `nodes`, `masteryTrend`). Returns `SessionItem[]`.
  - Interleave + seeded-random tiebreaker using a deterministic PRNG (e.g., `mulberry32` over the seed).
- [ ] No DB access in this file. Imports: constants + types only.
- [ ] Run `bun run check` -- 0 errors.

### 12. Engine -- unit tests

- [ ] Create `libs/bc/study/src/engine.test.ts`:
  - `allocateSlots` sums to length for every (mode x length in 3..20).
  - `allocateSlots` matches a manual expected table for `mixed` at 10, 7, 5, 3.
  - `mixed` mode with all pools full yields 3/3/2/2 for length 10.
  - `strengthen` mode emphasizes strengthen at 0.70.
  - Empty Expand pool in `mixed` mode redistributes to strengthen/continue/diversify proportionally; total still 10.
  - Empty all pools returns `{ items: [], short: true }`.
  - Same seed -> same output; different seed -> different ordering for identical pools.
  - Duplicates across slices are removed (an item can be in Continue AND Strengthen pools; engine picks for one slice only).
  - Interleave: output order is round-robin across slices, not grouped.
  - Skip filters: items whose domain is in skip_filter never appear.
  - Cert filter: items whose cert relevance is outside cert_filter never appear in Expand.
- [ ] Run `bun test` -- all pass, commit.

### 13. Session BC functions

- [ ] Create `libs/bc/study/src/sessions.ts`:
  - `previewSession(db, userId, opts)` -- loads active plan, builds pool-query callbacks, calls `runEngine`, returns `SessionPreview`.
  - `commitSession(db, userId, preview)` -- validates no active in-progress session (`completed_at IS NULL AND started_at > now() - RESUME_WINDOW_MS` for same plan), INSERTs `study.session`. Returns the new session.
  - `recordItemResult(db, sessionId, slotIndex, result)` -- INSERT or UPSERT `session_item_result`.
  - `skipItem(db, sessionId, slotIndex, userId, kind)` -- record `skip_kind`; if kind is `topic` or `permanent`, call `addSkipNode` / `addSkipDomain` / `setCardStatus('suspended')` / scenario status update as appropriate.
  - `completeSession(db, sessionId, userId)` -- set `completed_at`, return summary.
  - `getSessionSummary(db, sessionId, userId)` -- aggregate attempted/skipped/correct/avg confidence/domains/nodes, add streak, compute suggestedNext.
  - `getSession(db, sessionId, userId)` -- single row.
  - `getSessionHistory(db, userId, limit)` -- paginated list.
  - `getRecentSessionDomains(db, userId, lookback)`.
  - `getStreakDays(db, userId, tz)` -- aggregate over `session_item_result.completed_at` windowed by tz.
- [ ] Error classes: `SessionNotFoundError`, `SessionInProgressError`, `SessionAlreadyCompleteError`.
- [ ] Export from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 14. Session BC tests

- [ ] Create `libs/bc/study/src/sessions.test.ts`:
  - `commitSession` rejects a second commit within `RESUME_WINDOW_MS`.
  - `skipItem` with kind='topic' mutates plan.skip_domains (card/rep path without node_id).
  - `skipItem` with kind='permanent' sets card/scenario status='suspended' when there's no node_id.
  - `completeSession` sets completed_at and freezes summary.
  - `getStreakDays` with known fixtures (attempts across 3 consecutive local days) returns 3.
  - `getStreakDays` across a tz boundary -- reviews at 2355 local count as "today" not "tomorrow".
- [ ] Run `bun test` -- all pass, commit.

### 15. Pool-query integration

- [ ] In `sessions.ts`, wire `previewSession` to real query callbacks:
  - Cards -> `getCandidateCards`.
  - Reps -> `getCandidateReps`.
  - Recent domains -> `getRecentSessionDomains`.
  - `[graph]` Nodes -> stub returning empty array (to be replaced once graph BC exists).
  - `[graph]` Mastery trend -> stub returning `{ score: null, delta: 0 }` (Expand and Strengthen-by-node paths degrade correctly).
- [ ] Unit test `previewSession` end-to-end against a fixture DB: mixed mode, session_length 10, with cards-only (no reps, no nodes) -- expect items to be a mix of continue/strengthen/diversify, Expand redistributed.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass, commit.

### 16. Plans -- UI: list + first-run wizard

- [ ] Create `apps/study/src/routes/(app)/plans/+page.server.ts` -- load active plan + archived list.
- [ ] Create `apps/study/src/routes/(app)/plans/+page.svelte` -- list view. If no active plan, show empty state linking to `/plans/new`.
- [ ] Create `apps/study/src/routes/(app)/plans/new/+page.server.ts` -- no load (constants for the form); form action `default` that validates + calls `createPlan`.
- [ ] Create `apps/study/src/routes/(app)/plans/new/+page.svelte` -- wizard form: cert goals checkboxes, session length radio (5/10/20), focus domains multi-select, skip domains multi-select. Submit -> redirect to `/plans/:id`.
- [ ] Run `bun run check` -- 0 errors.

### 17. Plans -- UI: detail + edit

- [ ] Create `apps/study/src/routes/(app)/plans/[id]/+page.server.ts` -- load plan; actions `update`, `archive`, `activate`.
- [ ] Create `apps/study/src/routes/(app)/plans/[id]/+page.svelte` -- plan detail with editable fields, skip_nodes list with per-node "remove" action, archive/activate buttons.
- [ ] Run `bun run check` -- 0 errors, commit.

### 18. Session start -- preview + adjust

- [ ] Create `apps/study/src/routes/(app)/session/start/+page.server.ts`:
  - Load: active plan + `previewSession(userId, opts)` with opts derived from query params.
  - Actions: `shuffle`, `replaceItem`, `commit`.
- [ ] Create `apps/study/src/routes/(app)/session/start/+page.svelte`:
  - Mode selector (Continue / Strengthen / Mixed / Expand).
  - Focus selector (domain dropdown; defaults to "Match my plan").
  - Cert override selector.
  - Preview: items grouped by slice with reasoning labels.
  - Shuffle / Replace-item / Start buttons.
  - Empty-state message for no-plan / no-candidates.
- [ ] Run `bun run check` -- 0 errors, commit.

### 19. Session play

- [ ] Create `apps/study/src/routes/(app)/sessions/+page.server.ts` + `+page.svelte` -- history list.
- [ ] Create `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts`:
  - Load: session + current slot (first unresolved `session_item_result`). If all resolved, load summary.
  - Actions: `recordResult` (after card review or rep attempt), `skip`, `finishEarly`, `complete`.
- [ ] Create `apps/study/src/routes/(app)/sessions/[id]/+page.svelte`:
  - Cursor through items. For `kind='card'`, embed the existing Memory review component for that card and wire its rating submission to also `recordResult`. For `kind='rep'`, embed the existing Rep session component for that scenario. For `kind='node_start'`, render a "Begin node" card that links to the node detail page and records advancement as completion.
  - Skip dropdown with three options (today / topic / permanent).
  - Progress indicator (N of M).
  - Finish early button.
  - Summary view shown on completion: attempted / correct / avg confidence / domains / nodes started / streak / Suggested next.
- [ ] Run `bun run check` -- 0 errors, commit.

### 20. Navigation + dashboards

- [ ] Update `apps/study/src/routes/(app)/+layout.svelte` -- add Plans + Sessions nav items.
- [ ] Add a "Start session" primary action on `/memory`, `/reps`, and the dashboard that routes to `/session/start`.
- [ ] Run `bun run check` -- 0 errors, commit.

### 21. Graph integration (post-graph-spec)

- [ ] `[graph]` Once the knowledge-graph spec signs off and the graph BC exists:
  - Wire `getCandidateNodes(db, userId, filters) -> NodeCandidate[]` in `sessions.ts` `previewSession`, replacing the empty-array stub.
  - Wire `isNodeMastered(db, userId, nodeId)` and `getNodeMastery(db, userId, nodeId)` into the pool queries.
  - Wire `getDomainMasteryTrend(db, userId, domain)` into Strengthen scoring.
  - Reconcile `node_id` text column -> FK if the graph persists nodes in the DB. If so, add the constraint in a follow-up migration.
  - Update "skip topic" in `sessions.ts skipItem` to prefer `addSkipNode` when the card/scenario has a `node_id`.
  - Expand unit-test coverage for node-based pool paths (currently skipped with `test.todo`).
- [ ] `[graph]` Verify Suggested next "Finish node X" hint when content-phase completion is exposed by the graph.
- [ ] Run `bun run check` + `bun test` -- 0 errors, all pass, commit.

## Post-implementation

- [ ] Full manual test per test-plan.md.
- [ ] Run `/ball-review-full` for the feature.
- [ ] Apply review fixes.
- [ ] Commit docs updates; mark `review_status: done` on all docs when the user confirms `status: done`.
