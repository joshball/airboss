---
feature: full-repo
category: perf
date: 2026-04-22
branch: main
issues_found: 18
critical: 0
major: 7
minor: 8
nit: 3
---

## Summary

The repo is in unusually good shape for a post-pivot codebase: every +page.server.ts already fans out independent queries via `Promise.all(Settled)`, every `{#each}` block is keyed, dashboard reads use a single batched mastery map instead of per-row mastery queries, and most listing endpoints already accept `limit`/`offset`. The biggest propagatable risks live in (1) calibration reads, which pull every confidence-tagged row a user has ever written in-memory and JS-bucket them, (2) several lists that are paginated in the app layer but whose underlying BC helpers don't accept a cap (`getPlans`, `getSessions`, `listNodesForBrowse`), and (3) the glossary/help universal `+page.ts` routes that ship the whole 164K reference table + BC registry to the client. None of these bite at current scale (~30 nodes, handfuls of reviews per user), but the patterns are the ones future pages will copy.

## Propagatable Patterns (top priority)

1. **Calibration does a full user-history scan on every dashboard + calibration page load.** `libs/bc/study/src/calibration.ts:117` (`loadPoints`) issues two unbounded `SELECT ... FROM review` / `FROM session_item_result` queries, unions them in JS, and re-buckets in JS on every call. `getCalibrationTrend` then re-runs the bucket loop 30x. This is a reference pattern new code will copy for "give me all my historical X." Push the aggregation into SQL (`GROUP BY confidence`) and cap the window.
2. **List helpers in `libs/bc/study/*` don't take a limit.** `getPlans` (plans.ts:177), `getSessions` (sessions.ts:728, default 20 but callable unbounded), `listNodesForBrowse` (knowledge.ts:446 -- fetches every node's `contentMd` just to derive lifecycle), `listNodeSummaries` (knowledge.ts:268). When a future session-history page copies `getSessions` without passing a limit, that query starts returning every session the user ever had.
3. **Universal `+page.ts` loads ship entire reference libraries to the client.** `/glossary` and `/help` use `+page.ts` (not `+page.server.ts`), so `@ab/aviation` (4095-line `references/aviation.ts`, 164K source, plus registry code and tag indexes) and `@ab/help` (search-core, registry, registration side effects) end up in the client bundle. Future read-only listing pages will copy this pattern and drag more content along.
4. **Fat barrel exports make tree-shaking load-bearing.** `@ab/bc-sim/index.ts:3-19` re-exports the whole FDM engine + physics module alongside `listScenarios`. The scenarios-listing `+page.ts` only needs `listScenarios`, but a barrel re-export through `@ab/bc-sim` means Vite can only drop the FDM if every transitive import is side-effect-free. New sim surfaces will copy the import shape without thinking about bundle impact.
5. **`listNodesForBrowse` pulls every node's full markdown body to derive `lifecycle` in JS.** `libs/bc/study/src/knowledge.ts:446`. `lifecycle` is already a stored column on `knowledge_node` (schema.ts:162); the BC is re-deriving it from `contentMd`. Every `/knowledge` page load drags every node's body over the wire. This shape ("select * when only a column subset is needed") is the one future list pages will copy.

## Issues

### MAJOR: Calibration reads unbounded user history on every page load

- **File**: `libs/bc/study/src/calibration.ts:117-192` (`loadPoints`), callers at `apps/study/src/routes/(app)/calibration/+page.server.ts:13-17` and `libs/bc/study/src/dashboard.ts:513`.
- **Problem**: `loadPoints` issues two `SELECT` queries with no `LIMIT` and no rolling window. Both return a row per confidence-tagged review / rep attempt the user has ever made. The dashboard panel (`getCalibration`) and `/calibration` both call this, with no cache. Bucketing then happens in a JS loop over the full set. `getCalibrationTrend` then re-runs `bucket()` 30 times inside JS.
- **Impact**: At 10 reviews/day over a year, that's ~3.6k rows per user per page load, transferred from Postgres and heap-allocated twice (review + rep unions). At 2 years, 7k+ rows per page load. Dashboard fires this alongside 7 other panel queries, so the slowest-query budget pins on calibration's network + decode cost.
- **Fix**: Move bucketing to SQL (`SELECT confidence, count(*) FILTER (WHERE rating > 1), count(*) FROM review WHERE userId = ... GROUP BY confidence`), combine via `UNION ALL` on (confidence, isCorrect) pairs, and cap with a default 90-day or 365-day window. For the trend, compute per-day buckets server-side via `date_trunc` rather than filtering 30 in-JS.

### MAJOR: `listNodesForBrowse` selects full `contentMd` just to compute lifecycle

