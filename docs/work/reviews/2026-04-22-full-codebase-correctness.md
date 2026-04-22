---
feature: full-codebase
category: correctness
date: 2026-04-22
branch: main
issues_found: 15
critical: 2
major: 5
minor: 6
nit: 2
---

## Summary

Reviewed the study BC (`libs/bc/study/src/*`), the unified session runner (`apps/study/src/routes/(app)/sessions/[id]/`), the preset gallery (`apps/study/src/routes/(app)/session/start/`), supporting auth/constants/utils libs, and the sim app's worker protocol. Overall the ADR 012 substrate unification is clean and consistent -- rep outcomes are sourced from `session_item_result` throughout (calibration, dashboard, scenarios, knowledge). Two critical issues stand out: (1) the preset gallery's headline preset "Quick reps" (and "Safety procedures") will crash when the user picks them because `createPlanSchema` requires `certGoals.min(1)` while these presets pass `certGoals: []`, (2) the session runner's `topic` and `permanent` skip kinds don't actually mutate the plan or suspend the underlying card/scenario, so they behave identically to `today` despite ADR-documented semantics. Several major issues below affect rep-slot correctness defence-in-depth, streak computation with midnight boundaries, and redistribute comment accuracy.

## Issues

### CRITICAL: "Quick reps" and "Safety procedures" presets fail validation at create time

- **File**: `libs/constants/src/presets.ts:81,118` and `libs/bc/study/src/plans.validation.ts:30`
- **Problem**: `REPS_ONLY` and `SAFETY_OVERVIEW` presets declare `certGoals: []`. The preset-start action at `apps/study/src/routes/(app)/session/start/+page.server.ts:127` calls `createPlan({ userId, ..., certGoals: preset.certGoals, ... })` which runs `createPlanSchema.parse(...)`, and `createPlanSchema.certGoals` is `z.array(planEnum.cert).min(1, 'pick at least one certification').max(4)` -- an empty array throws. Test coverage confirms this directly: `libs/bc/study/src/plans.test.ts:75` asserts `createPlan({ ..., certGoals: [] })` rejects. The "Quick reps" tile is the literal headline feature of ADR 012's preset gallery ("direct replacement for today's `/reps/session` one-click experience"). Picking it returns a generic 500 "Could not start the session from that preset" after the schema throw.
- **Trigger**: From `/session/start` empty-state, click "Quick reps" or "Safety procedures".
- **Fix**: Either relax `createPlanSchema.certGoals` to `z.array(planEnum.cert).max(4).default([])` (and update `updatePlanSchema` symmetrically) -- the engine already handles empty `certGoals` in `fetchNodeCandidates` (`libs/bc/study/src/sessions.ts:391`), and the schema column has no CHECK constraint on emptiness -- or add a sentinel cert to these presets. The engine-handles-empty path aligns with the ADR's explicit "a plan with no cert goals naturally produces a session full of reps" language. The existing `plans.test.ts:75` test must be inverted when you relax the rule.

