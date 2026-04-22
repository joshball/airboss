---
feature: full-codebase
category: perf
date: 2026-04-22
branch: main
issues_found: 11
critical: 2
major: 4
minor: 4
nit: 1
---

## Summary

Overall the codebase is in a healthy place: ADR 012's new `sir_user_kind_completed_idx` and `sir_scenario_completed_idx` cover the aggregator hot paths, Drizzle queries specify columns (not `select *` everywhere), pagination uses the correct limit+1 pattern, and the dashboard fans panels out through `Promise.allSettled`. The major weaknesses are two classic N+1 fans (knowledge browse calls `getNodeMastery` per visible node; session-engine prereq walk calls `isNodeMastered` per prerequisite), plus an unbounded `review` scan in `fetchCardCandidates` that grows with a user's full review history. Several supporting queries lack a driving index -- in particular `card_state.stability` / `card.node_id` filters run over sequential scans once data scales past single-digit thousands of rows.

## Issues

### CRITICAL: `/knowledge` browse page fires 3N queries per node via `getNodeMastery`

- **File**: `apps/study/src/routes/(app)/knowledge/+page.server.ts:36-51`
- **Problem**: The loader calls `listNodesForBrowse` (one query, returns up to all nodes) and then maps over every returned row calling `getNodeMastery(user.id, row.id)` in a `Promise.all`. Each `getNodeMastery` call (libs/bc/study/src/knowledge.ts:503-548) issues three independent DB round-trips (card totals join, rep totals join, scenarios-attached count). A batched `getNodeMasteryMap` already exists in the same file at line 683 and is used by `getCertProgress` / `getDomainCertMatrix`.
- **Impact**: At the documented v1 target of ~30 authored nodes this is 3 x 30 = 90 DB round-trips per page load. The inline comment even acknowledges: "If the node count balloons well past the v1 target, swap for a single aggregate query keyed by user." The batched implementation already exists; not using it is a self-inflicted N+1. The graph is actively growing.
- **Fix**: Replace the per-row `await Promise.all(rows.map(async (row) => await getNodeMastery(...)))` with a single call to `getNodeMasteryMap(user.id, rows.map(r => r.id))` and look up per-row snapshots from the returned `Map`. Compute `displayScore` from the snapshot's card/rep ratios (or extend `NodeMasterySnapshot` to include it). Three round-trips regardless of node count.

### CRITICAL: Session-engine prereq walk calls `isNodeMastered` per prerequisite target

- **File**: `libs/bc/study/src/sessions.ts:371-383`
- **Problem**: `fetchNodeCandidates` collects the union of `requires` edge targets across every candidate node (`prereqTargets` set) and then runs `Promise.all(Array.from(prereqTargets).map(async (id) => masteryByNode.set(id, await isNodeMastered(...))))`. Each `isNodeMastered` -> `getNodeMastery` call = 3 DB round-trips.
- **Impact**: Every session preview (every `/session/start` load, every Shuffle) pays this tax. On the current 30-node graph with typical prereq density that's already 30-60 round-trips just for the mastery gate. This compounds with every other pool query the engine does, and runs on the user's blocking path to start a session.
- **Fix**: Use the existing batched `getNodeMasteryMap(userId, Array.from(prereqTargets), db)` from `knowledge.ts:683`. Three round-trips instead of 3 x |prereqTargets|. Add `now` support to the map function (currently `getNodeMasteryMap` doesn't take `now`, but the only time-dependent input is `cardState.dueAt <= now` in `cardsDue`, which that function doesn't even compute -- safe to add).

### MAJOR: `fetchCardCandidates` scans the entire review history for every session

- **File**: `libs/bc/study/src/sessions.ts:205-213`
- **Problem**: To derive "last rating per card" the code loads every row in `review` for the user, ordered by `reviewedAt DESC`, and walks client-side keeping the first rating seen per cardId. For a user who's been reviewing daily this grows without bound -- thousands of rows transferred per session preview just to extract `N = activeCards` data points.
- **Impact**: The `review_user_reviewed_idx` bounds the scan to the user's rows but does not bound the row count. A user with 10k reviews pays 10k rows of network/parse overhead per session preview, every time. `card_state.last_review_id` already points at the most recent review for each card -- the data is already indexed by the materialized projection.
- **Fix**: Join `cardState -> review` via `cardState.lastReviewId = review.id` in the same query that fetches the card rows. One round-trip, O(activeCards) data transfer, and the join uses the `cardState` PK and the `review` PK (both single-row lookups).