- **File**: `libs/bc/study/src/knowledge.ts:446-485`.
- **Problem**: Queries `select({ ..., contentMd: knowledgeNode.contentMd, ... })` for every node, then calls `lifecycleFromContent(row.contentMd ?? '')` per row. `lifecycle` is an indexed stored column on `knowledge_node` (`schema.ts:162, 168`) maintained by the build script.
- **Impact**: 30 nodes today with ~8-30KB of markdown each = ~500KB-1MB shipped from DB to BC per `/knowledge` load, then decoded, then filtered in JS. Bypasses the `knowledge_node_lifecycle_idx`. Per-page wire bloat that scales linearly with knowledge graph growth (target ~500 nodes).
- **Fix**: Select `knowledgeNode.lifecycle` instead of `contentMd`, push the lifecycle filter into the WHERE clause (`if (filters.lifecycle) clauses.push(eq(knowledgeNode.lifecycle, filters.lifecycle))`), and drop the in-JS `lifecycleFromContent` call. Do the same for domain/cert/priority filters where possible (cert + priority filter would need a `relevance @> jsonb` predicate).

### MAJOR: `getPlans` has no limit, callable from plans index

- **File**: `libs/bc/study/src/plans.ts:177-179`, caller `apps/study/src/routes/(app)/plans/+page.server.ts:7`.
- **Problem**: `getPlans` does `select().from(studyPlan).where(eq(studyPlan.userId, userId)).orderBy(desc(studyPlan.createdAt))` with no limit. The route then filters to archived in JS.
- **Impact**: Each preset-start redirects archive the previous active plan (`session/start/+page.server.ts:129`). A motivated user can accumulate dozens of archived plans in a week; full selects include every plan's JSONB config (certGoals + focusDomains + skipDomains + skipNodes). Linear growth, unbounded.
- **Fix**: Add `limit`/`offset` params (default 50) and an optional status filter so the route can fetch active + N most recent archived directly. Update the plans index page to paginate or cap.

### MAJOR: Glossary `+page.ts` is universal -- ships reference library to client

- **File**: `apps/study/src/routes/(app)/glossary/+page.ts:1-15`, `.../glossary/[id]/+page.ts:1-19`, `libs/aviation/src/references/aviation.ts` (4095 lines, 164KB source).
- **Problem**: `+page.ts` (not `+page.server.ts`) runs on both server and client. `listReferences()` / `search()` / `axisCounts()` imports `@ab/aviation`, which has side-effectful `registerReferences(AVIATION_REFERENCES)` at module load. The whole 164KB table plus registry code lands in the browser bundle.
- **Impact**: Every new user lands on the study app with ~164KB+ of glossary data they haven't asked for (it gets code-split per route but is still downloaded on navigation to `/glossary`). Target audience is pilots on mobile in the field; the pattern also normalizes "shove reference data into the client" for future help/tutorial/course-content surfaces.
- **Fix**: Rename to `+page.server.ts`. Only the filtered/paginated slice crosses the wire. Same treatment for `/help` (`apps/study/src/routes/(app)/help/+page.ts`).

### MAJOR: `recordItemResult` re-fetches the session on every slot submit

- **File**: `libs/bc/study/src/sessions.ts:787-855`.
- **Problem**: `getSession(sessionId, userId)` runs at line 794 on every `recordItemResult` call, then the UPSERT runs separately. In the session runner, every submit action calls this. Session runner actions (`submitReview`, `submitRep`, `skip`, `completeNode`) all call `requireOpenSession` (which also calls `getSession`) AND then `recordItemResult`. So each submit does 2 `getSession` round-trips plus `loadSlot` (which re-fetches all session items).
- **Impact**: Per-submit round-trip overhead; in a 10-item session that's 30-40 DB round-trips just for orchestration. Latency-sensitive path.
- **Fix**: Thread a single already-loaded `SessionRow` through the call chain. `requireOpenSession` returns `SessionRowLike`; pass it into `recordItemResult` so it can skip its own `getSession`. Or gate on a single `SELECT 1 FROM session WHERE ... completedAt IS NULL FOR UPDATE` at the start of each action.