### CRITICAL: `topic` and `permanent` session skips are lies -- they don't mutate anything but the slot

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:317-340` and `libs/constants/src/study.ts:622-626`
- **Problem**: `SESSION_SKIP_KINDS` docs declare "topic: mutates plan.skip_domains or plan.skip_nodes; permanent: mutates plan.skip_nodes AND suspends card/scenario". The runner's `skip` action just calls `recordItemResult` with the skipKind and never calls `addSkipDomain`, `addSkipNode`, `setCardStatus`, or `setScenarioStatus`. The runner UI at `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:261-272` offers `today` and `permanent`, so a user clicking "Skip permanently" expects the scenario/card to be suspended -- it isn't. The engine will keep surfacing the same scenario on the next session because nothing in the user's plan or content status actually changed. Users lose trust in the skip controls.
- **Trigger**: In an active session, click "Skip permanently" on a rep. Start another session. The same scenario reappears.
- **Fix**: In the `skip` action, after `recordItemResult`, for `topic` kind: look up the active plan and call `addSkipNode(plan.id, userId, slot.nodeId)` when `slot.nodeId` is set, else `addSkipDomain` using the card/scenario's domain. For `permanent` kind: do the `topic` mutation PLUS `setCardStatus(slot.cardId, userId, CARD_STATUSES.SUSPENDED)` or `setScenarioStatus(slot.scenarioId, userId, SCENARIO_STATUSES.SUSPENDED)`. Wrap the multi-step mutation in a single transaction so a partial failure doesn't leave the slot flagged `permanent` while the card is still `active`. Add a Playwright spec that starts a session, skips permanently, starts another session, and asserts the suspended item does not reappear.

### MAJOR: `recordItemResult` cannot clear nullable fields once set

- **File**: `libs/bc/study/src/sessions.ts:780-800`
- **Problem**: The update path uses `result.cardId ?? existing.cardId` (and same pattern for `scenarioId`, `nodeId`, `reviewId`, `skipKind`, `reasonDetail`, `chosenOption`, `isCorrect`, `confidence`, `answerMs`). With `??`, a caller explicitly passing `null` is indistinguishable from omitting the field -- the existing value is preserved. Two concrete failure modes: (1) `isCorrect: false` works because `false ?? existing` returns `false`, but `confidence: null` to remove confidence retains the old value; (2) a second-pass `recordItemResult` that legitimately needs to unset a field (e.g., slot fixup path) silently becomes a no-op. The idempotency comment promises "a second call updates the existing row", but the update is incomplete.
- **Trigger**: Re-submit a slot with `confidence: null` after an initial submit with `confidence: 3` -- the 3 persists.
- **Fix**: Distinguish "field omitted" from "field set to null" in `ItemResultInput`. Either use `undefined` for omitted + `null` for clear (then `result.field === undefined ? existing.field : result.field`), or split the interface into two shapes (`PartialItemResultPatch` vs `FullItemResult`). The current shape is already declared with `field?: T | null`, so switching to `result.field === undefined ? existing.field : result.field` is a mechanical change at the callsite.

### MAJOR: `getStreakDays` silently 0's out a legitimate streak when the user studied yesterday but not yet today

- **File**: `libs/bc/study/src/sessions.ts:887-900`
- **Problem**: The streak loop starts with `cursor = todayKey` and walks days desc. If the user studied yesterday and before but not today yet (common at any time between midnight and the first session), the first row tested is `d === yesterday_key` vs `cursor === today_key` -- the `if d === cursor` branch fails, `d < cursor` triggers `break`, and the function returns 0. Yesterday's streak was 7; after midnight it flips to 0 instead of the usual "still 7, extend to 8 with today's session". This is inconsistent with `dashboard.ts getRecentActivity`'s streak (also starts at today) but is surfaced on the session summary prominently. A learner seeing "Streak: 0" after walking away from yesterday's session at 11pm and returning at 9am the next day is misleading.
- **Trigger**: Complete any session, walk away past midnight, open the same session summary. Streak reads 0 despite activity the prior day.
- **Fix**: Either allow a 1-day grace ("streak continues through today if yesterday had activity"), or document the strict semantics and live with it but also patch `dashboard.ts:246-258` to the same rule so both surfaces tell the same story. The grace approach: initialize `cursor = todayKey`, and if the first iteration doesn't match today but matches yesterday, advance cursor to yesterday first without decrementing `streak`. Mirror this in `dashboard.ts:extendedStreak` and `stats.ts:computeStreakDays`.

### MAJOR: `recordItemResult` insert branch writes wrong `presentedAt` when the pre-inserted slot is missing

- **File**: `libs/bc/study/src/sessions.ts:802-826`
- **Problem**: The insert branch (no existing row for the slotIndex) sets `presentedAt: now, completedAt: now`. `commitSession` is supposed to insert every slot at session creation, so this branch is defensive cleanup. But if it ever fires (e.g., partial commit failure, slot deleted out-of-band), the slot claims "presented 0ms before completed" which corrupts any latency-derived metric. Worse, the BC would now accept an item result for a slot whose `itemKind`/`slice`/`reasonCode` never came from the engine -- the caller supplies them from whatever formData claims.
- **Trigger**: Manually delete a row from `session_item_result`, submit that slot. Or a commit-tx partial failure.
- **Fix**: Remove the insert branch entirely. If there's no pre-existing slot row for `(sessionId, slotIndex)`, throw `SessionNotFoundError` or a new `SessionSlotNotFoundError`. The BC contract should be: slots are created by `commitSession`, results are written to existing rows only. Route code already validates the slot via `loadSlot` which throws 404 when the slot index is missing, so the insert branch is unreachable in practice.

### MAJOR: Redistribute comment wrong; deduplication uses SLICE_PRIORITY not score

- **File**: `libs/bc/study/src/engine.ts:585-609`
- **Problem**: The comment "an item may appear in multiple pools; keep the highest-scoring slice" claims score-based dedup, but the code's `takeFromSlice` iterates slices in `SLICE_PRIORITY` order and greedily claims items via `seen`. A high-scoring diversify candidate duplicated in a low-scoring continue pool will go to continue (lower priority position) simply because the loop visits continue first. Whether this is right depends on intent. If the spec wants priority-based (current behavior), the comment lies; if it wants score-based (as written), the behavior is wrong.
- **Trigger**: An engine run where the same card scores 0.95 in diversify and 0.1 in continue places it in continue, not diversify.
- **Fix**: Decide which semantic is correct. If priority is the intent, update the comment. If score is the intent, collect all scored candidates across pools first, sort globally by (score desc, SLICE_PRIORITY asc), then greedily fill slots per `allocation[slice]` skipping over already-claimed items.

### MAJOR: `fetchCardCandidates` pulls the whole review history to compute "last rating per card"

- **File**: `libs/bc/study/src/sessions.ts:204-217`
- **Problem**: The comment says "Drizzle doesn't expose DISTINCT ON, but a correlated max-reviewedAt inner join is equivalent". The actual code pulls every single review row for the user (`db.select().from(review).where(eq(review.userId, userId)).orderBy(desc(review.reviewedAt))`), sorts by reviewedAt desc in JS, and keeps the first per card. For a user with thousands of historical reviews this is linear-in-history-per-session-preview. Not a correctness bug today (airboss is pre-alpha, single user), but any metric on this BC at scale will show it immediately, and it's directly at odds with the code comment which claims equivalence to `DISTINCT ON`.
- **Trigger**: Any user with >1000 historical reviews runs `previewSession` (every session start).
- **Fix**: Either use a real DISTINCT ON via drizzle's `sql` fragment: `SELECT DISTINCT ON (card_id) card_id, rating FROM review WHERE user_id = ... ORDER BY card_id, reviewed_at DESC`; or denormalize `lastRating` onto `card_state` (card_state already carries `lastReviewId` and `lastReviewedAt`, so adding `lastRating` fits the existing pattern). The denormalization path also avoids the round-trip on every preview.

### MINOR: `getRepAccuracy` and `getDomainAccuracy` assume `isCorrect NOT NULL` but schema allows NULL

- **File**: `libs/bc/study/src/scenarios.ts:428` and `libs/bc/study/src/scenarios.ts:463`
- **Problem**: Both use `count(*) filter (where isCorrect)`. A rep slot with `completedAt IS NOT NULL` and `skipKind IS NULL` but `isCorrect IS NULL` (DB corruption, partially-migrated row, future insert path that forgets to populate) counts as attempted but not correct, silently deflating accuracy. The WHERE clause filters completed + non-skipped, but doesn't require `isCorrect IS NOT NULL`.
- **Trigger**: A DB row with `skipKind=NULL, completedAt=NOT NULL, isCorrect=NULL` created by any path that bypasses `recordItemResult`.
- **Fix**: Either add `isNotNull(sessionItemResult.isCorrect)` to the clauses, or add a schema CHECK `(item_kind != 'rep' OR skip_kind IS NOT NULL OR is_correct IS NOT NULL OR completed_at IS NULL)` enforcing the "completed rep has isCorrect" invariant. The CHECK is stronger.

### MINOR: `skippedByKind` can go NaN on a schema-unexpected skipKind

- **File**: `libs/bc/study/src/sessions.ts:920-923`
- **Problem**: `skippedByKind[r.skipKind as SessionSkipKind] += 1`. If `r.skipKind` is a string that isn't in `{today, topic, permanent}` (future migration lag, old row), the lookup returns `undefined`, then `undefined + 1 === NaN`. The initial dict pre-populates all three known values, so this only triggers for unknown kinds -- but the schema CHECK `sir_skip_kind_check` is the only guard and it's a runtime constraint that can be dropped/altered.
- **Trigger**: A row with `skip_kind = 'session'` or any hypothetical future kind before the labels dict is updated.
- **Fix**: Guard with a membership check: `if (r.skipKind && (SESSION_SKIP_KIND_VALUES as readonly string[]).includes(r.skipKind)) skippedByKind[r.skipKind as SessionSkipKind] += 1`. Skip the row otherwise (or emit an audit log).

### MINOR: `getCalibration` pulls reviews + rep slots into memory then filters in JS

- **File**: `libs/bc/study/src/calibration.ts:113-161`
- **Problem**: The docstring calls this out as intentional ("Drizzle's unionAll doesn't compose cleanly..."), but the full-user-history pull means calibration trends degrade linearly in history size, and the filter-by-domain path does a second O(N) pass over the points. For a user with 10k+ confidence-rated reviews, the per-page load cost compounds when the dashboard calls `getCalibration` alongside `getCalibrationTrend`.
- **Trigger**: Multi-year usage by a single learner.
- **Fix**: Push the domain filter into the SQL. `loadPoints` can accept a `domain?: Domain` and inject `eq(card.domain, domain)` / `eq(scenario.domain, domain)` into each leg, which lets the per-domain matrix on the dashboard avoid the re-bucket entirely. The union-all concern is a structural Drizzle quirk but not relevant to point filtering at query time.

### MINOR: Confidence prompt rate inconsistency between memory review and session runner

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:136-156,185-200` vs `apps/study/src/routes/(app)/memory/review/+page.server.ts:26-37`
- **Problem**: The memory/review flow samples `shouldPromptConfidence` on 50% of cards via `CONFIDENCE_SAMPLE_RATE`. The session runner prompts confidence on 100% of cards and 100% of reps with no sampling. Both routes feed the same calibration BC, so bucket populations are biased toward whichever flow the user uses more. The calibration "needs more data" threshold could appear unexpectedly slow on users who only use `/memory/review`.
- **Trigger**: Run 40 sessions (high data) vs 40 memory reviews (20 prompts). Calibration buckets disagree on progress.
- **Fix**: Either apply `shouldPromptConfidence` in the session runner's phase transition, or remove sampling from memory/review and prompt every card there too. The second path is simpler and better supports calibration trend analysis.

