---
feature: full-codebase
category: perf
date: 2026-04-27
branch: main
issues_found: 11
critical: 0
major: 4
minor: 5
nit: 2
---

## Summary

Overall the codebase is in good shape on perf. The dashboard fans queries out via `Promise.allSettled`, the engine is a pure function with batched pool fetches and per-call memoization, and the schema carries appropriate composite indexes for the user-scoped read paths (`card_user_status_idx`, `sir_user_kind_completed_idx`, etc.). Most BC queries already aggregate in SQL rather than JS, and `getCertAndDomainMatrix` is a deliberate reuse of one node scan + one mastery map. The issues below are mostly latent: hot paths that work today at MVP scale (~30 nodes, dozens of cards/scenarios) but will degrade as content grows. The biggest single risk is the citation picker against `hangar.reference.tags` (jsonb subfield filter with no GIN index plus full-table ilike), which is hit on every keystroke in the picker.

## Issues

### MAJOR: citation picker queries do full-table scans on jsonb subfield + ilike

- **File**: libs/bc/citations/src/search.ts:39-67, 72-100
- **Problem**: `searchRegulationNodes` and `searchAcReferences` filter by `tags ->> 'sourceType' = 'cfr'` (jsonb path expression) AND by `ilike(displayName, '%term%')`. `hangar.reference.tags` is jsonb with no GIN/jsonb_path_ops index (`drizzle/0000_initial.sql:540-541` defines only `dirty` and `updated_at` indexes on the table). `displayName` has no trgm index. Every picker keystroke does a sequential scan over the full reference table for both the regulation and AC search variants, since the citation picker fires `/api/citations/search?target=...&q=...` per debounced keystroke from the client.
- **Impact**: Today the table is small (~handful of rows during dev), so the cost is invisible. As the regulation + AC corpus grows toward thousands of rows, every picker keystroke turns into a multi-second sequential scan, and the picker UX collapses. CFR Title 14 + 49 alone (per recent commit `c05c91a9 Lane A Phase 3`) will push this beyond the dev-set threshold.
- **Fix**: Add a btree expression index on `((tags ->> 'sourceType'))` (cheap; the cardinality is small) and a `gin (display_name gin_trgm_ops)` index on `hangar.reference` to match the pattern used on `study.card` (`card_front_trgm_idx`/`card_back_trgm_idx` in 0000_initial.sql:489-490). With both, the planner can intersect the source-type predicate with a trigram match on `displayName` and avoid the full scan.

### MAJOR: /handbooks index issues N+1 progress queries

- **File**: apps/study/src/routes/(app)/handbooks/+page.server.ts:15-22
- **Problem**: After `listReferences()` returns N reference rows, the loader does `Promise.all(references.map(ref => getHandbookProgress(user.id, ref.id)))`. `getHandbookProgress` (libs/bc/study/src/handbooks.ts:456-491) fires two queries per reference (one totals, one read-state inner-join). The result is `1 + 2N` queries per page load.
- **Impact**: Today N=3, so 7 queries -- fine. Once the handbook corpus grows past a dozen references the index page becomes a noticeable round-trip pile-up. Independent of latency, this is a textbook N+1 that should be folded into a single grouped query.
- **Fix**: Replace `getHandbookProgress` per-row with one query that joins `handbook_section` + `handbook_read_state` and groups by `referenceId`, returning the per-reference totals/read/reading/comprehended in one shot. Same shape the dashboard's `getCertProgress` already uses.

### MAJOR: /sources/[id]/files preview pipeline blocks the load function

