---
feature: hangar-cluster
category: backend
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 4
  minor: 6
  nit: 3
---

## Summary

Reviewed the hangar app server cluster (`apps/hangar/src/routes/**` server files, `hooks.server.ts`, `lib/server/*`) plus the BC libs that back them (`libs/bc/hangar/src/`, `libs/hangar-jobs/src/`, `libs/hangar-sync/src/`).

Overall the surface is in solid shape:

- Dual-gate auth is consistent: every page-server load and every form action calls `requireRole(...)` explicitly, the `(app)/+layout.server.ts` enforces the AUTHOR | OPERATOR | ADMIN floor, and `/users`, `/admin/audit`, and `/api/audit-actors` re-gate to ADMIN.
- Form actions are uniformly Zod-validated (or shape-narrowed via `formDataToInitial` + `validateReferenceForm` / `validateSourceForm`), return `fail(...)` with stable shapes, and rethrow redirects via `isRedirect`.
- Multi-step writes use `db.transaction` (`updateReference`, `updateSource`, `softDeleteReference`, `softDeleteSource`, `runSync`); the sync job adds a `pg_advisory_xact_lock` for cross-process serialization; the worker claims rows with a status-conditional UPDATE...RETURNING for race safety.
- Audit emissions land on every writing path: registry CRUD, user admin actions, job lifecycle (queued / complete / failed / cancelled), sync outcomes, source-job kinds. Uploads and binary-visual fetches finalize an audit row.
- Path-escape defense is consistent on every filesystem-touching endpoint (`/files`, `/files/raw`, `/download`, `/thumbnail`, archive delete) with a `startsWith(blobRoot + '/')` prefix check.
- Better-auth surface is properly proxied (login forwards `x-forwarded-for` for rate limiting; logout clears cookies in `finally`); CSP/security headers applied in `applySecurityHeaders`.

The findings below are mostly correctness gaps in error categorization, audit-trail completeness across non-atomic boundaries, and one broken chip-resolution lookup on the audit explorer. No critical (auth-bypass / data-corruption) issues found.

## Issues

### MAJOR: audit-explorer actor chip resolution uses search-by-name when it should look up by id

**File:** `apps/hangar/src/routes/(app)/admin/audit/+page.server.ts` (lines 39-44, 72)

**Problem:** When the URL carries `?actor=<userId>`, the loader resolves the chip via `searchActorIds(decoded.actorId, 1)`. But `searchActorIds` only matches `bauthUser.name` and `bauthUser.email` via `ILIKE` (see `audit-queries.ts` line 325) — it never compares against `bauthUser.id`. Better-auth user ids are random strings (e.g. `WZF7...`) that don't match any human-typed name or email, so the actor chip will be empty for every deep-linked / bookmarked actor URL. The list itself will still filter correctly (because `listAuditEntries` keys on `actorId`), but the filter-bar chip will silently disappear and the typeahead fallback in `+page.svelte:236` will receive `data.actorOptions[0] === undefined`.

**Fix:** Add a `getActorById(id)` BC helper (single-row `bauthUser` lookup returning `{id, name, email}`), and use it here instead of repurposing the typeahead. Alternatively, broaden `searchActorIds` to also match `bauthUser.id` exactly, but the dedicated helper is cleaner — id resolution and free-text search are distinct operations.

### MAJOR: temp upload directory leaks when SvelteKit `redirect(...)` is thrown

**File:** `apps/hangar/src/routes/(app)/sources/[id]/upload/+page.server.ts` (lines 89-121)

**Problem:** The action sets `enqueued = true` before calling `redirect(303, ...)`. SvelteKit's `redirect()` throws a `Redirect` object that the surrounding `try/catch` catches, then re-throws via `isRedirect(err) → throw err`. But the `finally` block reads `enqueued` and skips cleanup when `enqueued === true`. That's the right behavior in the success path (the worker now owns the temp dir), so the cleanup isn't actually a leak on this codepath. However, `enqueueJob` is awaited *before* `enqueued` is flipped, so the window from "enqueueJob completes" to "enqueued = true" is a narrow gap where a synchronous throw (e.g. an OOM during the `redirect` call itself) would leave the worker with a queued job pointing at a temp path the action then deletes. Reorder so `enqueued = true` is set immediately after `await enqueueJob(...)` and before any other expression. As written today the gap is exceedingly small but the contract is fragile — the next person who adds logging between those lines will introduce a real leak.

