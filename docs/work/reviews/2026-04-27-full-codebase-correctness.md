---
feature: full-codebase-audit
category: correctness
date: 2026-04-27
branch: main
issues_found: 12
critical: 0
major: 4
minor: 6
nit: 2
---

## Summary

Full-codebase correctness sweep across `libs/bc/study`, `libs/auth`, `libs/sources`, `libs/utils`, and the SvelteKit route layer in `apps/study`. Overall the bounded-context code is in solid shape: typed errors, dual-gate auth, transactional skips, atomic UPSERTs, and bounded windows on streak/calibration scans. The findings below are predominantly defensive gaps (missing status filters, divergent helper semantics, leaky filtering of empty inputs) rather than active data-corruption bugs. No critical issues found.

## Issues

### MAJOR: `getReplacementCard` does not filter by card status

- **File**: `libs/bc/study/src/snooze.ts:357-401`
- **Problem**: Both replacement legs (`dueRows` and `newRows`) join `card` + `card_state` by user and domain but never restrict to `card.status = 'active'`. A card that was archived or suspended -- including by the same user via `permanent` skip in a session -- can be returned as the replacement when its `card_state.state` is `'new'` or its `due_at <= now`. The active-snoozes exclude set only catches the `snooze` lifecycle, not the `card.status` lifecycle.
- **Trigger**: User A suspends card X (e.g. via PERMANENT skip in a session). Later, in a memory-review session, user A presses Remove on card Y in the same domain as X. `getReplacementCard` may pick X as the replacement.
- **Fix**: Add `eq(card.status, CARD_STATUSES.ACTIVE)` to both `where(and(...))` clauses, and add a small `.limit(...)` (e.g. `REVIEW_BATCH_SIZE`) to both queries so the helper doesn't load every same-domain card just to drop most of them in the JS exclude filter.