### MINOR: `fetchCardCandidates` `scheduledMs` floor of 1 day skews Continue-slice scoring for short-interval cards

- **File**: `libs/bc/study/src/sessions.ts:226-229`
- **Problem**: `scheduledMs = Math.max(dueAt - lastRef, 24h)`. For a card in `learning` state with a ~15-minute scheduled interval, the real scheduled interval is 0.01 day but the formula uses 1 day. `overdueRatio = overdueMs / scheduledMs` then under-reports overdue-ness for learning cards. The 1-day floor was added to avoid divide-by-zero for unreviewed cards (correct), but the condition should be "only when lastReviewedAt is null", not always.
- **Trigger**: A learning-state card scheduled 15 minutes out, already 3 hours overdue -- `overdueRatio` comes out as 0.125 instead of 12.
- **Fix**: `const scheduledMs = lastRef === dueAt.getTime() ? 24*60*60*1000 : Math.max(1, dueAt.getTime() - lastRef);`. Only clamp when there is no prior review.

### MINOR: `completeSession` race -- two concurrent calls can both update

- **File**: `libs/bc/study/src/sessions.ts:830-845`
- **Problem**: The function reads `sess.completedAt`, and if NULL proceeds to update. Two simultaneous `finish` actions (user double-taps "Finish early") both see NULL, both issue UPDATE, the second overwrites the first's `completedAt`. Not a data-loss bug (the completion time differs by milliseconds at most), but the returned rows differ and any subsequent logic keyed on `completedAt === now` from the caller's snapshot could disagree. Also, `idempotent` in the comment is aspirational not actual.
- **Trigger**: User double-clicks "Finish early".
- **Fix**: Make the UPDATE conditionally match `completedAt IS NULL`: `.where(and(eq(session.id, sessionId), eq(session.userId, userId), isNull(session.completedAt)))`. If the UPDATE returns no rows, re-select to return the existing completed row. Truly idempotent.

