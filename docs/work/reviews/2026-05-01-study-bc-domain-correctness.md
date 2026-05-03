---
feature: study-bc-domain
category: correctness
date: 2026-05-01
branch: main
issues_found: 12
critical: 0
major: 4
minor: 6
nit: 2
status: unread
review_status: done
---

## Status as of 2026-05-04

| Severity | Count | Closed | Open |
| -------- | ----: | -----: | ---: |
| critical |     0 |      0 |    0 |
| major    |     4 |      3 |    1 |
| minor    |     6 |      1 |    5 |
| nit      |     2 |      0 |    2 |

### MAJOR: `recordItemResult` upsert vs documented contract -- CLOSED

PR #437. `libs/bc/study/src/sessions.ts:933-963` now uses a pure `db.update(sessionItemResult).set(...).where(...).returning()` with explicit zero-row check that throws `SessionSlotNotFoundError`. Audit emit + tx wrap added. Regression test at `sessions.test.ts:311-336` ("throws SessionSlotNotFoundError when the slot row was never inserted -- no ghost row created") confirms. Closed.

### MAJOR: `updateCard` mutates card + cardSnooze outside transaction -- STILL OPEN

`libs/bc/study/src/cards.ts:168-225` still runs both writes on raw `db`. Trigger: roll into next cards-feedback WP; wrap in `db.transaction(async tx => { ... })` and thread `tx` through both updates.

### MAJOR: `skipSessionSlot` inherits `recordItemResult` upsert bug -- CLOSED