### MAJOR: `loadSlot` returns slot fields without verifying the slot belongs to the current user's session

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:149-165`
- **Problem**: `loadSlot` calls `getSessionItemResult(sessionId, userId, slotIndex)` -- which itself filters by `userId` -- but the `requireOpenSession` guard above only checks the session row, not the slot. If a future caller passes a slotIndex from a stale form for a session that no longer matches (e.g. a tab opened before logout and reopened in a different account), `getSessionItemResult` will return `null` and the route correctly 404s. So the current path is safe today, but the action handlers (`submitReview`, `submitRep`, `skip`, `completeNode`) read `slot.cardId` / `slot.scenarioId` / `slot.nodeId` straight off the slot row without re-validating that those refs belong to the caller. A bug elsewhere that smuggled foreign refs onto a slot would cascade.
- **Trigger**: Defense-in-depth: today only `commitSession` writes slot rows and it stamps userId from the session row. But the BC contract is "BC re-verifies ownership inside" (per common-pitfalls.md, "Accept planId / sessionId / cardId from form data and trust it -- BC re-verifies"). Slot-attached cardIds and scenarioIds slip past that check because the route reads them without a follow-up `getCard(cardId, userId)` / `getScenario(scenarioId, userId)`.
- **Fix**: When the action handler is about to act on `slot.cardId` / `slot.scenarioId`, do a one-row ownership check (these calls already exist in `submitReview` / `submitRep` via their underlying BC functions, which do verify). The skip handler is the gap -- it passes `slot.cardId` / `slot.scenarioId` straight into `setCardStatus` / `setScenarioStatus` inside the `skipSessionSlot` transaction. Both of those functions DO scope by userId, so the smuggled-id case fails at the WHERE clause and throws ScenarioNotFoundError. So this is closed by the scoping in `setCardStatus` / `setScenarioStatus`. Recommend an explicit assertion in `skipSessionSlot`: at the top of the transaction, call `getCard(slot.cardId, userId)` / `getScenario(slot.scenarioId, userId)` when the kind matches, and treat a null return as an integrity error rather than silently no-oping the suspend leg.

### MAJOR: `getCalibrationPageData` trend is windowed, not cumulative; `getCalibrationTrend` is cumulative

- **File**: `libs/bc/study/src/calibration.ts:340-355` (cumulative) vs `libs/bc/study/src/calibration.ts:434-446` (windowed)
- **Problem**: The two helpers diverge on the same documented contract. `getCalibrationTrend` filters `points.filter((p) => p.occurredAt <= dayEnd)` -- "every point up to and including this day," cumulative. `getCalibrationPageData` filters `points.filter((p) => p.occurredAt >= windowStart && p.occurredAt <= dayEnd)` -- only points inside the window. The doc-comment on `getCalibrationTrend` says "cumulative reading" and the spec/PRD calls for a cumulative score. The route loader uses `getCalibrationPageData`, so the page renders a different trend than `getCalibrationTrend` would (and a different trend than the doc says).
- **Trigger**: Any user with calibration history older than `CALIBRATION_TREND_WINDOW_DAYS`. The /calibration page underweights early-day scores because it only counts points inside the window for each day's bucket; the standalone helper would weight them by all history up to that day.
- **Fix**: Pick one. If cumulative is the intent (matches the docstring + common UX), drop the `>= windowStart` predicate in `getCalibrationPageData`. If windowed is the intent, update the docstring on `getCalibrationTrend` and consider whether the standalone helper is even needed.

### MAJOR: `/memory/review` load function performs writes (createSession + abandonStaleSessions)

- **File**: `apps/study/src/routes/(app)/memory/review/+page.server.ts:83-130`
- **Problem**: `load` calls `abandonStaleSessions(user.id)` and, on the no-`?deck` branch, `startReviewSession(...)`. SvelteKit prefetch on hover, link-preview, and certain tools (LinkedIn previews, virus scanners following the URL) all trigger a GET that walks the load function. This route silently creates a fresh `memory_review_session` row per prefetch, freezing a new card list; if the prefetch happens often the user accumulates ABANDONED rows and never sees them.
- **Trigger**: Hover the `/memory/review` link in the nav; prefetch fires; a session row is created. Repeat. Each one becomes an `abandonStaleSessions` candidate later but the freeze-the-deck cost was paid for nothing.
- **Fix**: Same shape as the standing common-pitfalls.md row "Never have a `+page.ts/+page.server.ts` `load` perform writes." The fix is to render an empty-state with a `<form action="?/start">` button (no GET-creates) or split this into a `+page.svelte` that posts to the action. The deck-decode + resume-prompt branch is fine -- it's just a read. The "no-`?deck` -> create" branch is the leaking path. Bonus: `abandonStaleSessions` is also a write; if you keep it in a load, scope it to the `?deck` branch where the user has demonstrated intent, or move it behind a POST.

### MINOR: `getCredentialMastery` undercounts area rollups for leaves under non-area ancestors

- **File**: `libs/bc/study/src/credentials.ts:380-418`
- **Problem**: `ancestorAreaId` walks parent pointers until it finds a node with `level === 'area'` or null. Leaves whose ancestors never include an `area`-level node are counted in the credential-wide totals (`totalLeaves`, `coveredLeaves`, `masteredLeaves`) but skipped from any `areaRollup` entry. `sum(area.totalLeaves) !== totalLeaves`. The credential dashboard's per-area pie can disagree with the headline total and the user has no way to tell.
- **Trigger**: Any syllabus tree where a leaf is hung directly off the root, or under a hierarchy that doesn't include an `area`-level node.
- **Fix**: Either guarantee every leaf has an `area` ancestor at validate-time (a syllabus-shape invariant; reject seed otherwise), or surface an "uncategorized" bucket in `areas` for ancestor-less leaves so the rollup remains additive. Prefer the first if the ACS / PTS / personal track shape always has area-level grouping.

### MINOR: `getCredentialMastery` counts unlinked leaves toward `totalLeaves` but they can never be mastered

- **File**: `libs/bc/study/src/credentials.ts:359-365`
- **Problem**: Leaves with zero `syllabus_node_link` rows get `{covered: false, mastered: false}` and are counted in `totalLeaves`. Mastery cannot reach 100% unless every leaf has at least one knowledge-node link. Authors leave-without-links during in-flight syllabus edits will see "8 of 10 mastered, no path to 10" with no indication why.
- **Trigger**: Any leaf in the primary syllabus that hasn't yet been linked to a `knowledge_node`.
- **Fix**: Either exclude unlinked leaves from `totalLeaves` (treat them as "not yet authored"), or expose a `unlinkedLeaves` count in the rollup so the UI can render "8 of 10 mastered (2 not yet authored)" and the headline doesn't lie.

### MINOR: `addSkipNode` validates the node exists globally but not against the user's eligibility

- **File**: `libs/bc/study/src/plans.ts:266-285`
- **Problem**: `getNodesByIds([nodeId])` confirms the node exists in the global graph. Any authenticated user can add any global node to their plan's `skip_nodes`. There's no integrity issue (node ids are globally meaningful and the engine treats unknown skip_nodes as no-ops), but a malicious or confused caller could enumerate the graph by trial-and-error against `addSkipNode`'s success/failure shape.
- **Trigger**: Defensive only -- no functional bug. Mentioned because the BC's own docstring says "guarding at the BC level keeps the form-action layer thin."
- **Fix**: Optional. If you want to gate by eligibility, intersect `getNodesByIds` with the user's plan cert filter (`certsCoveredBy(plan.certGoals)`). Otherwise leave a comment that any-graph-node-is-skippable is intentional.

### MINOR: `recordItemResult` accepts arbitrary `userId` mismatch on the review row guard

- **File**: `libs/bc/study/src/sessions.ts:848-855`
- **Problem**: When `result.reviewId` is non-null, the BC checks `review.userId === userId`. Good. But the rest of the slot fields (`cardId`, `scenarioId`, `nodeId`) are written without an ownership recheck. The session's `userId` is checked in `getSession`, so the slot's `session_id` is provably owned by `userId`, but a caller passing a `cardId` belonging to a different user wouldn't be caught here -- the FK check only verifies existence. The session_item_result.cardId is meant to mirror the engine-authored slot's cardId; nothing prevents an action from passing a different cardId.
- **Trigger**: Defense-in-depth. Today only the route layer calls this and it copies fields straight from `loadSlot`. A future caller could drift.
- **Fix**: Document the contract on `recordItemResult` more loudly (the cardId/scenarioId/nodeId fields MUST match the engine-authored slot), or add an assertion that the supplied `cardId` matches the existing row's `cardId` (since the slot row already exists from `commitSession`).

### MINOR: `parseLastAmended` accepts any string `Date` will parse, including ambiguous formats

- **File**: `libs/sources/src/regs/normalizer.ts:119-124`
- **Problem**: `new Date(rawDate)` accepts arbitrary input. ECMA-262 only mandates ISO 8601; everything else is implementation-defined. A two-digit year (`'01-02-90'`) parses inconsistently across runtimes; a malformed CFR amended-date attribute could be silently coerced into a wrong year.
- **Trigger**: A regs source XML blob with an unexpected `amendedDate` shape.
- **Fix**: Validate the input matches `^\d{4}-\d{2}-\d{2}$` (or the documented CFR format) before parsing. If it doesn't match, log + fall back to `publishedDate`. Same shape as the existing `Number.isNaN(parsed.getTime())` guard but tighter.

### MINOR: `createSeededRandom` uses 32-bit FNV hash + Math.imul; collisions exist on near-identical seeds

- **File**: `libs/bc/study/src/engine.ts:241-255`
- **Problem**: The seed-to-state hash is FNV-1a 32-bit. Two seed strings differing only in characters mod 2^32 produce the same starting state, so Shuffle will produce the same tiebreak ordering for those seeds. The seed is `"${userId}:${now.getTime()}"` so collisions are astronomically unlikely in practice -- but the comment "deterministic and reproducible for a given seed" is the contract, and a weakly-seeded PRNG can drift.
- **Trigger**: Correctness-adjacent. Deterministic engine output for any given seed is the documented behavior, and FNV-1a 32-bit doesn't violate it. The risk is "two different sessions briefly share a tiebreak ordering" which is invisible to the user.
- **Fix**: Optional. If determinism matters more than performance, swap to 64-bit hashing (FNV-1a 64 or `crypto.subtle.digest('SHA-1', ...)` truncated). Otherwise leave a comment that 32-bit collisions are accepted for the seed shape.

### NIT: `archivePlan` and `updatePlan` return `undefined as StudyPlanRow` when WHERE matches zero rows

- **File**: `libs/bc/study/src/plans.ts:178-218, 220-230`
- **Problem**: Both functions destructure `[updated]` from a `.returning()` and return `updated` without a null check. The preceding `getPlan` ownership check makes the no-row branch unreachable today, but the function signature claims a non-null `StudyPlanRow`. A concurrent delete (no concurrent-delete path exists today) would null this out and the caller would see a TS-typed object that is actually `undefined`.
- **Trigger**: Today none.
- **Fix**: Add the null check after the update for symmetry with `setScenarioStatus` and `restoreCard`.

### NIT: `submitAttempt` accepts a `db` param but doesn't use it

- **File**: `libs/bc/study/src/scenarios.ts:499-528`
- **Problem**: The signature declares `db: Db = defaultDb` but only the read of `scenario` actually uses it; the `parsed = submitAttemptSchema.parse(...)` line and the option-resolution are pure. The callsite in `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:302` doesn't pass a tx, so this is fine, but the function is marked "pure validator" in the docstring while still taking a db arg. The actual scenario read on line 507 does use `db`, so the parameter is actually live. Reread shows this is fine -- ignore.
- **Fix**: No change. Calling out so the next reviewer doesn't repeat the question.