### NIT: `generateRepAttemptId` is unused but still exported

- **File**: `libs/utils/src/ids.ts:19`
- **Problem**: ADR 012 deleted the `rep_attempt` table. `generateRepAttemptId` survives as a dangling export that future code could import and use -- recreating the split-audit-trail problem this ADR exists to solve.
- **Trigger**: Autocomplete suggestion, copy-paste from another file, or a sincere misunderstanding.
- **Fix**: Delete the function. If any call sites exist (shouldn't), migrate them to `generateSessionItemResultId`.

### NIT: `SESSION_SKIP_KIND_LABELS` keys are declarative but `SESSION_SKIP_KINDS.TOPIC` label is never used

- **File**: `libs/constants/src/study.ts:638-642` and `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:261-272`
- **Problem**: The runner UI only offers `today` and `permanent`; `topic` is defined, labeled, and schema-CHECKed but has no UI path. Either it's vestigial from an earlier spec (dead code) or there's a missing UI. The separate skip-kind exists, survives SQL checks, and shows up in `skippedByKind` counts on the summary -- but no user-facing flow produces it.
- **Trigger**: Dev looking for "where does `topic` skip come from?" finds no writer.
- **Fix**: Add the `topic` skip control to the runner (paired with the permanent-skip backend fix above -- `topic` would mutate skip_domains/skip_nodes), or remove `topic` from `SESSION_SKIP_KINDS`, the schema CHECK, the labels, and `skippedByKind` init.
