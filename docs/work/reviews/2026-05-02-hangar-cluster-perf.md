---
feature: hangar-cluster
category: perf
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 5
  minor: 7
  nit: 4
  total: 16
---

## Summary

Hangar admin surfaces are well-shaped overall: BCs use Drizzle aggregates, list pages run filter + count + dirty-count concurrently via `Promise.all`, the audit explorer is keyset-paginated, and `listUsers` collapses last-seen into a single LEFT JOIN aggregate (no N+1). The serious gaps are pragmatic ones the codebase already nods at:

- The audit-log default query (24h window, no other filter) is not supported by any DB index. With audit volume growing the `ORDER BY timestamp DESC, id DESC` keyset paging falls off a cliff.
- `/sources` re-reads two large files from disk on every request (`aviation.ts` ~160 KB regex scan, plus a `manifest.json` parse) inside the load function with no caching.
- `listRunningJobs` and `recoverOrphanedRunning` ship `SELECT *` with no LIMIT.
- The job-detail page accumulates log lines forever in client state; `pollLog` returns up to 500 new lines per second and never trims.
- `revokeAllUserSessions` uses `Number.MAX_SAFE_INTEGER` as a Drizzle limit and selects every column to count rows it could have counted aggregate-style.

Everything else is minor (column-list tightening, `count(*)` over `select().length`, cache the SOURCE_KIND_BY_TYPE lookup pattern, etc.).

## Issues

### MAJOR: Audit log has no timestamp-only index; default explorer page degrades with volume

File: `/Users/joshua/src/_me/aviation/airboss/libs/audit/src/schema.ts`, consumed via `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/audit-queries.ts`

Problem: Existing audit indexes are `(actor_id, timestamp)` and `(target_type, target_id, timestamp)`. The hangar audit explorer's default page is "last 24h, no actor / target / op filter" -> `WHERE timestamp >= $window AND (timestamp,id) < (...) ORDER BY timestamp DESC, id DESC LIMIT 51`. Postgres can't use either composite for that predicate -- the leading column is `actor_id` / `target_type`, not `timestamp`. Result: bitmap or full index scan that grows linearly with audit_log size.

Impact: The page is fine today (small log) but the spec explicitly markets the explorer for "every target / actor / op / window" -- the unfiltered window IS the canonical entry. As soon as the log crosses a few hundred thousand rows the default load will start thrashing.

Fix: Add a standalone descending index `audit_log_timestamp_idx ON (timestamp DESC, id DESC)` (or `(timestamp, id)` -- Postgres can scan backward). The existing indexes still support actor/target-filtered queries.

### MAJOR: `/sources` reads aviation.ts (~160 KB) and runs two regex scans on every request

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.server.ts:54-70`

Problem: `loadAviationCounts()` reads `libs/aviation/src/references/aviation.ts` from disk and runs two `String.match(/...../gm)` passes on every page hit, just to populate two integer tiles (`referenceCount`, `verbatimCount`). The file is 4,095 lines (~160 KB). Adjacent `loadManifestSummary()` reads + JSON-parses `data/references/manifest.json` on every hit too.

Impact: Each `/sources` load does ~160 KB synchronous file read + two regex sweeps + a JSON parse, on top of three DB queries. Per-request, not per-deploy. The page is the operator dashboard; it gets re-loaded constantly, including from the polling on the /jobs side via cross-tab navigation.

Fix: Either (a) pull these counts from the DB directly -- `referenceCount` is `count(*)` over `hangar.reference WHERE deletedAt IS NULL` (already exposed as `countLiveReferences`); `verbatimCount` is `count(*)` over `hangar.reference WHERE verbatim IS NOT NULL`; or (b) cache the file-derived numbers with mtime invalidation. (a) is cheaper, more accurate, and removes a regex heuristic comment in the code.

### MAJOR: `listRunningJobs()` returns the full table without LIMIT

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/jobs-queries.ts:86-92`

Problem: `listRunningJobs` does `SELECT * FROM hangar.job WHERE status='running' ORDER BY started_at DESC` with no limit. Used on `/sources` (every load) to overlay active arrows on the flow diagram. Selects every column (including `payload` and `result` jsonb) for every running row.

Impact: Today running-job count is bounded by worker concurrency (DEFAULT 3), so this is fine. But the function name is generic, the BC contract has no cap, and any future caller (or a worker hang that leaves N rows in `running` past recovery) will leak full payloads to the page. `payload` and `result` can be large jsonb (upload payloads carry tempPath + metadata; diff results carry the full diff text).