### MAJOR: `getCalibration` and `getCalibrationTrend` each call `loadPoints` separately

- **File**: `apps/study/src/routes/(app)/calibration/+page.server.ts:13-17` + `libs/bc/study/src/calibration.ts:113-185, 310-335`
- **Problem**: The `/calibration` loader fires `getCalibrationPointCount`, `getCalibration`, and `getCalibrationTrend` in parallel. `getCalibration` calls `loadPoints(userId, undefined, db)` -- the full unfiltered review+rep join. `getCalibrationTrend` calls `loadPoints(userId, { start: windowStart, end: endOfToday }, db)` -- a windowed subset of the same data. Two separate round-trips to the same two tables, largely overlapping data.
- **Impact**: Two full user-scoped review joins + two full rep joins per calibration page load. Redundant network/CPU; also redundant database query planning. At moderate scale (a couple hundred reviews + reps) this is wasted work; it grows linearly with history.
- **Fix**: Load points once over the union of (full history) and let the trend compute in-memory (the trend loop already filters `points.filter((p) => p.occurredAt <= dayEnd)` so it can slice the same array). Or, keep the split but have `getCalibration` accept pre-loaded points and have the route load them once. Also consider dropping the separate `getCalibrationPointCount` call -- once `loadPoints` has run, `.length` is the count.

### MAJOR: `card_state` filters on `stability` have no supporting index

- **File**: `libs/bc/study/src/schema.ts:255-259` (index definitions) + `libs/bc/study/src/stats.ts:159, 325` + `libs/bc/study/src/knowledge.ts:516, 698`
- **Problem**: Multiple aggregate queries filter or case-sum on `cardState.stability > MASTERY_STABILITY_DAYS` (used in `getDomainBreakdown`, `getMasteredCount`, `getNodeMastery`, `getNodeMasteryMap`, `getCardMastery`). The only `card_state` index is `(userId, dueAt)`. `stability` is not indexed.
- **Impact**: Today the `(userId, dueAt)` index returns a manageable row set and the stability case-sum is applied in-row -- fine at MVP scale. But `getMasteredCount` has `where (userId, status=active, stability > threshold)` with no index that supports stability lookup; at thousands of cards per user it becomes a scan over all active card-state rows. Not catastrophic but worth knowing before the library grows.
- **Fix**: Either add a partial index `cardStateUserMasteredIdx` on `(userId) WHERE stability > MASTERY_STABILITY_DAYS` (most efficient for the mastered-count path) or a composite `(userId, stability)` that supports range queries. The partial-index variant is cheaper to maintain. Revisit when real user data shows the stats queries slowing down.

### MAJOR: `getRepBacklog` scans every active scenario x every rep result with a GROUP BY

- **File**: `libs/bc/study/src/dashboard.ts:123-142`
- **Problem**: The query does a left join of `scenario` against `session_item_result` filtered on `scenarioId = scenario.id`, `itemKind='rep'`, `completedAt IS NOT NULL`, `skipKind IS NULL`, then groups by `(domain, scenario.id)` to get attempt counts per scenario. The join key uses `scenarioUserNodeIdx` (user+nodeId) or `scenarioUserStatusIdx` on the outer side, and `sir_scenario_completed_idx` on the join side. But `sir_scenario_completed_idx` is `(scenarioId, completedAt)`, which supports the join predicate -- so the plan is O(activeScenarios) index probes, O(attempts) total rows read.
- **Impact**: Each active scenario with attempts contributes its attempt rows to the aggregation. For a user with 200 scenarios and 50 attempts each that's 10k rows aggregated per dashboard load. Not critical today, and the query shape is correct for the "show attempts per domain" output, but the panel only uses `(unattempted count, total attempts per domain)` -- the per-scenario aggregate is thrown away. Grouping by `scenario.id` forces materialization of one row per scenario.
- **Fix**: If the UI only needs `unattempted count` and `total attempts per domain`, rewrite as two cheaper aggregates: (1) `count(*) FILTER (WHERE ...) AS totalActive`, `count(*) FILTER (WHERE NOT EXISTS(attempt)) AS unattempted`, `domain`, grouped by `domain` only; (2) `count(*)` on session_item_result filtered to rep + not skipped, joined to scenario for domain, grouped by `domain`. Avoid the per-scenario materialization.