### MAJOR: Session runner `loadSlot` refetches all item results per action

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:154-168`.
- **Problem**: `loadSlot` does `getSessionItemResults(sessionId, userId)` -- full select of every slot -- then finds one slot by index. Every submit/skip action calls `loadSlot` once, sometimes twice (skip action calls `resolveSlotDomain` which may then call `getCard`/`getScenario`).
- **Impact**: For a 10-item session, each submit fetches 10 rows just to find 1. Not catastrophic but the BC already has `UNIQUE(session_id, slot_index)` backing `recordItemResult`'s UPSERT; a direct `SELECT * FROM session_item_result WHERE session_id = ? AND slot_index = ? AND user_id = ?` would be a single-row indexed lookup.
- **Fix**: Add `getSessionItemResult(sessionId, userId, slotIndex)` to the BC (single-row fetch). Have `loadSlot` call that instead of the full `getSessionItemResults`.

### MAJOR: `fetchCardCandidates` pulls every active card every session start

- **File**: `libs/bc/study/src/sessions.ts:201-239`, called from `previewSession` + `startSession`.
- **Problem**: Scans all active cards for the user with their state + last review rating. No pagination, no due-window filter -- comment explains this is intentional so Strengthen slice can find relearning cards scheduled in the future. But "every active card" scales with deck size.
- **Impact**: For a 30-card MVP deck this is fine. For a learner with 2k+ cards (the airboss-firc ports + personal cards + course content combined), every session preview (including "Shuffle") pulls 2k rows. Session preview is on the hot path.
- **Fix**: Either cap with a generous limit (the engine only picks `sessionLength * 4` or so in practice), or add a "candidate scope" predicate that excludes long-stable review-state cards whose `dueAt` is far in the future unless the Strengthen slice needs them. Could also pre-filter `stability > STABILITY_MASTERED_DAYS AND dueAt > now + 30d` as "out of play."

### MINOR: Memory card detail page loads 10 recent reviews with full review rows

- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:37-40`, BC at `libs/bc/study/src/stats.ts:297-319`.
- **Problem**: `getRecentReviewsForCard` already projects a column list, good. The N+1 risk isn't here, but the card detail page is the shape future "rep detail" and "node detail" pages will copy. Worth flagging that the BC helper is the right model: fetch via `Promise.all`, explicit column projection, limit=10.
- **Fix**: No action. Called out as the pattern to copy for future detail views. Verify `getScenario` + `getNodeView` equivalents do the same when scenarios/nodes gain recent-attempt panels.

### MINOR: `getDueCards` in memory/review pulls full card rows

- **File**: `libs/bc/study/src/cards.ts:239-265`, called from `apps/study/src/routes/(app)/memory/review/+page.server.ts:40`.
- **Problem**: `select({ card, state: cardState })` projects every column of both tables. The route then maps to a narrower client shape at `review/+page.server.ts:45-57`, but the wire transfer from DB already includes `sourceType`, `sourceRef`, `isEditable`, `createdAt`, etc.
- **Impact**: Modest (REVIEW_BATCH_SIZE is 20 by default); but every session-start preview also hits this. A future "load 200 cards for a long session" path will amplify.
- **Fix**: Select only the columns the engine + runner consume: `{ card: { id, front, back, domain, cardType, tags, nodeId, status }, state: { stability, difficulty, state, dueAt, lastReviewId, lastReviewedAt } }`. Same for `getScenarios`.

### MINOR: `getSessions` default limit of 20 but no ORDER BY column on index

- **File**: `libs/bc/study/src/sessions.ts:728-735`.
- **Problem**: Default limit 20 is healthy. `sessionUserStartedIdx` exists on `(userId, startedAt)` so the ORDER BY `desc(startedAt)` + `WHERE userId` is indexed. No current issue.
- **Impact**: None today. Called out because no consumer currently uses this function, so the "sessions history" page that will eventually exist should pass an explicit limit via pagination params rather than relying on the default.
- **Fix**: Document the contract: sessions history UI must paginate. Add an `offset` param (or a `before: Date` cursor) when a caller lands.

### MINOR: `getScenarios` / `getCards` filter-count in browse doubles DB round-trips

- **File**: `apps/study/src/routes/(app)/memory/browse/+page.server.ts:54-85`, `apps/study/src/routes/(app)/reps/browse/+page.server.ts:68-93`.
- **Problem**: Two sequential queries per page render: `getCards(..., limit+1)` for the visible rows, then a second `count(*)` with the same WHERE clauses for pagination UI. Both are dispatched sequentially.
- **Impact**: Each browse page load does 2 DB round-trips when one is in the critical path. At hundreds of rows the count scan with trigram-indexed ILIKE stays cheap, but still doubles latency.
- **Fix**: Run the two in `Promise.all([getCards(...), countCards(...)])`. Minor refactor; move the inline count into `countCards(userId, filters)` in the BC so both read paths share it (reps/browse uses the same pattern).

### MINOR: Trend/activity sparkline builds 366-day fallback array even when not needed

- **File**: `libs/bc/study/src/dashboard.ts:251-263` (streak walk), `:279-324` (`extendedStreak`).
- **Problem**: The streak algorithm walks up to 366 iterations per page load in the fallback path. Only triggers when the user has activity every day in the 7-day window, but the fallback is itself a separate query -- so the common "active user" case does 2 queries for streak instead of 1.
- **Impact**: A power user hits the fallback every day, paying ~1 extra round-trip for streak. Minor.
- **Fix**: Precompute streak as a projection (denormalize onto a `user_streak` materialized row, refreshed on `recordItemResult`/`submitReview`), or accept the second round-trip as-is since it's bounded.