The root-cause `recordItemResult` rewrite (PR #437) propagates to `skipSessionSlot` via the same call. `libs/bc/study/src/sessions.ts:1010-1095` calls the rewritten function inside its outer transaction; ghost-slot path is gone. Closed.

### MAJOR: `getRepDashboard` docstring vs SQL inversion -- CLOSED

`libs/bc/study/src/scenarios.ts:776-781` docstring now reads "both `scenarioCount` and `unattemptedCount` count only `status = ACTIVE` rows. Archiving a scenario removes it from both totals." Matches the SQL. Closed.

### MINOR: `submitAttemptSchema.chosenOptionId` 50-char cap -- CLOSED

`libs/bc/study/src/validation.ts:175` raised to `max(150)`. Comfortably covers `30-char scenario id + 50-char option id + separator`. Closed.

### MINOR: `getCitationsForSyllabusNode` legacy filter divergence -- STILL OPEN

`libs/bc/study/src/syllabi.ts:216-227` still returns `row?.citations ?? []` without `isStructuredCitation` filter. No comment confirming syllabus_node.citations was never legacy. Trigger: roll into a citations-shape audit pass; either add the filter for defense in depth or document the divergence on the JSDoc.

### MINOR: `createGoal` primary-clear sweeps every goal -- CLOSED

`libs/bc/study/src/goals.ts:262-267` clear is now narrowed via `and(eq(goal.userId, params.userId), eq(goal.isPrimary, true))`. Mirrors `setPrimaryGoal`. Closed.

### MINOR: `applyCertGoalsToPrimaryGoal` non-transactional -- STILL OPEN (mirrors backend CRITICAL)

Same finding as backend's CRITICAL. Per-cert reads are batched (#481) but multi-write phase still runs outside `db.transaction`. Trigger documented in backend audit; closing here as a duplicate symptom.

### MINOR: `getReviewedCardIdsInSession` ownership predicate -- STILL OPEN

`libs/bc/study/src/review-sessions.ts:338-348` still scopes by `(userId, reviewSessionId)` only; no join to `memoryReviewSession` row. Trigger: roll into review-sessions hardening pass; load the session row first.

### MINOR: `getRepAccuracy` / `getDomainAccuracy` / `getRepStats` clamp -- STILL OPEN

`libs/bc/study/src/scenarios.ts:645-728` accuracy aggregates still return `correct / attempted` without `Math.max(0, Math.min(1, ...))`. Schema CHECK keeps the input safe today. Trigger: only matters if the schema CHECK on `is_correct boolean` is ever loosened.

### MINOR: `recordPhaseVisited` / `recordPhaseCompleted` validate input -- STILL OPEN

`libs/bc/study/src/knowledge.ts:1224-1311` still accept arbitrary nodeId / phaseId strings (mirrored in security MINOR). Trigger: roll into the next knowledge-graph hardening WP; pre-validate against `knowledge_node` and the phase constants vocabulary.

### NIT: `getStreakDays` cursor advancement -- STILL OPEN

`libs/bc/study/src/sessions.ts:1063-1126` loop unchanged. Trigger: streaks polish pass.

### NIT: `aggregateSimNodePressure` clamp loop iteration -- STILL OPEN

`libs/bc/study/src/sim-bias.ts:60-63` still uses a second pass over the Map. Trigger: sim-bias polish pass; fold the clamp into the contribution loop.

### Final verdict

3 of 4 majors closed (`recordItemResult` rewrite + `skipSessionSlot` inheritance + docstring fix). 1 of 6 minors closed (cap raise) plus a second (`createGoal` primary-clear). 5 minors + 2 nits remain as concrete-trigger follow-ups. `review_status` stays `done`.

## Summary

Reviewed `libs/bc/study/src/` end to end (cards, reviews, scenarios, sessions, engine, plans, goals, knowledge, mastery, lenses, calibration, library-by-cert, dashboard, stats, snooze, syllabi, credentials, review-sessions, sim-bias, engine-targeting, srs, validation). The engine + scoring layer is well-grounded against ENGINE_SCORING (ADR 014); the dual-gate mastery and FSRS wrappers are clean. The findings cluster around three themes: (1) write-path atomicity gaps where multi-step mutations skip transactions, (2) a `recordItemResult` UPSERT whose comment promises an error path the implementation never takes, and (3) defensive narrowing inconsistencies (legacy citation filter applied on knowledge nodes but not syllabus nodes; scenario chosenOptionId schema cap that can reject legitimate composite ids).

## Issues

### MAJOR: recordItemResult silently inserts when slot row missing, contradicting the documented contract

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/sessions.ts (lines 864-941)

Problem: The docstring in `recordItemResult` states "The BC contract is that slots are inserted by `commitSession`; results UPSERT an existing row. If no row exists for this slot, it's an error condition worth surfacing -- inserting a fresh row here would accept slotIndex / itemKind values the caller controls rather than the engine snapshot, and the `presentedAt` would be wrong (now, not commit time)." However, the implementation uses `db.insert(...).onConflictDoUpdate(...)`, which inserts a fresh row when no matching `(session_id, slot_index)` exists. The `if (!row) throw new SessionSlotNotFoundError(...)` guard at line 939 is unreachable in practice since `.returning()` returns the inserted row.

Trigger: A buggy caller passes a `slotIndex` that wasn't created by `commitSession` (off-by-one, stale client, fabricated index), or a delete-and-replay scenario where slot rows were removed out-of-band. Instead of failing loudly, a "ghost" slot row gets created with caller-controlled itemKind/slice/reasonCode and `presentedAt = now` (vs commit time). Subsequent reads (summary, calibration) treat it as a real slot.

Fix: Replace the upsert with an explicit UPDATE-WHERE, then check rowcount. If zero rows updated, throw `SessionSlotNotFoundError`. Atomic against concurrent writers because the row already exists post-commit; the UNIQUE backstop is no longer load-bearing here.

```typescript
const rows = await db
    .update(sessionItemResult)
    .set(updateSet)
    .where(and(
        eq(sessionItemResult.sessionId, sessionId),
        eq(sessionItemResult.userId, userId),
        eq(sessionItemResult.slotIndex, result.slotIndex),
    ))
    .returning();
const row = rows[0];
if (!row) throw new SessionSlotNotFoundError(sessionId, result.slotIndex);
return row;
```

### MAJOR: updateCard mutates card and cardSnooze outside a transaction

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/cards.ts (lines 168-225)

Problem: `updateCard` first runs an UPDATE on `card` (lines 193-197), then conditionally runs an UPDATE on `cardSnooze` to mark active `bad-question` snoozes as edited (lines 209-222). Both writes happen on `db` directly, not on a transaction. If the second update fails (FK contention, lock timeout, transient connection drop), the card mutation is committed but the bad-question snooze re-entry banner won't fire on the next review of that card -- the learner's intent was "I edited the bad question; tell the reviewer," and the system silently dropped the second half.

Trigger: Network blip or contention between the two writes after the card UPDATE commits. Asymptomatic until a learner re-encounters a bad-question-snoozed card and the banner doesn't appear.

Fix: Wrap both writes in `db.transaction`. The transaction also makes the "did content actually change?" computation safer because both rows reflect a single edit point.

### MAJOR: skipSessionSlot transactional coverage is broken by recordItemResult's upsert

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/sessions.ts (lines 978-1023)

Problem: `skipSessionSlot` wraps `recordItemResult` + `addSkipNode/Domain` + `setCardStatus/setScenarioStatus` in `db.transaction`. The transaction shape is correct, but `recordItemResult` (called inside the tx via `tx`) is a passthrough -- it inherits the bug above. When a stale slot index is passed, the transaction succeeds with a freshly-inserted ghost slot row, and the plan mutation + content suspension still apply. The user gets a "permanent skip" with content suspended and a phantom slot row that doesn't correspond to any engine-authored item.

Trigger: Same as the `recordItemResult` issue, plus any handler that passes the `slot` shape from a stale client cache.

Fix: Same fix as above (UPDATE-only path); the transaction shape stays correct.

### MAJOR: getRepDashboard `unattemptedCount` is inflated by archived scenarios with no attempts

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/scenarios.ts (lines 783-866)

Problem: The docstring acknowledges this trade-off -- "If a learner attempts a scenario and later archives it, the archived row disappears from `scenarioCount` but does not affect `unattemptedCount`" -- but the comment is reversed relative to the actual SQL. The `unattempted` aggregate is computed inside the per-domain GROUP BY over `outerScenario` filtered to `status = ACTIVE` only (line 818). So archived scenarios with no attempts are correctly excluded. The bug is that the documented invariant ("archive doesn't affect unattempted") is wrong -- archive does drop the row from both counts. That's the right behavior; the comment misleads readers expecting older code paths.

Trigger: A reviewer reading the docstring assumes the count includes historically-archived rows and writes a follow-on dashboard panel against that assumption.

Fix: Update the docstring to match the SQL ("archived scenarios are excluded from both `scenarioCount` and `unattemptedCount`; archive removes a scenario's contribution to both totals"). Code is correct as-is.

### MINOR: submitAttemptSchema chosenOptionId cap of 50 chars rejects legitimate composite ids

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/validation.ts (line 170)
File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/scenarios.ts (lines 254-256)

Problem: `createScenario` builds option PKs as `${scenario_id}__${o.id}` (e.g. `rep_<26-char-ulid>__a` -> ~33 chars). The authored option id is bounded by `scenarioOptionSchema.id` at max(50). The composite id can therefore reach `30 + 2 + 50 = 82` chars, but `submitAttemptSchema.chosenOptionId` caps the parsed id at `max(50)`. An author who uses option ids longer than ~17 characters produces unsubmittable scenarios; the seed never trips this because seeded option ids are single letters.

Trigger: Seed or hangar tooling authors a scenario with verbose option ids (e.g. `option-divert-to-alternate-airport`); the rep submission silently fails Zod at the BC layer with a 400 instead of recording the attempt.

Fix: Either raise the cap (e.g. `max(150)` to comfortably cover a 30-char scenario id + 50-char option id + separator) or validate the option-id portion separately by re-deriving the composite shape. The composite id is also visible to clients via `getScenarioWithOptions`, so any cap should honor what `createScenario` can produce.

### MINOR: getCitationsForSyllabusNode doesn't filter legacy citations the way getCitationsForKnowledgeNode does

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/syllabi.ts (lines 216-227)
File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/knowledge.ts (lines 374-392)

Problem: `getCitationsForKnowledgeNode` runs each entry through `isStructuredCitation` to drop pre-migration legacy entries from a column whose Drizzle `$type` is `LegacyCitation[]` for back-compat. The docstring on `getCitationsForKnowledgeNode` says "Mirrors `getCitationsForSyllabusNode` in `syllabi.ts`," but `getCitationsForSyllabusNode` (line 226) returns `row?.citations ?? []` without the type-guard filter. If `syllabus_node.citations` was ever authored or backfilled with mixed legacy entries (or ever might be in a future migration), every downstream consumer (lens leaves, cert dashboard) would receive untyped data shaped as `StructuredCitation[]`.

Trigger: A migration script writes a `LegacyCitation` shape into `syllabus_node.citations`, or a future schema change parallels the knowledge_node migration.

Fix: Either apply the same `isStructuredCitation` filter in `syllabi.ts:getCitationsForSyllabusNode` for defense in depth, or add a comment confirming syllabus_node.citations was never legacy and never will be (so the divergence is intentional and documented). The cross-reference in knowledge.ts becomes accurate either way.

### MINOR: createGoal's primary-clear sweeps every goal for the user, not just `is_primary=true` rows

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/goals.ts (lines 249-256)

Problem: When `params.isPrimary === true`, the transactional clear runs `tx.update(goal).set({ isPrimary: false, updatedAt: new Date() }).where(eq(goal.userId, params.userId))`. This bumps `updatedAt` on every goal owned by the user, including archived ones, even though only `is_primary=true` rows can collide with the partial UNIQUE. By contrast, `setPrimaryGoal` (lines 295-310) correctly narrows with `and(eq(goal.userId, userId), eq(goal.isPrimary, true))`. The asymmetry is non-critical (no incorrect data), but it pollutes `updatedAt` on rows that didn't actually change, which can mislead listGoals' default ordering and any audit consumer.

Trigger: User creates a new primary goal; every existing goal's `updatedAt` jumps to now.

Fix: Add `eq(goal.isPrimary, true)` to the `where` clause in `createGoal`'s clear step to match `setPrimaryGoal`.

### MINOR: applyCertGoalsToPrimaryGoal write-path is non-transactional

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/goals.ts (lines 527-580)

Problem: The helper does (a) read primary goal, (b) optionally createGoal, (c) optionally update targeting fields, (d) loop over `certs` calling `addGoalSyllabus`. Each step is its own DB call -- no outer transaction. If step (d) throws midway (e.g. credential resolution fails for the third of five certs), the user is left with a primary goal that has the first two cert syllabi attached but no signal to the caller about partial application. The function returns `skippedCerts`, but only for credential-not-found and missing-primary-syllabus cases; mid-loop exceptions propagate and discard any partial-success info.

Trigger: Transient FK error or credential lookup failure mid-loop after some `addGoalSyllabus` upserts have committed.

Fix: Wrap the entire helper body in `db.transaction(async tx => { ... })` and pass `tx` through. `addGoalSyllabus` already accepts a `Db` parameter; the upserts collapse to one atomic write so the caller sees "all or nothing."

### MINOR: getReviewedCardIdsInSession lacks an authorization predicate consistency check

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/review-sessions.ts (lines 338-348)

Problem: The query filters `eq(review.userId, userId)` and `eq(review.reviewSessionId, sessionId)` but doesn't verify that the session itself belongs to `userId`. In practice, `submitReview` stamps `reviewSessionId` only when the caller passes one in, and the session-fetch routes guard ownership separately. A buggy caller that obtains a `sessionId` belonging to another user but uses their own `userId` would get an empty list rather than an error -- soft failure rather than hard failure. Consistent with read-side scoping elsewhere in the BC, but defensive practice (and the rest of `review-sessions.ts`) typically loads the session row first.

Trigger: A caller fabricates a session id from another user; the function silently returns `[]` instead of erroring.

Fix: Either join `memoryReviewSession` in the WHERE to enforce ownership, or call `resumeReviewSession`/equivalent first to load the row. Low impact -- this is a read path, not a mutation -- but tightens the invariant.

### MINOR: getRepAccuracy / getDomainAccuracy / getRepStats numeric input not range-checked

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/scenarios.ts (lines 645-728)

Problem: All three accuracy aggregates compute `accuracy = correct / attempted` with the standard zero-guard. `attempted` and `correct` come from Postgres `count(*)` and `count(*) filter (...)` casts. If a malformed write ever produced `correct > attempted` (impossible with the current schema CHECK), accuracy would exceed 1.0 silently. The schema CHECK (`is_correct boolean`) prevents this, but the BC could clamp defensively to keep the contract airtight.

Trigger: Schema CHECK is removed in a future migration without re-auditing this layer.

Fix: Wrap the division in `Math.max(0, Math.min(1, correct / attempted))` so the BC contract on accuracy in [0, 1] doesn't depend on schema invariants holding forever.

### NIT: getStreakDays fallback walk uses `cursor` advancement that bypasses missing days but never resets

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/sessions.ts (lines 1063-1126)

Problem: The streak walk does `if (d > cursor) continue` to skip ahead past days that are newer than the cursor, then matches `d === cursor` to increment the streak. But the SQL ordering is descending day, and the cursor only ever moves backwards (`setUTCDate(getUTCDate() - 1)`). The "skip ahead" branch can therefore only fire when grace was applied (cursor=yesterday) and the first row is today -- a legitimate case. But the cursor never resets if the grace branch triggers and yesterday genuinely has no data; the loop falls through to the `d < cursor` break on the second iteration. Correct behavior, but the comment "Skip ahead past the grace-skipped day" oversells what's happening; refactoring the loop to handle "today vs yesterday" as a single decision before the loop would make the invariant easier to verify.

Fix: Refactor for readability; behavior is correct.

### NIT: aggregateSimNodePressure clamp uses `if (raw > 1)` mid-iteration over a Map being mutated

File: /Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/sim-bias.ts (lines 60-63)

Problem: The clamp loop iterates `for (const [nodeId, raw] of accum)` while mutating `accum`. ECMA Map iteration is well-defined to surface in-place mutations of existing keys (the new value would not be re-yielded), but the pattern reads as fragile. A direct `Math.min(1, value)` on insert in the previous loop would avoid the second pass entirely and remove the iteration-during-mutation question.

Fix: Move the clamp into the contribution loop:

```typescript
const clamped = Math.min(1, previous + contribution);
accum.set(link.nodeId, clamped);
```