### MINOR: `getStreakDays` scans all non-skipped session_item_result rows without a range limit

- **File**: `libs/bc/study/src/sessions.ts:851-901`
- **Problem**: The distinct-day query has no `completedAt >= lookbackStart` bound; it pulls every `(user, completedAt IS NOT NULL, skipKind IS NULL)` row and sorts the result. The `sir_user_completed_idx` (userId, completedAt) supports this, but the row count is unbounded in user history.
- **Impact**: For a user active over a year the sort/distinct runs over all their rep+card slots. Streak can only span a finite window; loading the full history wastes I/O.
- **Fix**: Add a `gte(completedAt, now - 366 days)` clause the way `extendedStreak` in dashboard.ts does (line 275). The streak can't exceed the lookback window anyway.

### MINOR: Session runner `loadSlot` re-fetches every slot row per action

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:143-157` + used in every action (submitReview, submitRep, completeNode, skip)
- **Problem**: `loadSlot` calls `getSessionItemResults(sessionId, userId)` -- full ordered list of every slot row -- then `.find()` the one with matching slotIndex. Every action submission does this.
- **Impact**: Each submit loads all ~12 slot rows instead of one. Small at session length, but wasteful and unnecessary; the per-slot path already has `sir_session_slot_idx` (sessionId, slotIndex) which supports direct lookup.
- **Fix**: Add a BC helper `getSessionItemResult(sessionId, userId, slotIndex)` that queries the single row via `WHERE sessionId = ? AND userId = ? AND slotIndex = ?` (index-backed single-row fetch). Call that from `loadSlot`.

### MINOR: `memory/browse` search uses `ILIKE '%pattern%'` without a trigram/GIN index

- **File**: `libs/bc/study/src/cards.ts:285-289` + schema has no GIN/trigram index on `card.front` / `card.back`
- **Problem**: `ilike(card.front, '%pattern%')` with a leading wildcard cannot use any B-tree index. Today the scan is bounded by the user-status index (`card_user_status_idx`) so it's "user's cards" not "all cards", but the per-user scan is linear in `card_count`.
- **Impact**: A user with 2k+ cards pays a scan on every search keystroke from the browse page. Noticeable as the library grows.
- **Fix**: Option A, add `pg_trgm` extension + GIN index on `card.front` and `card.back` -- supports `%pattern%` via trigram lookup. Option B, defer until real usage reports slow search. Worth adding to the known-issues log so it isn't rediscovered in a year.

### MINOR: `getDashboardPayload` recomputes node mastery across two cert-graph panels

- **File**: `libs/bc/study/src/knowledge.ts:788-827 (getCertProgress)` + `855-908 (getDomainCertMatrix)`
- **Problem**: Both panels read every knowledge_node row, bucket them into cert/domain sets, and then each calls `getNodeMasteryMap(userId, allNodeIds, db)`. The dashboard fans these two functions in parallel via `Promise.allSettled` (dashboard.ts:501-502). Two parallel calls means two independent passes over the same card/rep mastery joins for effectively the same node set.
- **Impact**: Double the mastery aggregation work on every dashboard load. With 30 nodes it's negligible; the point is it stays 2x as the graph scales.
- **Fix**: Compute the mastery map once per dashboard load. Extract a shared `getCertAndDomainMatrix(userId)` that queries `knowledge_node` once, calls `getNodeMasteryMap` once, then folds both the cert summary and the domain matrix from the single snapshot. Return both. Update the two dashboard fetchers to use the combined entry. (Keep the individual exports for other callers.)

### NIT: `NOT EXISTS` subquery in `getRepDashboard.unattemptedCount` could share scan with sibling query

- **File**: `libs/bc/study/src/scenarios.ts:565-582`
- **Problem**: The dashboard fires `scenarioCount` (group over active scenarios), `scenariosByDomain` (same scan, grouped by domain), and `unattemptedCount` (scan with NOT EXISTS correlated subquery) -- three independent queries over `scenario` + the rep-index for NOT EXISTS. The first two scan the same rows.
- **Impact**: Two near-identical scenario scans. Rounding error today.
- **Fix**: Collapse into one query that returns `{ total, unattempted, domain }` per-domain: `SELECT domain, count(*) AS total, count(*) FILTER (WHERE NOT EXISTS(...)) AS unattempted FROM scenario ... GROUP BY domain`. Aggregates in JS to get the two scalar totals.
