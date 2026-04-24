# ADR 012: Unify reps and sessions onto one substrate

Status: **Accepted**.

Date proposed: 2026-04-22. Date accepted: 2026-04-22.

Supersedes: nothing. Informs: rep flow, session engine, dashboard aggregators, calibration.

## Decision

Unify `/reps/session` and `/sessions/[id]` onto the `session` + `session_item_result` substrate. Delete `repAttempt`. Replace the "create-a-plan-first" gate on rep entry points with a **preset gallery** that lets a user spin up a session in one click.

One runner. One audit trail. One mental model.

## What changed since the proposal

The original draft (Option C) argued that two runners were the low-risk path because "plan-gating UX is worse than today's one-click reps." The user reframed: the gate isn't the problem -- the empty-state is. A preset gallery with a small set of ready-to-go plans lets a user go from dashboard to first scenario in one click, regardless of whether they've ever authored a plan.

That collapses the main objection to Option B. The secondary objection (schema migration cost) is exactly the kind of thing the PRIME DIRECTIVE ("do the right thing, always; no stubs; no 'for now'") tells us not to defer. Split audit trails get more expensive every week: every new dashboard query, every aggregator, every cross-surface metric has to branch on "rep vs session" until the migration happens.

Do the hard stuff early. Accepting Option B.

## The preset gallery

When a user hits an entry point that needs a session and has no active plan, the `/session/start` page renders a gallery of presets instead of an empty-state wall. Each preset creates a plan with sensible defaults and immediately starts a session.

Initial preset set (authored content, not enum values):

1. **Reps only -- all domains** -- zero cert goals, no focus restrictions, session length default, mode = `mixed`. The direct replacement for today's `/reps/session` one-click experience.
2. **Private Pilot overview** -- cert goal = PPL, focus domains span the PPL knowledge areas, session length default.
3. **Safety procedures overview** -- focus on `safety-ops` and `emergency-procedures` domains (names tbd from the domain taxonomy).
4. **BFR prep** -- mixed PPL review, emphasis on flight review topics (airspace, regs, maneuvers, emergency ops).
5. **FIRC** -- instructor refresher, focus on CFI-relevant regs, learning theory, checkride-instructor topics.
6. **Create your own study plan** -- links to `/plans/new` for full control.

Each preset is a typed record with label, description, cert goals, focus domains, skip domains, depth preference, default mode, and session length. Presets live in `libs/constants/src/presets.ts` (or similar) so they're version-controlled content, not config-table rows. Users don't edit them; they pick one.

A user who picks preset (1) "Reps only -- all domains" creates a plan record of the same shape as any other plan, with all cert goals empty. There's no separate "rep-only plan" type -- it's just a plan that happens to have no cert goals, which the engine already handles.

## Why presets and not a rep-only session mode

Adding `SESSION_MODES.REPS_ONLY` to the engine would push "reps are different" into the core. The engine already has slices (`CONTINUE`, `STRENGTHEN`, `EXPAND`, `DIVERSIFY`) that compose modes. A plan with no cert goals + no focus domains naturally produces a session full of reps; no new mode needed.

The preset captures the product shape ("give me reps to practice") without forcing the engine to know about rep-only sessions. Presets are the product layer; the engine stays abstract.

## What happens to `repAttempt`

**Delete it.** Pre-alpha data is disposable -- there's one user (user zero / dev), no real history worth preserving. The migration drops the `rep_attempt` table, drops `session_item_result.repAttemptId`, and removes every `repAttempt` import from the BC.

Rejected alternatives:

- **Backfill to `session_item_result`**: would create synthetic session rows for historical attempts. Correct for a production system with real users, but the cost is real and the benefit is zero for pre-alpha data.
- **Keep `repAttempt` read-only**: would split audit trail forever. Every aggregator would read both tables. Explicitly the problem this ADR exists to solve.

## Code that moved

The following files read or wrote `repAttempt` before this ADR and now read/write `session_item_result`:

- `libs/bc/study/src/calibration.ts` -- `confidence` / `isCorrect` buckets now read `session_item_result` filtered by `itemKind='rep'`.
- `libs/bc/study/src/dashboard.ts` -- scheduled-reps panel + activity panel aggregates now read the same substrate.
- `libs/bc/study/src/scenarios.ts` -- `getRepAttemptsForSession` deleted in phase 6. `submitAttempt` is a pure validator; persistence moved to `recordItemResult`.
- `libs/bc/study/src/knowledge.ts` -- knowledge-node mastery reads rep contribution from `session_item_result`.
- `libs/bc/study/src/sessions.ts` -- `recordItemResult` is now the single writer (with UPSERT guarded by UNIQUE(session_id, slot_index)).
- `apps/study/src/routes/(app)/reps/session/*` -- deleted in phase 6.
- `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts` -- no longer sets `repAttemptId` on slot rows.

## Execution outcome

Shipped 2026-04-22 in the order described below. Phases were sequenced, not parallelized, because each phase's data-flow depended on the prior phase being on main. The one order deviation from the original draft (5 before 3) reflects the real constraint: BC callers had to move off `repAttempt` before the `/reps/session` redirect could land or the redirected traffic would write to an orphan table.

