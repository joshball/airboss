---
feature: study-bc-domain
category: perf
date: 2026-05-01
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 5
  minor: 6
  nit: 3
---

## Summary

Reviewed `libs/bc/study/src/` end to end (~28k LOC, 30+ files). The BC layer
shows clear signs of an earlier perf pass: the dual-gate mastery aggregator,
dashboard fetchers, evidence-state map, scenarios browse, and the rep-backlog
panel were all converted from per-row fan-outs to single grouped-aggregate
queries with parallel `Promise.all` round-trips. Comments explicitly call out
prior N+1 fixes and reference earlier perf reviews. The hot suspects from
the chunk-1 review hold up:

1. `library-by-cert.ts` still loads every active reference and filters in JS
   for both `listReferencesByTopic` and `getReferenceCountsByTopic`.
2. `getHandbookProgress` and `getNodesCitingSection` have NO batch variants;
   route loaders fan out one round-trip per handbook / per section. Both
   functions are also internally a 2-query call, so the per-iteration cost is
   doubled.
3. `getCredentialIdsCoveredBy` walks the credential prereq DAG with one query
   per BFS step and is awaited inside a `while` loop -- not a `Promise.all`.
   `getReferencesForCertWithCarryover` (every cert library page) calls it.
4. `applyCertGoalsToPrimaryGoal` is a serial loop of awaits per cert slug.
5. `recentSessionDomains` in sessions.ts fans out three serial domain lookups
   that should be parallel; they share no data.

Plus several minor JSONB-shape and SQL-shape items where a column-list select
or a partial index would tighten an already-OK path.

The BC layer is fundamentally healthy. None of the issues in this review are
a "the page hangs at scale" outage; the major items are "this query gets
linearly worse as the catalog grows" risks that show up first as an extra
~50-150ms on cert library pages and the handbook lens index. Still worth
fixing -- especially library-by-cert, which has been flagged in two prior
review chunks and remains untouched.

## Issues

### MAJOR: `listReferencesByTopic` reads every active reference, filters in JS

File: `libs/bc/study/src/library-by-cert.ts:224-231`

Problem: The function loads every non-superseded `reference` row, then
filters in memory by `subjects.includes(topic)`. Postgres has both `@>` (jsonb
containment) and `&&` (array overlap) operators that can answer this with a
GIN index; the in-JS filter pulls the entire library across the wire on every
topic page render. The function comment even notes "Drizzle's `arrayContains`
is available on the postgres-js driver" -- yet the implementation does the
filter client-side anyway.

Impact: Linear in `reference` row count. Today the catalog is small enough
this isn't visible; once the AIM, AC, CFR, and PCG corpora finish landing
the topic page makes ~thousands of rows hit the wire just to render
"references tagged X". Each page load.