**Fix:** Move `enqueued = true` to the line immediately after `await enqueueJob(...)` (before the `redirect(...)` call). The current ordering puts `redirect(303, ...)` between the enqueue and the flag flip.

### MAJOR: revoke-session BC helper doesn't audit the better-auth call failure

**File:** `libs/bc/hangar/src/user-writes.ts` (lines 388-429)

**Problem:** `revokeUserSession` looks up the session token, calls `input.auth.api.revokeUserSession(...)` via `callAdmin` (which wraps in `BetterAuthApiError`), and *then* writes the audit row. If better-auth throws partway (e.g. session row is gone, network blip on the admin endpoint), no audit row is written but the session may have already been invalidated server-side (better-auth's revocation is mutate-then-respond). Sibling helpers (`setUserRole`, `banUserAction`, `unbanUserAction`) snapshot before/after via `getUser` / `readBanSnapshot` so the audit captures actual outcome — `revokeUserSession` writes `before: null, after: null`, so on a partial-failure the system loses the only record that the action was attempted at all. The user-detail audit panel will silently miss attempted-but-failed revokes.

**Fix:** Wrap the `callAdmin` in a try/catch that emits an audit row with `metadata.failed = true` (and the error message) on failure, then rethrows. Same change for `revokeAllUserSessions`. The audit row is the operator-facing record; "I tried to revoke and it threw" is exactly what the audit log exists to capture.

### MAJOR: source-jobs handlers run subprocess output unbounded — single huge stderr line can OOM the row insert

**File:** `libs/bc/hangar/src/source-jobs.ts` (lines 77-105, 195-216)

**Problem:** `installLineBuffer` accumulates stdout/stderr into per-stream arrays (`outLines`, `errLines`) with no max-size guard, and `runJob` formats the full stack trace as `${err.message}\n${err.stack ?? ''}` and writes it to `hangar.job_log` and `hangar.job.error` (both unbounded `text` columns). A misbehaving subprocess that emits a multi-MB single line, or a pathological recursive error stack, will land the entire blob in Postgres and ship it to every poll of the live-log endpoint. Worse, the diff-source handler returns `result.stdout.join('\n')` as `text` in the JSON result column (`source-jobs.ts:359`) — a noisy diff goes wholesale into `hangar.job.result` JSONB.

**Fix:** Cap log lines (truncate at e.g. 16 KiB per line, append `... [truncated]`) and the result text (cap at e.g. 256 KiB before writing to `result`). Same cap applies to the `error` column in `runJob`'s catch block. The cap should live in `@ab/constants` next to `SOURCE_ACTION_LIMITS` so the same limit applies everywhere.

### MINOR: `runJob` sets `status=failed` and writes `error` outside a transaction

**File:** `libs/hangar-jobs/src/worker.ts` (lines 194-216)

**Problem:** On handler throw, the worker writes the job row to `failed` (one UPDATE), then logs stderr (one INSERT), then audits (one INSERT). Each is a separate statement; a process crash between them leaves the row in `failed` without an audit emission, or vice versa. Same shape on the success path (lines 175-193). For cancellation (`cancelJob`, lines 264-281) the UPDATE returns rows + audit is a second statement — if the audit insert throws, the cancellation is durable but the audit log doesn't reflect it.

**Fix:** Wrap each terminal-state transition (`COMPLETE`, `FAILED`, `CANCELLED` — and the no-handler branch) in a `db.transaction(...)` so the row update + audit emission are atomic. The job-log line for stderr can stay outside; it's user-visible noise, not a compliance record. This is a minor severity because the job rows themselves are durable and the audit gap is recoverable from `hangar.job` directly, but the contract is "audit is the record", and the gap shouldn't exist.

### MINOR: enqueueJob audit emission isn't transactional with the insert

**File:** `libs/hangar-jobs/src/enqueue.ts` (lines 32-62)

**Problem:** Same shape as above — `db.insert(hangarJob).returning()` + `auditWrite(...)` are two statements. Crash between them leaves a queued job row with no audit emission. A crash *after* both is fine. Wrap in `db.transaction`.

**Fix:** `await db.transaction(async (tx) => { ... })` over the insert + audit.

### MINOR: source-form `delete` action under `/glossary/sources/[id]` doesn't reject hard-delete attempts when source still has dependent references

**File:** `apps/hangar/src/routes/(app)/glossary/sources/[id]/+page.server.ts` (delete action, lines 135-164)

**Problem:** `softDeleteSource` flips `deletedAt` + `dirty` (registry.ts:454-486). It does not check whether any non-deleted `hangar.reference` row still cites this source via `tags.sources[].sourceId`. The next `sync-to-disk` will emit references that cite a deleted source, and the verbatim resolver will fail at build time. The error path is recoverable (validation will catch it), but the form action could give a clean 409 instead.

**Fix:** Add a citation-count helper (`countReferencesCitingSource(sourceId)`) and refuse delete with a 409 + helpful message if non-zero. Alternative: let it through and rely on `validate-references` to catch it — that's the current de-facto behavior, but the operator UX is worse.

### MINOR: source-fetch / extract / build / diff handlers shell out via `bun scripts/...` from a node process

**File:** `libs/bc/hangar/src/source-jobs.ts` (lines 162-194)

**Problem:** `runReferenceScript` spawns `['bun', scriptPath, ...args]`. Per CLAUDE.md the runtime is bun, but hangar runs under node ("hangar runs under node in the SvelteKit server; bun only powers the dev tooling" — comment at line 64). The command relies on `bun` being on `PATH` of the server process. In a containerized prod deploy without bun installed, every text-source `fetch` / `extract` / `build` / `diff` job will fail at spawn time. There's no preflight check or fallback.

**Fix:** Add a single startup probe (`Bun.spawnSync` or `child_process.spawnSync('bun', ['--version'])` once at worker boot) that logs a clear warning if bun is missing on PATH. Long-term, port the CLIs to be node-runnable (they're TS modules; running via `node --import tsx` or compiling them is a one-time cost) so the hangar server doesn't depend on a sibling runtime. This is operational guidance, not a code defect — flagged as minor because it's the kind of thing that bites a fresh prod deploy at 2am.

### MINOR: `applySecurityHeaders` swallows errors silently

**File:** `apps/hangar/src/hooks.server.ts` (lines 76-88)

**Problem:** The `try { ... } catch {}` around the header sets is reasonable for streamed/binary responses with frozen headers, but it swallows the error without distinguishing "frozen headers" from a real bug. If a future response type starts throwing on `set('X-Content-Type-Options', ...)` for a different reason, the header just goes missing in prod silently and there's no signal.

**Fix:** Catch only the specific `TypeError` (Headers' "Headers object is immutable" thrown when frozen), or log at `debug` level so a deliberate operator can surface the cases that hit the catch. Same on lines 169-172 (request-id header).

### MINOR: appearance endpoint accepts JSON with no Content-Type / Origin check

**File:** `apps/hangar/src/routes/appearance/+server.ts`

**Problem:** The endpoint reads `await request.json()` without verifying `content-type` or origin. SvelteKit's CSRF protection covers `multipart/form-data` and `application/x-www-form-urlencoded` but JSON POST bypasses it. An attacker who lures a logged-in admin to a malicious page can POST `{value: 'dark'}` cross-origin and flip the user's appearance preference. The blast radius is trivial (cookie value), so this is minor — but the same shape exists for `/theme/+server.ts` (delegates to `createThemeEndpoint`), which sets a more substantive cookie.

**Fix:** Either reject when `request.headers.get('origin')` doesn't match the host, or require a known custom header (`X-Requested-With: fetch`) that the form posts but a cross-origin POST can't add without a preflight. Apply the same to the theme endpoint factory in `@ab/themes`. Real fix is to gate via SvelteKit's own form-action layer and drop the JSON endpoint entirely.

### MINOR: `getUser` left-join with sessions silently aggregates "lastSeenAt" without an index hint

**File:** `libs/bc/hangar/src/users.ts` (lines 178-220)

**Problem:** `getUser` builds a `bauthSession` GROUP BY subquery filtered to one user, then left-joins. The subquery scans by `userId` — if `bauth_session.user_id` lacks an index, the per-user load page does a full session-table scan. This is a schema concern (out of scope here) but the BC pattern would benefit from a comment pointing at the required index, since the loader is on the hot path for every admin user-detail view.

**Fix:** Add a comment in the BC referencing the required index (`bauth_session(user_id, created_at)`). If the index doesn't exist, that's a schema-review finding.

### NIT: `appendJobLog` MAX(seq)+1 has a TOCTOU race

**File:** `libs/hangar-jobs/src/enqueue.ts` (lines 128-140)

**Problem:** Two concurrent `appendJobLog` calls for the same job can both observe `MAX(seq) = N` and both try to insert `N+1`, hitting the unique constraint (assumed; verify in schema) or generating duplicate seq values. The worker uses an in-memory `seq++` per job (worker.ts line 103), so this only matters for non-worker callers (the `recoverOrphanedRunning` helper, future enqueue-time events). Today it's only called once per orphan from a single boot, so there's no actual race. Worth fixing prophylactically.

**Fix:** Wrap the insert in a `db.transaction` with a row-level lock on `hangarJob` for that id, or compute `seq` via `INSERT ... SELECT coalesce(max(seq)+1, 0)` in a single statement (the current `sql<number>` is in the values clause but not transactional with the surrounding row).

### NIT: `softDeleteReference` returns `existing` on already-deleted without bumping rev

**File:** `libs/bc/hangar/src/registry.ts` (lines 285-317)

**Problem:** When `existing.deletedAt !== null`, the function returns the existing row silently without throwing or auditing. The form action treats a 200-equivalent return as success and redirects. This is the documented "idempotent delete" behavior, but the audit log doesn't reflect that the user clicked delete — there's no record that an admin tried to delete an already-deleted row. Same in `softDeleteSource` (registry.ts:454).

**Fix:** Either throw `NotFoundError` (consistent with hard-not-found behavior) or emit an audit row with `metadata: { idempotent: true }`. Operator-facing concern: low.

### NIT: `getActiveJobForTarget` pre-check race vs worker claim

**File:** `apps/hangar/src/routes/(app)/sources/[id]/+page.server.ts` (lines 96-108) and `upload/+page.server.ts` (lines 70-75)

**Problem:** The "is there already an active job?" check is a separate read from the `enqueueJob` insert. Two operators clicking simultaneously can both pass the check and both enqueue. The worker's per-targetId serialization handles the actual run-order, so the second job will sit queued until the first finishes — which is fine, but the operator who clicked second sees the redirect to a job that isn't running and may panic. This is documented in the comments ("the worker will serialise...") and is explicitly described as defense-in-depth, so it's a known design choice. Worth a `SELECT ... FOR UPDATE` upgrade if duplicate-enqueues become a UX complaint.

**Fix:** Optional: wrap the check + enqueue in a transaction with `SELECT ... FOR UPDATE` against `hangarSource(id)` so the read-then-write is serialized at the row level. Today's behavior is correct; just slightly worse UX under contention.

## Status as of 2026-05-04

| Finding | Verdict | Closure |
| ------- | ------- | ------- |
| MAJOR: actor chip resolution by name not id | CLOSED | PR #438 -- `getActorById` BC helper + isLikelyAuthId routing in `audit-queries.ts:351-377` |
| MAJOR: temp upload dir leak ordering | CLOSED | PR #463 -- `enqueued = true` set immediately after `await enqueueJob` (load-bearing comment at `upload/+page.server.ts:91-97`) |
| MAJOR: revoke-session helper doesn't audit failure | CLOSED | PR #463 -- failure-audit + rethrow on `revokeUserSession` and `revokeAllUserSessions` |
| MAJOR: source-jobs subprocess output unbounded | CLOSED | PR #467 wave -- per-line + result + error caps via `SOURCE_ACTION_LIMITS` constants |
| MINOR: terminal-state writes outside transaction | CLOSED | PR #436 -- terminal writes in `db.transaction` |
| MINOR: enqueueJob audit non-transactional | CLOSED | PR #436 -- `db.transaction` over insert + audit (`enqueue.ts:38`) |
| MINOR: source delete with dependent references | CLOSED | PR #467 wave -- 409 with citation-count helper |
| MINOR: source-jobs shells `bun` from node | CLOSED | PR #467 wave -- preflight probe + warning log on missing bun |
| MINOR: applySecurityHeaders swallows errors | CLOSED | PR #467 wave -- typed-error narrowing + debug logging |
| MINOR: appearance endpoint no Content-Type / Origin | CLOSED | PR #467 -- locals.user gate + Origin check |
| MINOR: getUser left-join missing index hint | CLOSED | Chunk-3 PR #426 -- index added on `bauth_session(user_id, ...)` |
| NIT: appendJobLog MAX(seq)+1 TOCTOU | CLOSED | PR #448 -- atomic seq allocator |
| NIT: softDeleteReference no audit on idempotent | CLOSED | PR #467 wave -- `metadata.idempotent: true` audit row |
| NIT: getActiveJobForTarget pre-check race | CLOSED | Documented MVP trade-off; FOR UPDATE upgrade deferred |

Total: 14 closed / 0 open. `review_status` was already `done` -- preserved.