| Phase | Content                                                                                                                                                                                                                | Delivered in |
|-------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|
| 1+2   | `libs/constants/src/presets.ts` catalogue (6 tiles: Quick reps, PPL overview, Safety, BFR prep, FIRC, Custom). Preset gallery on `/session/start`. New `?/startFromPreset` action: validate -> archive existing -> `createPlan` -> `startSession` -> 303 to `/sessions/[id]`. | PR #33       |
| 5     | `libs/bc/study/*` refactored off `repAttempt` onto `session_item_result`. `submitAttempt` became a pure validator; `recordItemResult` writes outcomes. `sessionItemResult` schema gained `chosen_option`, `is_correct`, `confidence`, `answer_ms` plus two indexes.           | PR #38       |
| 3     | `/reps/session` reduced to a 308 redirect to `/session/start`. `ROUTES.REPS_SESSION` constant removed. Four first-party callers (dashboard CtaPanel, ScheduledRepsPanel, `/reps` index, `/calibration`) switched to `ROUTES.SESSION_START`. | PR #39       |
| 4     | `rep_attempt` table dropped. `session_item_result.rep_attempt_id` column dropped. `RepAttemptRow`, `NewRepAttemptRow`, `REP_DEDUPE_WINDOW_MS`, `ItemResultInput.repAttemptId` removed. Grep-clean.                                          | PR #41       |
| 6     | `apps/study/src/routes/(app)/reps/session/*` deleted. `getRepAttemptsForSession` + `getScenariosByIds` helpers removed from `scenarios.ts` along with their tests.                                                                                 | PR #42       |
| 7     | Verification: `bun run check` clean, 177 tests green, grep returns zero hits for all removed symbols, `/knowledge`/dashboard/calibration render correctly, one permitted comment reference in `libs/constants/src/routes.ts` documents the retirement. | on main      |

One follow-up correctness fix landed later: the preset gallery 500'd on "Quick reps" and "Safety procedures" because `createPlanSchema.certGoals` still required `min(1)`. That contradicted the presets' cert-agnostic intent. Resolved in PR #51 by relaxing the schema to allow empty arrays and handling the empty case in every cert-aware aggregator. The "empty certGoals is first-class" appendix below records the decision.

A backend correctness fix landed in the same PR: `session_item_result` had no UNIQUE constraint on `(session_id, slot_index)` and `recordItemResult` used SELECT-then-INSERT, so concurrent submits could double-insert. The "session-slot idempotency enforced at the DB" appendix below records the DB-level fix.

## Rollback posture

Not reversible. Pre-alpha data is disposable, and the substrate unification is a terminal decision -- rolling back would require re-introducing `repAttempt` and every caller branching on two tables, which is the problem this ADR exists to solve. If execution goes wrong, the remedy is to fix forward.

## Followups captured elsewhere

- Tokens the new preset UI will want: `--ab-color-fg-strong`, a body font-size token. Flagged in earlier agent reports.
- Preset content is version-controlled; future presets (IFR prep, commercial prep, CFI prep, etc.) land as PRs that add preset records.

## Appendix: empty certGoals is a first-class plan state

The "Quick reps" and "Safety procedures" presets ship `certGoals: []` intentionally: the engine's `fetchNodeCandidates` treats an empty `certFilter` as "no cert restriction," producing a session that spans every domain the user can touch. This is the direct replacement for the old one-click rep flow.

When the preset gallery landed we carried over a stricter `createPlanSchema.certGoals.min(1)` rule from an earlier plan-builder design. That rule forced every plan -- including preset-derived ones -- to declare a cert, which collapsed the cert-agnostic plan shape the presets depend on. The fix that landed in PR #51: relaxed the schema to `max(4).default([])` and surfaced the "General practice, no specific cert" option in the manual plan builder so authors can deliberately opt into a cert-agnostic plan. Every downstream consumer already handled the empty-array case (dashboard StudyPlanPanel renders "none," plan detail page renders "none," engine filters skip the cert predicate), so only the schema and the validator forms needed to move.

Takeaway: a plan with no cert goals is a valid plan, not an invalid one. Presets are the proof: they are the ship-it product shape for cert-agnostic study.

## Appendix: session-slot idempotency is enforced at the DB, not just in code

The session runner writes rep/card/skip outcomes through `recordItemResult`, which looks up an existing `session_item_result` row by `(session_id, slot_index)` and either updates or inserts. Before phase-6 we had a non-unique index on those two columns and a SELECT-then-UPDATE-or-INSERT pattern in the BC. That combination is not atomic: two concurrent submits for the same slot (double-tap, SvelteKit enhance retry on a transient 5xx, duplicate tab) can both miss the SELECT and both INSERT, producing two rows for one slot and double-counting aggregates.

ADR 012 is explicit that the substrate is the single audit trail -- duplicate rows defeat that promise. Load-bearing fix: add a `UNIQUE(session_id, slot_index)` constraint on `session_item_result`, then switch `recordItemResult` to an atomic UPSERT via `.onConflictDoUpdate({ target: [sessionId, slotIndex], ... })`. The DB guarantees single-row-per-slot regardless of how many concurrent writers show up. The UPSERT makes the "second submit updates the existing row" contract actual instead of aspirational.