### MINOR: `fetchRepCandidates` pulls full attempt history per session preview

- **File**: `libs/bc/study/src/sessions.ts:242-298`.
- **Problem**: Fetches every rep slot (completed, non-skipped) across all scenarios the user has, not just the last N per scenario. Then sorts in JS and takes `.slice(0, 5)` per scenario.
- **Impact**: For an engaged learner with years of rep history (thousands of attempts), the session preview fetches them all. Index-friendly WHERE, but payload grows.
- **Fix**: Use a window function `ROW_NUMBER() OVER (PARTITION BY scenarioId ORDER BY completedAt DESC)` and filter to `<= 5`, or cap by `completedAt >= now - 180d`. The engine only needs last-5 accuracy and "attempted in last 7 days"; anything older is dead weight.

### MINOR: `fetchNodeCandidates` does four parallel queries including an unbounded `selectDistinct`

- **File**: `libs/bc/study/src/sessions.ts:306-360`.
- **Problem**: The third `selectDistinct({ nodeId: sessionItemResult.nodeId })` query has no `inArray(nodeId, ids)` guard -- wait, it does (line 352). OK, so all three distinct queries are bounded to `ids`. The fourth pulls every `requires` edge with `targetExists=true` across the whole graph (line 356-359) -- not per-node. Fine for 30 nodes, but scales with graph size.
- **Impact**: For 500+ nodes this starts shipping thousands of edge rows on every session preview.
- **Fix**: Filter `knowledgeEdge.fromNodeId IN (candidate node ids)` in the same query so only edges we'll traverse come back.

### MINOR: `getSessionSummary` filters in JS what SQL could aggregate

- **File**: `libs/bc/study/src/sessions.ts:974-1067`.
- **Problem**: Pulls every `session_item_result` row for the session (fine -- bounded by sessionLength ~10), then filters/buckets in JS. Multiple `sirRows.filter(...)` passes (attempted, skipped, repSlots, bySliceMap, cardIdsTouched, scenarioIdsTouched, nodeIdsTouched). Each is O(n).
- **Impact**: Minor; session items bounded. Bad pattern for future "all my sessions summary" endpoints though.
- **Fix**: Single-pass reducer over `sirRows` building the whole aggregate. Documents the pattern so the future "user-wide stats" endpoint doesn't N^2-filter an unbounded history.

### NIT: Knowledge node view fetches edges in 3 round-trips but mastery is separate

- **File**: `apps/study/src/routes/(app)/knowledge/[slug]/+page.server.ts:38-80`.
- **Problem**: `getNodeView` internally does 3 parallel queries (good). Then `getNodesByIds` runs sequentially (one more round-trip), then `getNodeMastery` runs sequentially (three more round-trips via its own `Promise.all`). Three sequential fan-outs total.
- **Impact**: Adds 2 serial hops on a hot page. Minor.
- **Fix**: Lift `getNodesByIds` and `getNodeMastery` into the same `Promise.all` as `getNodeView` (they don't depend on it -- the slug is enough for mastery; the linked-id set is known only after `getNodeView`, so `getNodesByIds` can't move, but `getNodeMastery` can).

### NIT: `fetchRecentSessionDomains` does 3 sequential round-trips for domain lookups

- **File**: `libs/bc/study/src/sessions.ts:489-533`.
- **Problem**: Fetches recent sessions, then conditionally does card-domain, scenario-domain, node-domain lookups one after another (they can't parallelize cleanly because each is inside a separate `if`). Not actually sequential -- they are `await`-ed sequentially. Should be in `Promise.all`.
- **Impact**: 3 serial round-trips on every session preview where any of the three sets is non-empty. Minor (small payloads).
- **Fix**: Build the three promise candidates (or `Promise.resolve([])`), then `Promise.all` them like `getSessionSummary` does.

### NIT: `@ab/bc-sim` barrel includes engine + physics even for `listScenarios`

- **File**: `libs/bc/sim/src/index.ts:1-38`, consumer `apps/sim/src/routes/+page.ts:1-8`.
- **Problem**: Barrel re-exports `FdmEngine`, all physics helpers, and the `ScenarioRunner` alongside the scenarios registry. `+page.ts` is universal, so anything not tree-shaken from `@ab/bc-sim` ships to the client on the listing page.
- **Impact**: `listScenarios` only needs the registry -- physics (`fdm/physics.ts`, 494 lines) is not imported from it transitively, so Vite should tree-shake fine, but it depends on side-effect-free module marking.
- **Fix**: Either split the barrel into `@ab/bc-sim/engine` and `@ab/bc-sim/scenarios` subpath exports, or verify via `bun run build` + bundle inspector that physics isn't shipping to `+page.ts`. Add `sideEffects: false` to `libs/bc/sim/package.json` if missing. Same audit for `@ab/bc-study` once it grows client-facing consumers.