- **File**: apps/hangar/src/routes/(app)/sources/[id]/files/+page.server.ts:120-152, 162-171
- **Problem**: For BINARY_VISUAL sources the loader walks every edition directory and `await buildEntry(...)` in a serial inner loop (line 142). For TEXT sources it parallelizes via `Promise.all` (good), but `buildEntry` itself reads up to 256KB of every text-like file into memory AND runs `parseMarkdown` (Shiki-based highlighter) for every Markdown entry inside the load function. Shiki is the expensive part here: a single highlight pass can be tens of milliseconds, and they all add up before SSR can render.
- **Impact**: A handbook source directory with a dozen MD files makes the page hang for 100-500ms even on a hot Shiki cache. With many small files (the common case for derivative trees) the binary-visual serial loop also compounds linearly.
- **Fix**: (1) Parallelize the BINARY_VISUAL loop with `Promise.all(editionDirs.flatMap(...))` matching the TEXT branch. (2) Don't parse Markdown server-side for every file in the listing -- return only `previewKind`, name, size, mtime in the load function and lazy-load `previewText` + `markdownNodes` via a `+server.ts` endpoint when the user expands a row. The current shape preloads work for files the user will never look at.

### MAJOR: knowledge browse materializes every node + parses content_md per render

- **File**: libs/bc/study/src/knowledge.ts:482-550 (listNodesWithFacets), apps/study/src/routes/(app)/knowledge/+page.server.ts:41-55
- **Problem**: `listNodesWithFacets` selects every `knowledge_node` row including `content_md` (the full markdown body), then calls `lifecycleFromContent(row.contentMd)` per row to derive lifecycle in JS. The route page then asks for facet counts that are computed by re-running `passes(node, exclude)` for every node and every facet. The page also slices to a window for mastery lookup (good), but the read-amplification is on the source query.
- **Impact**: `content_md` per node is several KB to tens of KB; pulling all 500 nodes (the spec's projected scale) on every browse page hit is hundreds of KB transferred from PG into Bun memory just to compute lifecycle and facet counts. The schema has `lifecycle` as a real column (`drizzle/0000_initial.sql:163`) but the BC ignores it and recomputes from content. Wasted work both at query time and per-render.
- **Fix**: Stop selecting `content_md` in `listNodesWithFacets` -- read the persisted `knowledge_node.lifecycle` column instead of re-parsing. Move facet counts to GROUP BY queries (the `study.knowledge_node` table has indexes on `domain`, `minimum_cert`, `study_priority`, `lifecycle`, so per-facet aggregates are cheap). The "exclude one filter" pattern the scenarios facet code uses (libs/bc/study/src/scenarios.ts:336-372) is the right shape to copy.

### MINOR: fetchCardCandidates pulls every active card unconditionally

- **File**: libs/bc/study/src/sessions.ts:210-248
- **Problem**: For the engine's session preview, the BC reads every active card with state for the user. The comment on line 207-209 explains why (Strengthen needs relearning + rated-Again cards even when not due), but at scale this is a per-user table scan that returns thousands of rows. `runEngine` then does an O(N) pass over all of them per slice scoring function.
- **Impact**: A learner with 5000 active cards transfers 5000 rows on every session preview / shuffle. Each shuffle button click reissues this query (preview is rebuilt fresh -- engine cache is per-call). Memory pressure inside Bun + JSON serialization cost dominates the engine runtime once cards grow past a couple thousand.
- **Fix**: Predicate-narrow the candidate set in SQL: union of (a) cards with `due_at <= now + look_ahead` and (b) cards with `state IN ('learning','relearning')` and (c) cards with `last_review.rating IN (Again, Hard)`. The predicate is a small set of OR clauses that all hit existing indexes (`card_state_user_due_idx`, `card_state_last_review_idx`). Engine scoring still rejects irrelevant candidates (via score=0 short-circuit) but never sees them.

### MINOR: recoverOrphanedRunning loops appendJobLog serially

- **File**: libs/hangar-jobs/src/enqueue.ts:145-164
- **Problem**: When recovering orphaned RUNNING jobs on worker boot, the function does `for (const { id } of orphaned) { await appendJobLog(...) }`. Each `appendJobLog` call (line 127-139) issues a `coalesce(max(seq)) + 1` subquery + insert per orphan, serially.
- **Impact**: Worker boot delay scales linearly with orphan count. Today this is rarely more than a handful of jobs, but a hard crash mid-run could leave dozens. Each call is two DB round-trips plus a max-aggregate, so 30 orphans = 60+ round-trips before the worker is ready to serve.
- **Fix**: Build a single `INSERT ... SELECT` that computes per-job `MAX(seq) + 1` once and inserts all the recovery rows in one statement. Or accept that recovery isn't latency-critical and parallelize via `Promise.all(orphaned.map(...))` (still N queries but they run concurrently).

### MINOR: hangar.reference + hangar.source ilike scans without trgm

- **File**: libs/bc/citations/src/search.ts (search helpers), apps/hangar/src/routes/(app)/users/+page.server.ts:19-22, apps/hangar/src/routes/(app)/sources/+page.server.ts (sort by id)
- **Problem**: Multiple search/list paths use `ilike(column, '%term%')` (substring match anchored on neither side). PostgreSQL btree can't accelerate leading-`%` ilike; only trgm GIN can. The schema has trgm indexes on `study.card.front` / `study.card.back` (correct) but not on `hangar.reference.display_name`, `hangar.source.title`, or `bauth_user.email`/`name`.
- **Impact**: As the reference and user tables grow, every search box keystroke is a sequential scan. Manageable today; will hurt once corpora are populated.
- **Fix**: Add `gin (column gin_trgm_ops)` indexes to the columns the UI search boxes hit. Keep the simple substring UX; the indexes do the rest.

### MINOR: getRecentActivity can issue an extra full-history streak query

- **File**: libs/bc/study/src/dashboard.ts:308-326, 336-381
- **Problem**: When the streak runs the full sparkline window unbroken, the function falls back to `extendedStreak` -- a 366-day UNION over `review` and `session_item_result`. That's a second pass over the per-user activity history just to extend the streak counter past the sparkline.
- **Impact**: Cheap unless a learner has streaks longer than `ACTIVITY_WINDOW_DAYS`. The fallback runs on every dashboard load for that learner. The two queries already executed for the sparkline cover the same date range subset; they could be widened once instead of running a third query.
- **Fix**: Make the initial sparkline window query lookback `366` days but only emit the most-recent `days` days for the chart. Walk all rows for the streak. Saves one DB round-trip per streak-extension dashboard hit.

### MINOR: getDashboardStats runs computeStreakDays as a separate query

- **File**: libs/bc/study/src/stats.ts:114-134, 69-102
- **Problem**: `getDashboardStats` fans out 5 parallel queries; `computeStreakDays` is one of them. The dashboard payload also calls `getRecentActivity` (dashboard.ts:237) which computes its own streak from review + attempt union. Two streak computations per dashboard load -- with different shapes (reviews-only vs reviews+attempts).
- **Impact**: Modest extra round-trip; the activity payload's streak is the more correct one (counts attempts) so the stats-panel `streakDays` is arguably redundant data on the same response.
- **Fix**: Either drop `streakDays` from `DashboardStats` and surface only the activity-panel value, or make `getRecentActivity` return both a reviews-only and a reviews+attempts streak so the stats panel can pick. Either way avoids two SQL round-trips for the same conceptual question.

### NIT: getDomainBreakdown sums dueAt/stability with parameterized strings

- **File**: libs/bc/study/src/stats.ts:166-167, 213, 619
- **Problem**: `sql\`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)\`` interpolates `now` as a string parameter. Each row in the GROUP BY does a tz-aware comparison cast against a parameterized text. Tiny per-row, but multiplied across `card_state` rows it adds up vs comparing against a `to_timestamp(...)` once.
- **Impact**: Negligible in practice; PG is good at constant folding parameters. Listed for completeness.
- **Fix**: If a profiling pass shows it matters, cast once in CTE form; not worth the readability hit otherwise.

### NIT: pdf extract uses spawnSync inside a potentially-async caller

- **File**: libs/sources/src/pdf/extract.ts (multiple `spawnSync` + `readPdfInfo`)
- **Problem**: `spawnSync` blocks the event loop. Today it's only invoked from CLI scripts and ingest jobs running in the worker process, which is acceptable. If a future route ever calls into PDF extraction directly (e.g. on-demand preview generation in hangar), the synchronous spawn would stall the request server.
- **Impact**: None today. Becomes a footgun if anyone uses it from a load function.
- **Fix**: Switch to `node:child_process` `execFile`/`spawn` + promisify. Same API surface, async semantics. Mark as work-package follow-up if not done now.