Don't remove the UNIQUE constraint. Without it the idempotency claim is a lie.

## Addendum: Idempotency (2026-04-23)

Verification pass after the `REP_DEDUPE_WINDOW_MS` constant was removed in PR #41. The goal: prove double-writes cannot slip through without that window. Walk of every write path into `session_item_result`, plus the upstream `submitReview` write that feeds it.

### The guarantee

For any given `(session_id, slot_index)` pair, at most one row exists in `session_item_result`. Concurrent submits (double-tap, SvelteKit `enhance` retry on a transient 5xx, duplicate tab, network retry) collapse to exactly one row. The second writer updates the row the first writer inserted; it does not create a duplicate.

For card reviews specifically, `submitReview` is idempotent within `REVIEW_DEDUPE_WINDOW_MS`: a second review submit for the same `(card_id, user_id)` inside the window returns the original review row without writing a new one. This is independent of the slot-result guarantee above.

### Where it is enforced

1. **DB constraint: `sir_session_slot_unique`** on `session_item_result(session_id, slot_index)`. Defined in `libs/bc/study/src/schema.ts` line 639. This is the load-bearing invariant. Without it, the UPSERT below would race and insert duplicates.

2. **Atomic UPSERT in `recordItemResult`** (`libs/bc/study/src/sessions.ts` line 827-904). The write is a single statement: `db.insert(sessionItemResult).values({...}).onConflictDoUpdate({ target: [sessionId, slotIndex], set: updateSet }).returning()`. The conflict target matches the UNIQUE index exactly. Two writers racing on the same slot both hit `ON CONFLICT DO UPDATE`, and Postgres serializes the update; neither gets `INSERT`-then-duplicate.

3. **`submitAttempt` is pure** (`libs/bc/study/src/scenarios.ts` line 385-414). It validates the chosen option against the scenario and returns a `RepAttemptOutcome`. No writes. Double-calling it has no persistence effect. The caller (session route) persists the outcome via `recordItemResult`, which is the UPSERT above.

4. **`submitReview` locks + dedupes** (`libs/bc/study/src/reviews.ts` line 57-129). Inside a `db.transaction`, the function takes `SELECT FOR UPDATE` on the `card_state` row for `(card_id, user_id)`, then checks for an existing review within `REVIEW_DEDUPE_WINDOW_MS` and returns it if present. The row lock ensures a concurrent submit sees the first inserter's row. The session route then calls `recordItemResult` with `reviewId=rev.id`, which UPSERTs the slot row.

5. **Route-level ordering**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts` actions (`submitReview`, `submitRep`, `completeNode`, skip variants) all funnel to `recordItemResult`. The `submitRep` path validates via `submitAttempt` (pure) then UPSERTs. The `submitReview` path writes a review row (dedupe-windowed) then UPSERTs the slot with that `reviewId`.

Double-submit scenarios, by path:

| Scenario                                               | What prevents duplicate            | Where                                           |
| ------------------------------------------------------ | ---------------------------------- | ----------------------------------------------- |
| Rep submit hit twice in parallel                       | UPSERT + `sir_session_slot_unique` | `recordItemResult`                              |
| Card submit hit twice in parallel                      | Row lock + dedupe window + UPSERT  | `submitReview` tx, then `recordItemResult`      |
| Node-complete hit twice in parallel                    | UPSERT + `sir_session_slot_unique` | `recordItemResult`                              |
| Skip submit hit twice in parallel                      | Transactional skip + UPSERT        | `skipSessionSlot` -> `recordItemResult`         |
| Complete session hit twice in parallel                 | Predicate `completed_at IS NULL`   | `completeSession` UPDATE with null guard        |
| `submitAttempt` called twice (e.g., retry)             | Pure function; no persistence      | n/a (idempotent by construction)                |

### Gap analysis

None found. The DB constraint is present and the BC uses it via an atomic UPSERT. Every known write path into `session_item_result` routes through `recordItemResult`; there is no alternative insert path that could bypass the conflict target. `submitReview` has its own idempotency (row lock + window) which is independent and additive: even if a caller invoked `submitReview` twice, the review row-count would not diverge, and the slot row would reference the same `reviewId` either way.

The removed `REP_DEDUPE_WINDOW_MS` constant was protecting the old `rep_attempt` table at the BC layer. With `rep_attempt` deleted and rep outcomes living on the slot row, the slot's DB-level UNIQUE subsumes that protection and is strictly stronger (atomic, concurrent-safe, no wall-clock window to tune).

### Invariants to keep

- `sir_session_slot_unique` stays. Removing it collapses the claim back to a race.
- `recordItemResult` stays an UPSERT with `target: [sessionId, slotIndex]`. Any rewrite to SELECT-then-INSERT reintroduces the duplicate-insert race.
- `submitReview` keeps its `SELECT FOR UPDATE` lock + dedupe-window check inside the transaction. Dropping either lets parallel card submits produce two review rows.
- Any new write path into `session_item_result` must go through `recordItemResult`. Callers that bypass it are a correctness bug.