Fix: Add a LIMIT (e.g., 50, well above worst-case concurrency) and select only the columns the caller actually needs (`id`, `kind`, `targetId`, `startedAt` for `/sources`). Ship a column-list select instead of `select()`.

### MAJOR: Job detail page log buffer grows unboundedly on the client

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:23-69`

Problem: `pollLog()` runs every 1s while the job is non-terminal. Each poll fetches up to `MAX_LINES_PER_POLL = 500` new lines (`/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/[id]/log/+server.ts:7`) and concatenates into `logs = [...logs, ...body.lines]`. Filtered render iterates `filteredLogs = logs.filter(...)` for non-`all` tabs, on every reactive update. There is no cap, no virtualization, no trim.

Impact: A long-running source job that emits ~50 lines/sec for 5 minutes produces 15,000 DOM rows. The `{#each filteredLogs}` block keys by `seq`, but Svelte still has to layout every node. Memory use grows linearly; the filter recomputes on every poll. For genuine subprocess output (extract, build, diff) this is a real risk.

Fix: Cap client buffer at the most recent N lines (e.g., 5,000) with a "showing last N -- view full log" affordance, OR virtualize the log body. Server already supports cursoring; client just needs to drop the head.

### MAJOR: `revokeAllUserSessions` uses MAX_SAFE_INTEGER limit + selects every session column

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/user-writes.ts:454-456`

Problem: `listRecentUserSessions(targetUserId, Number.MAX_SAFE_INTEGER, db)` is called purely to compute `revokedCount` and check if the actor's current session id is among the set. `listRecentUserSessions` selects `id, ipAddress, userAgent, createdAt, expiresAt` for every row.

Impact: Postgres receives `LIMIT 9007199254740991`. For a user with hundreds or thousands of sessions (long-tenured account on a system that doesn't aggressively expire), this returns the full row set just to call `.length` and `.some(s => s.id === ...)`. Wastes server memory and wire bytes proportional to session count.

Fix: Either (a) use `countUserSessions(userId)` (already exists) plus a separate `SELECT 1 FROM bauth_session WHERE id = $currentSessionId AND userId = $target LIMIT 1` to detect the revokedOwn flag, or (b) add a dedicated BC helper `listSessionIds(userId)` that returns just `id[]`. (a) is two cheap aggregate / index-hit queries; (b) is one slim scan. Either beats the current full-scan.

### MINOR: `listLiveSources` ships `SELECT *` to drive a presentation table

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/dashboard-queries.ts:34-36`, consumed at `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/+page.server.ts:75`

Problem: `db.select().from(hangarSource).where(isNull(...)).orderBy(...)` returns every column on `hangar.source`, including `payload`-flavored jsonb (`media`, `edition`, `locatorShape`). The `/sources` mapper only reads `id`, `rev`, `type`, `title`, `version`, `url`, `path`, `format`, `checksum`, `sizeBytes`, `downloadedAt`, `dirty`, `updatedAt`. `media`, `edition`, `locatorShape` are pulled and then dropped.

Impact: Wasted DB I/O + wire bytes per source row. Manageable today (hundreds of rows max) but every `/sources` hit pays for it.

Fix: Switch `listLiveSources` to a column-list select matching the consumer.

### MINOR: `listJobs` ships `SELECT *` for the /jobs page

File: `/Users/joshua/src/_me/aviation/airboss/libs/hangar-jobs/src/enqueue.ts:76-85`

Problem: `/jobs` (`/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/+page.server.ts:15`) needs a narrow projection (`id, kind, targetType, targetId, status, actorId, progress, createdAt, startedAt, finishedAt`). `listJobs` returns `select()` -- includes `payload`, `result`, `error`, all jsonb. The page polls at 1 Hz when any job is live (`/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/+page.svelte:37-44`).

Impact: Each poll re-runs the full-row query and SvelteKit re-serialises 100 rows including their full jsonb payloads / results. Polling magnifies the cost.

Fix: Add a column-list overload (e.g., `listJobs({...}, projection?)`) or a dedicated `listJobsForIndex` helper that omits `payload`/`result`/`error`.

### MINOR: `getActiveJobForTarget` and `listRecentJobsForTarget` ship `SELECT *`

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/jobs-queries.ts:18-45`

Problem: Same shape as `listJobs`. Both are called on `/sources/[id]` per request (`+page.server.ts:32, 37`). The detail page maps to `id`, `kind`, `status`, `createdAt`, `finishedAt` (and `startedAt` for active). `payload`/`result`/`error` are unused.

Impact: Every source-detail load pulls full payload + result jsonb for the recent-10 + active job. Same wire-cost story as above.

Fix: Tighten to a column-list select.

### MINOR: Dashboard `countAllJobs` aggregates the entire job table

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/dashboard-queries.ts:25-28`

Problem: `countAllJobs()` is `SELECT count(*) FROM hangar.job` -- no soft-delete or status filter. Drives the home-page tile labelled "jobs".

Impact: As the job table grows (one row per fetch / extract / build / diff / validate / sync, never pruned in this codebase), the count gets slower. There is no index Postgres can use for `count(*)` on the full table -- it's a full scan + each visibility check.

Fix: Either (a) cap the tile to "jobs in the last 24h" using `hangar_job_status_idx` (which is `(status, createdAt)`) or `hangar_job_kind_idx` (`(kind, createdAt)`) -- you can scan `created_at >= now()-24h` over a covering index range, or (b) add a status-scoped count (queued + running) which is what an operator usually cares about. Either is cheap and bounded.

### MINOR: `recoverOrphanedRunning` reads orphaned ids then issues per-row `appendJobLog` writes serially

File: `/Users/joshua/src/_me/aviation/airboss/libs/hangar-jobs/src/enqueue.ts:146-165`

Problem: After recovering N orphaned rows in a single bulk UPDATE, the function loops `for (const { id } of orphaned) { await appendJobLog(...) }`. `appendJobLog` itself runs `INSERT ... seq = (SELECT MAX(seq)+1 FROM hangar_job_log WHERE jobId=$id)` -- a correlated subquery + INSERT per orphan, awaited serially.

Impact: Worker boot blocks on N round trips, each with its own MAX-seq subquery. With a clean restart this is fine; after a crash that left dozens of orphans it's slow boot.

Fix: Issue the log inserts in a single multi-row INSERT (recovery seq is always 0 for the recovery line since it's the first event after restart -- the existing seq stream resumes per-job once the worker picks the job back up). Or run them via `Promise.all`.

### MINOR: `claimNext` re-runs the queue scan every loop iteration; no SKIP LOCKED

File: `/Users/joshua/src/_me/aviation/airboss/libs/hangar-jobs/src/worker.ts:74-100`

Problem: Inner pick loop runs `claimNext()` synchronously until either `runningIds.size === concurrency` or no candidate is found. Each call: SELECT scan + UPDATE-by-id. The SELECT uses `notInArray(targetId, lockedTargets)` with the in-memory worker's set, so a multi-process deployment would race; the row-claim UPDATE is the actual race-safety. No `FOR UPDATE SKIP LOCKED` -- relies on optimistic re-check `WHERE status = QUEUED`.

Impact: Single-host today is fine. Comment says single-host is intentional. But the per-iteration full SELECT is wasteful when the queue has thousands of queued rows: each tick scans them all to pick the next eligible row not in `lockedTargets`. With 1 Hz poll + N targets locked, this is N+1 scans per second.

Fix (when scaling beyond MVP): switch to `FOR UPDATE SKIP LOCKED` claim pattern and remove the in-memory `lockedTargets` tracking -- DB locks become the source of truth. Adds a comment noting MVP is single-host.

### MINOR: `getReference` / `getSource` return full row when only the existence + rev is needed

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/registry.ts:156-159, 377-380`, used inside `updateReference` / `softDeleteReference` / `updateSource` / `softDeleteSource`

Problem: The transactional update path reads `getReference(id, tx)` to grab the existing row, but most of the existing row's contents are only used for the audit `before` snapshot. In the rev-conflict refresh path it then runs another slim `select({ rev })` query. The first read could be slim if `before` is computed from a column-list projection, or the audit `before` could include `existing` only when there's something to diff against (it always does for `update`).

Impact: Minor wasted bytes -- the row is small, and the operation is rare (write path, not list). Not load-bearing.

Fix: Optional. If you tighten `getReference` to a column-list, `before` snapshots stay accurate (they need the full row) so you'd want a separate `getReferenceForUpdate(id)` slim read. Probably not worth it; flagging for completeness.

### NIT: `referenceWhere` rebuilds the same WHERE for both list and total count, but dirtyCount uses a separate WHERE

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/registry.ts:130-154, 354-375`

Problem: `dirtyCount` ignores the user's filters (search / sourceType / etc.) and always counts all dirty rows in the registry, while `total` honours them. That's the correct product semantic (the "Sync all pending" button reflects the global dirty backlog, not the filter), but it means the 3-query Promise.all has one query that doesn't share the filter index path. Minor pedant; leaving as a comment in case the product call ever flips.

Fix: None needed. Documenting.

### NIT: `getJob` ships `SELECT *` for /jobs/[id] and the log-poll endpoint

File: `/Users/joshua/src/_me/aviation/airboss/libs/hangar-jobs/src/enqueue.ts:64-67`

Problem: Used by `/jobs/[id]/log/+server.ts:21` on every 1 Hz poll. Returns the full row -- including `payload` jsonb -- when the polling endpoint only needs `status`, `progress`, `error`, `result`, `finishedAt`.

Fix: Slim projection for the polling path (`select({ status, progress, error, result, finishedAt })`). The detail-load path can keep using full row.

### NIT: `/sources/[id]` triggers two job-table queries serially

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/+page.server.ts:32, 37`

Problem: `recentJobs = await listRecentJobsForTarget(...)` then `activeJob = await getActiveJobForTarget(...)`. Both hit `hangar.job` keyed by `targetId`. They could run via `Promise.all` -- they're independent.

Fix: One-line `Promise.all([listRecentJobsForTarget(id, 10), getActiveJobForTarget(id)])`. Two round trips collapse to one wall-clock unit.

### NIT: `/sources/[id]` filesystem `stat` runs serially with the second job query

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/sources/[id]/+page.server.ts:42-50`

Problem: `await stat(...)` for the on-disk snapshot is sequenced after both job queries even though it depends only on the source row. Could be in the same `Promise.all` as the job queries above.

Fix: Same as above -- bundle into a single `Promise.all` once the source row is fetched.

## Status as of 2026-05-04

| Finding | Verdict | Closure |
| ------- | ------- | ------- |
| MAJOR: audit log no timestamp index | CLOSED | Chunk-3 PR #426 added `audit_log_timestamp_idx` (`libs/audit/src/schema.ts:80`) |
| MAJOR: `/sources` reads aviation.ts via regex | CLOSED | PR #453 -- replaced with DB counts (`countLiveReferences`, `countVerbatimReferences`) |
| MAJOR: `listRunningJobs` no LIMIT, full row | CLOSED | PR #453 -- slim projection + `JOBS_LIST_HARD_CAP` (`jobs-queries.ts:93-108`) |
| MAJOR: job log buffer unbounded on client | CLOSED | PR #453 -- `JOB_LOG_CLIENT_BUFFER_MAX = 5000` cap with drop-oldest + "trim notice" |
| MAJOR: `revokeAllUserSessions` MAX_SAFE_INTEGER limit | CLOSED | PR #453 -- replaced with `countUserSessions` + targeted `hasUserSessionWithId` (`user-writes.ts:454-462`) |
| MINOR: `listLiveSources` SELECT * | CLOSED | PR #453 -- column projection in dashboard-queries |
| MINOR: `listJobs` SELECT * | CLOSED | PR #453 -- slim projection for /jobs index |
| MINOR: `getActiveJobForTarget` / `listRecentJobsForTarget` SELECT * | CLOSED | PR #453 -- column projection |
| MINOR: `countAllJobs` aggregates whole table | CLOSED | PR #453 -- scoped to recent + queued/running tile semantics |
| MINOR: `recoverOrphanedRunning` per-row appendJobLog | CLOSED | PR #436 -- batched / Promise.all'd inside transaction |
| MINOR: `claimNext` no SKIP LOCKED | CLOSED | Documented MVP trade-off in worker.ts; multi-host upgrade tracked separately |
| MINOR: `getReference` / `getSource` full-row read | CLOSED | Acceptable trade-off; documented in registry.ts |
| NIT: `referenceWhere` filter-vs-dirtyCount mismatch | CLOSED | Intentional product semantic; documented |
| NIT: `getJob` SELECT * for polling | CLOSED | PR #453 -- slim status projection on the polling endpoint |
| NIT: `/sources/[id]` two job queries serial | CLOSED | PR #453 -- Promise.all bundle |
| NIT: `/sources/[id]` filesystem stat serial | CLOSED | PR #453 -- bundled into the same Promise.all |

Total: 16 closed / 0 open. `review_status` flipped to `done`.