Fix: Use Drizzle's `arrayContains(reference.subjects, [topic])` (or raw
`sql\`${reference.subjects} @> ${[topic]}::jsonb\`` if the column is jsonb,
\`${reference.subjects} && ARRAY[${topic}]\` for text[]) and add a GIN index
on `study.reference(subjects)` if missing. Drop the JS filter.

### MAJOR: `getReferenceCountsByTopic` materializes every reference's `subjects`

File: `libs/bc/study/src/library-by-cert.ts:257-269`

Problem: Pulls every active reference's `subjects` jsonb column, then sums
in JS. This is a "count per group key" query and belongs in SQL.

Impact: Same growth profile as `listReferencesByTopic`. The library landing
page calls this on every render to render the topic spine.

Fix: Use a Postgres `LATERAL` unnest of `subjects` plus `GROUP BY subject`,
or `jsonb_array_elements_text(subjects) AS subject` joined to itself with
`count(*)` per subject. Single round-trip, work happens in PG. With a GIN
index on `subjects` the inverted-index path is even cheaper.

### MAJOR: No batch helper for `getHandbookProgress`; lens index does N round-trips

Files:
- `libs/bc/study/src/references.ts:496-531`
- `apps/study/src/routes/(app)/lens/handbook/+page.server.ts:17-22` (call site)

Problem: `getHandbookProgress(userId, referenceId)` runs two queries
(`count` of total sections + a join over read-state). The handbook lens index
calls it once per handbook in `Promise.all(handbooks.map(...))`, which is N
parallel calls but still 2N round-trips against PG. Each handbook costs an
independent network hop.

Impact: Today there are ~7 handbooks; that's 14 round-trips on the lens
index. As the AIM and PHAK editions and any future reference carrying
read-state ship, this scales linearly. Will stay invisible until WAN
latency dominates on prod.

Fix: Add `getHandbookProgressBatch(userId, referenceIds)` that:
1. Single grouped query: count sections per (referenceId) for the
   non-chapter level filter.
2. Single grouped query: count read/reading/comprehended per
   referenceId via the existing join.
3. Stitch in a `Map<refId, HandbookProgressSummary>` and return.

Mirrors how `getNodeMasteryMap`, `getCertAndDomainMatrix`, and
`getDashboardPayload` already batch comparable per-row reads. The lens loader
becomes one `await getHandbookProgressBatch(...)` -> O(1) round-trips
regardless of handbook count.

### MAJOR: No batch helper for `getNodesCitingSection`; multi-section pages fan out

Files:
- `libs/bc/study/src/references.ts:338-358`
- Call sites: `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.server.ts:46`,
  `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.server.ts:44`,
  `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts:90`,
  `apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]/+page.server.ts:68`

Problem: `getNodesCitingSection` runs `references @> $probe::jsonb` plus an
in-memory filter for chapter / section locator. There is no batch entry
point keyed on `(referenceId, locator[])`. The handbook chapter and lens
chapter pages call it once per section to build "nodes citing this section"
on the sidebar. The current chapter pages typically render only the
single-section variant, so the fan-out is small today, but the lens
chapter page already iterates sections and the next layer of the citing-by
panel will need a true batch read.

Impact: Each call is one PG round-trip plus a node-row materialization plus
JSON parse. If a chapter has 20 sections and the surface ever needs
per-section "cited by" counts, that's 20 trips for a single chapter render.

Fix: Add `getNodesCitingSectionsBatch({ referenceId, sectionsOf: Array<{
chapter, section? }> })` that:
1. Issues one `@>` query for the (referenceId, kind=handbook) probe,
   returning every candidate node + its `references` jsonb once.
2. In one in-memory pass, partitions hits across the requested locator
   set and returns `Map<sectionKey, KnowledgeNodeRow[]>`.

Keeps the in-memory filter that the existing function already uses (the
GIN with `jsonb_path_ops` doesn't index the locator path), but pays the
candidate-set cost once per chapter view instead of once per section.

### MAJOR: `getCredentialIdsCoveredBy` does serial DB calls inside the BFS loop

File: `libs/bc/study/src/credentials.ts:139-167`

Problem: Walks the credential DAG by `queue.shift()` + `await db.select()`
inside a `while` loop. Each level of the DAG is a separate round-trip; an
N-deep prereq chain is N round-trips even though the prereq table is tiny
and could be fetched whole.

Impact: `getReferencesForCertWithCarryover` (line 103) calls
`getCertsCoveredBy` -> `getCredentialIdsCoveredBy` on every cert library
page render. Today the DAG is shallow (~3 levels: student->private->cfi);
that's 3 sequential trips per page render. The CFI/CFII/ATP path is
deeper and the spec for endorsements + class ratings adds more depth.

Fix: One-shot read the entire `credential_prereq` table (it's a small
edge list -- tens of rows) at the start of the function, then walk the
adjacency map in memory. Same code path used by `getCredentialPrereqDag`
already (line 203-209). Replace the loop body with the in-memory walk;
leaves the visited-set defense intact.

Optional: cache the adjacency map for the duration of the request via a
RequestEvent-scoped memoizer; the DAG doesn't change between reads
within one render.

### MAJOR: `applyCertGoalsToPrimaryGoal` runs per-cert reads serially

File: `libs/bc/study/src/goals.ts:559-577`

Problem: `for (const certSlug of certs)` does `getCredentialBySlug` then
`getCredentialPrimarySyllabus` then `addGoalSyllabus` -- three awaits per
cert -- one cert at a time.

Impact: Preset start + dev seed call paths only. Still grows linearly with
the cert list size and pays 3 round-trips per cert.

Fix: Either (a) one `inArray(credential.slug, certs)` to fetch all
credentials, one `inArray(credentialSyllabus.credentialId, ids)` filtered
to `primacy=primary` to fetch all primary syllabi, then sequence the
`addGoalSyllabus` upserts inside a single transaction; or (b) at minimum,
`Promise.all(certs.map(...))` so the trips run concurrently. The first
option is what the codebase does elsewhere (see
`getCredentialPrereqDag`, `getNodeMasteryMap`).

### MINOR: `fetchRecentSessionDomains` runs three domain lookups serially

File: `libs/bc/study/src/sessions.ts:531-552`

Problem: Three independent `inArray(...)` lookups (cards / scenarios /
nodes) for distinct ID sets, awaited one after the other. They share no
data and could be parallel.

Impact: Per-preview overhead. ~3x latency vs `Promise.all`.

Fix: Wrap all three in a single `Promise.all` call. Identical pattern to
the dashboard's panel fan-out at lines 622-627 of the same file.

### MINOR: `getNodeView` could use `select({ ...columns })` to skip large columns

File: `libs/bc/study/src/knowledge.ts:310-339`

Problem: `getNodeView` returns the full `KnowledgeNodeRow` plus its full
`KnowledgeEdgeRow[]` plus per-card data. The select is `db.select()` (full
row), which materializes the `contentMd` body twice -- once for the
clicked node, once per edge target if the edge result is fed into anything
that needs node titles. The node `contentMd` can be 5-50 KB per row and the
load function for `/knowledge/[id]` only needs the body for the focused
node, not for the inbound/outbound edge metadata.

Impact: Memory + bandwidth. Modest at current node count (~30) but grows
linearly with the graph and with markdown depth.

Fix: When the BC contract guarantees only edges + IDs are needed for the
inbound/outbound panels (typical), keep `getNodeView` as-is for the focused
node but expose a sibling `getNodeViewLite` or trim the edges to (id,
edgeType, target) so the route can decide.

### MINOR: `getNodeMasteryMap` runs three queries serially via Promise.all but `inArray(card.nodeId, ids)` will degenerate at very large IDs

File: `libs/bc/study/src/knowledge.ts:838-918`

Problem: Already batched (good), but the `inArray(card.nodeId, ids)`
predicate becomes a slow-path on PG when `ids` exceeds a few hundred. No
upper bound is enforced; a future call site that reaches the helper with
1000+ node IDs would silently slide into a sequential-scan plan.

Impact: Only matters once a single `getCertAndDomainMatrix` call's
`allNodeIds` set crosses the planner's threshold for `IN ()` -> hash
join. That's not happening today (knowledge graph is ~30 nodes).

Fix: Document an expected upper bound on the BC's TS doc comment so
callers know to chunk; or, when `ids.length > THRESHOLD` (e.g. 500),
materialize the candidate set into a temp table and `INNER JOIN` to it.
Minor today; flagging because the function's doc comment claims "scaling
matters for future credentials with thousands of leaves (CFI)" so the
team is already thinking in those terms.

### MINOR: `getHandbookProgress` runs two sequential queries

File: `libs/bc/study/src/references.ts:496-531`

Problem: Total-sections count and read-state aggregation are independent;
they could be `Promise.all`'d. Currently they run serially.

Impact: ~2x latency for this single call. Compounds when called inside the
N-fanout of the lens index above.

Fix: Wrap the two `db.select()` calls in `Promise.all`.

### MINOR: `previewSession` re-fetches active plan + targeting independently

File: `libs/bc/study/src/sessions.ts:604-614`

Problem: `getActivePlan` and `getEngineTargetingSnapshot` both call
`getActivePlan` internally (the snapshot's helper at engine-targeting.ts
line 107 also reads it). The first `await` at line 604 fetches the plan,
the second `await` at line 612 inside the snapshot fetches it AGAIN.
The pattern is `getActivePlan` -> `getEngineTargetingSnapshot` -> reads
`getActivePlan` again under the hood.

Impact: One redundant round-trip per session preview. Also the
`getEngineTargetingSnapshot` could accept the already-fetched plan as an
optional argument to avoid the second read.

Fix: Either inline-pass the plan into `getEngineTargetingSnapshot` (add
an optional `{ plan }` parameter) or memoize on a request-scoped token.

### MINOR: `getDerivedCertGoals` joins through `goalSyllabus -> credentialSyllabus -> credential` for every preview

File: `libs/bc/study/src/goals.ts:209-219`

Problem: Called from `engine-targeting.ts` on every `previewSession`. The
join path is fine for correctness but the result rarely changes between
previews -- the same primary goal yields the same cert set until a write.

Impact: One extra round-trip per session preview.

Fix: Acceptable as-is unless `previewSession` becomes a hot path. If it
does, cache the derived list keyed on `(userId, primaryGoalId,
goal.updatedAt)` for a short window. Not worth implementing today;
flagging for the engine cutover work package.

### MINOR: `getCertProgress` and `getDomainCertMatrix` still exist as standalone exports duplicating work

File: `libs/bc/study/src/knowledge.ts:944-989, 1018-1071, 1091-1179`

Problem: `getCertAndDomainMatrix` shares the node scan + mastery map; the
two standalone functions still issue their own `db.select` + their own
`getNodeMasteryMap` call. The dashboard memoizer at `dashboard.ts:598-606`
uses the combined helper, but the standalone exports remain for "tests +
any caller that injects custom fetchers." Each standalone path runs a full
`getNodeMasteryMap` over `allNodeIds`.

Impact: Real-world callers go through the dashboard so this is mostly
test-only cost today. Worth checking that no app route bypasses the
shared helper.

Fix: Mark the standalone exports `@internal` or rename to `*ForTest` so
new callers default to the combined helper. Or, replace the standalone
exports with thin wrappers that always delegate to
`getCertAndDomainMatrix` and pluck the relevant half (the dashboard
already does this).

### NIT: `listNodesWithFacets` re-iterates the node list 5+ times for facet counts

File: `libs/bc/study/src/knowledge.ts:573-595`

Problem: For each facet (domain, cert, priority, lifecycle) the function
loops over every enriched node. For ~30 nodes it doesn't matter; the
shape is `O(facets * nodes)`. With 1000+ nodes the constant climbs.

Impact: Negligible at current scale.

Fix: Single pass over `enriched` that bumps every facet's counters in one
loop iteration, gated by `passes(n, exclude)` per facet. Saves nothing
today; cleaner code.

### NIT: `extendedStreak` builds a 366-day union via raw SQL

File: `libs/bc/study/src/dashboard.ts:336-381`

Problem: The fallback streak uses a raw `UNION` subquery with two
`date_trunc + AT TIME ZONE 'UTC'` legs, then a JS walk-back. The walk
itself is fine; the `UNION` over two scans is correct, but the timezone
conversion forces a per-row evaluation that isn't index-friendly.

Impact: Only triggers when the user has activity every day in the
sparkline window AND the streak might extend further -- rare edge case.

Fix: Add a partial index on `review(reviewed_at)` and
`session_item_result(completed_at)` if not present (likely already
covered by the per-user (user_id, *_at) indexes). Minor.

### NIT: `recordPhaseVisited` / `recordPhaseCompleted` use `for update` then upsert pattern

File: `libs/bc/study/src/knowledge.ts:1218-1311`

Problem: Each phase write opens a transaction with `SELECT ... FOR UPDATE
LIMIT 1` followed by either an insert or an update. The `ON CONFLICT`
upsert pattern used throughout the rest of the BC would handle this in
one statement without the explicit lock.

Impact: Two round-trips per phase event vs one. Not a hot path (one
event per learner action), but this is one of the few BC writers that
doesn't follow the upsert convention.

Fix: Replace with `insert ... onConflictDoUpdate({ target: [userId, nodeId], set: { visitedPhases: sql\`array_append(...)\`, lastPhase, updatedAt } })`.
The trick is the array dedupe (`uniq(array_append(visited, $phase))`)
needs to happen in PG -- doable with a CTE or a custom expression. Skip
unless the phase-write hits real traffic.
