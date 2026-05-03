---
feature: hangar-cluster
category: dx
date: 2026-05-02
branch: main
counts:
  critical: 0
  major: 4
  minor: 7
  nit: 4
status: unread
review_status: done
---

## Summary

The hangar cluster is generally well-instrumented for 2am debugging: every job carries a streamed `hangar.job_log` with stdout/stderr/event channels, every form action threads `requestId`, and the DB writes that follow each handler call land both an audit row and a job-result row. Module-level docstrings are unusually thorough; most files open with a 5-15 line preamble that explains *why*, not just *what*. That is the strongest single DX feature in the cluster.

The weak spots are concentrated where a job fails. Specifically:

1. The worker captures the failed-handler error to `hangar.job.error` and a single `stderr` log line, but the `auditWrite` after each step in the binary-visual fetch (`source-fetch.ts`) only fires on success, so an audit-log search for "what happened to source X at 02:14" misses every failed run. The job log is the only trail for failures.
2. Several `catch {}` blocks (worker boot recovery audit, swallowed thumbnail/drift errors in `source-fetch`, the `setInterval` cancel poll) discard the error object entirely - if ENOSPC or a deadlocked transaction is the root cause, the operator gets a job-stuck-running with no breadcrumb.
3. A handful of error messages are good for a human staring at the Job Detail page but bad for grep: `'cancel failed'`, `'delete failed'`, `'path escape'`, `'invalid filename'` - none of these include the offending value, source id, or original error text, so the operator must drill into a different log to find out which file/path/source was rejected.
4. The `worker.ts` happy path has no `running -> queued` recovery beyond boot-time `recoverOrphanedRunning`. If the server stays up but the in-memory worker promise hangs (e.g. a stuck `await`), there is no liveness signal, no per-job heartbeat, and no max-runtime kill switch. At 2am, "the worker is alive but stuck on job X" looks identical to "the worker is making progress."

The session-revoke / ban / role-change path is the cleanest in the cluster: typed errors (`SelfTargetForbiddenError`, `LastAdminError`, `BetterAuthApiError`), strong audit before/after snapshots, and a 1:1 mapping between thrown error class and `fail()` status code. Recommend that pattern be the template the source-job handlers copy.

## Issues

### MAJOR: Failed binary-visual fetch leaves only the job-log trail; no audit row for failure

File: `libs/bc/hangar/src/source-fetch.ts:247-473`

Problem: `runSectionalFetch` writes one `auditWrite({ targetType: AUDIT_TARGETS.HANGAR_SOURCE, ..., outcome: 'fetched' })` only at the end, and side-channel audit rows for `HANGAR_SOURCE_EDITION_RESOLVED`, `HANGAR_SOURCE_EDITION_DRIFT`, and `HANGAR_SOURCE_THUMBNAIL_GENERATED` only fire on the success branch. If the download throws (network blip, disk full at line 326), the rename throws (line 362), or the thumbnail generator dies on a malformed zip (line 377), the only persistent trail is the worker's `await ctx.logStderr(message)` (`worker.ts:196`) plus the `hangar.job.error` column.

That is fine for a developer who knows to open `/jobs/[id]`, but the operator scanning `audit_log` for "what touched source `src_pdx_sectional` in the last 24 hours" will see no row and conclude nothing happened. The drift-on-sha-mismatch branch already audits the failure (line 336) - the rest of the failure modes need the same treatment.

Fix: Wrap the body of `runSectionalFetch` in a `try { ... } catch (err) { auditWrite({ outcome: 'failed', errorMessage: err.message, step: <last step reached> }); throw; }` so every failed run leaves an audit breadcrumb tagged with the step it crashed in. Worker's existing audit-on-failure (`worker.ts:205-214`) covers `HANGAR_JOB`; this one needs to cover `HANGAR_SOURCE` so a per-source query finds it.

---

### MAJOR: `worker.ts` swallows handler crash detail when audit write itself fails

File: `libs/hangar-jobs/src/worker.ts:194-215`

Problem: When a handler throws, the worker does:

```typescript
const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
await ctx.logStderr(message);
await db.update(hangarJob).set({ status: FAILED, error: message, ... });
await auditWrite({ ... metadata: { status: FAILED, error: message } });
```

Three sequential awaits, no inner try. If the `db.update` throws (transaction conflict, db disconnect mid-failure - the most likely scenario when a handler is also failing), `auditWrite` never runs and the job is left in `running` state until the next worker reboot. Worse, if `ctx.logStderr` itself throws (insert failure on `hangar.job_log`), the `db.update` and `auditWrite` are also skipped, and the job appears running forever with no error column populated.

This is the single most likely "ghost running job" path. The boot-time `recoverOrphanedRunning` fixes it on next restart, but in a long-running prod process the job is invisible until somebody notices.

Fix: Wrap each terminal write in its own try/catch with a fallback `console.error` (or `log.error` via `createLogger`) so at least the runtime log carries the trace, and ensure the `db.update` to FAILED runs even if the log/audit writes fail. Alternative: a single `db.transaction` for the three writes, with a backup outside-tx `console.error` if the transaction itself fails.

---

### MAJOR: `setInterval(cancelPoll)` in `nodeSpawnRunner` swallows isCancelled errors

File: `libs/bc/hangar/src/source-jobs.ts:107-111`

Problem:

```typescript
const cancelPoll = setInterval(async () => {
  if (await isCancelled()) {
    child.kill('SIGTERM');
  }
}, CANCEL_POLL_INTERVAL_MS);
```

`isCancelled()` does a `db.select(...).from(hangarJob)` - which can throw on connection loss or query timeout. The interval callback is `async`, so the rejection becomes an unhandledRejection and is silently absorbed by Node's default handler. From the operator's perspective, the cancel button stops working with zero log signal.

Fix: Wrap the body in `try { ... } catch (err) { log.error('cancel poll failed', { jobId: ..., err }); }`. The log line is the only way the 2am operator finds out the cancel button is busted.

---

### MAJOR: No worker liveness signal or per-job heartbeat

File: `libs/hangar-jobs/src/worker.ts:218-241`

Problem: Once a handler `await`s into a long subprocess (extract on a 200 MB FAA handbook PDF, fetch on a slow upstream), the only outward sign the worker is alive is whatever the handler chooses to emit via `ctx.logEvent`/`ctx.logStdout`. There is no:

- Heartbeat on `hangar.job` (no `last_heartbeat_at` column update from inside `runJob`).
- Worker-level `onIteration` is called per claim sweep, but with no DB write, so an external monitor cannot tell "worker still polling" from "worker hung at iteration N."
- Max runtime / soft timeout per kind. A handler that hangs forever holds the targetId slot indefinitely.

A 2am operator looking at "fetch-source job has been running for 47 minutes" cannot answer "is it making progress or stuck?" without trusting that the handler chose to emit log lines on a regular cadence.

Fix: Add `lastHeartbeatAt` column on `hangar.job` and update it from inside `runJob` on a 5s timer (clear it when the handler returns or throws). Surface "stale heartbeat" state on the `/jobs/[id]` page. Optional: per-kind max runtime in `JOB_KINDS` with an automatic `cancel` when exceeded. Lower-cost interim: have `worker.ts:loop` write the iteration counter to a small `hangar.worker_state` row so an external probe can verify the loop is alive.

---

### MINOR: Generic "delete failed" / "cancel failed" / "path escape" messages drop the offending value

File: `apps/hangar/src/routes/(app)/sources/[id]/files/+page.server.ts:232`, `apps/hangar/src/routes/(app)/jobs/[id]/+page.server.ts:57`, `apps/hangar/src/routes/(app)/sources/[id]/files/raw/+server.ts:60-65`, `apps/hangar/src/routes/(app)/sources/[id]/thumbnail/+server.ts:39`

Problem: The user-facing strings are fine, but the underlying `log.error('archive delete failed', ...)` does include the error object, so the journal line carries the cause. However, `path escape` and `invalid filename` thrown via `error(400, '...')` do *not* log anywhere - they exit through SvelteKit's `handleError` with no extra context. A symlink-driven escape attempt under `<blob-root>/sectional/x/2026-04-01/` shows up in the server log only as a 400 with no reference to the rejected path, the source id, or which check fired (early `..` reject vs. resolve-prefix vs. extension mismatch).

Fix: Before each `throw error(400, ...)` in `files/raw/+server.ts` and `thumbnail/+server.ts`, add `log.warn('path escape rejected', { sourceId, name, full, blobRoot, reason: '...' })`. The user-visible string can stay terse; the journal line gives the on-call a starting grep target.

---

### MINOR: `formatPrBody` puts `actorId` in the PR body raw - not user-friendly, not greppable

File: `libs/hangar-sync/src/commit-and-maybe-pr.ts:67-83`

Problem: The PR body emits `## Actor` with the literal `actorId` (a `usr_ULID`). For a 2am operator chasing "who triggered the bad sync that landed on main last night," that is one extra hop (cross-reference the ULID against `bauth_user`). The audit row already has `actorEmail`; the PR body could carry it too.

Fix: Pass `actorEmail` (or `actorName`) through `commitAndMaybePr` -> `formatPrBody` and emit both. Also emit the `commitSha` and `syncLog.id` for round-trip traceability.

---

### MINOR: `recoverOrphanedRunning` writes a `recovered from worker restart` log line per orphan but never records the orphan count anywhere queryable

File: `libs/hangar-jobs/src/enqueue.ts:146-165`

Problem: The function returns the count, and `hooks.server.ts` logs it via `log.info('hangar worker recovered orphaned jobs', { metadata: { recovered } })`. But the count is not persisted - if the dev tail of stdout missed the line (process restarted, log rotated), nobody can later answer "how many jobs got reset on the last reboot?". Also, the per-job `recovered from worker restart` log line lacks any context: no prior `running` duration, no prior progress message, no actor.

Fix: Either (a) write a single `hangar.sync_log` style "worker recovery" row per boot recording `{ recoveredCount, recoveredJobIds, bootAt }`, or (b) carry the prior `progress.message` and `startedAt` into the `recovered` log line so the next-run handler can quote what was in flight when the worker died.

---

### MINOR: `ProcessError.message` truncates stderr and drops stdout

File: `libs/hangar-sync/src/git.ts:45-53`

Problem:

```typescript
super(`${call.cmd} ${call.args.join(' ')} exited ${result.exitCode}: ${result.stderr.trim()}`);
```

`stderr.trim()` could be empty (git often writes nothing to stderr on certain failures - it puts the error on stdout). When that happens, the thrown error reads `git push -u origin foo exited 1:` - dead-end at 2am. The class does retain `stdout`/`stderr` as fields, so a debugger hop saves it, but the default `err.message` is what hits the job-log via `worker.ts`.

Fix: Fall back to `stdout.trim()` if `stderr` is empty. Better: include both in the message, separated by a marker, capped at e.g. 4 KiB so a giant stdout dump does not blow up the audit metadata.

---

### MINOR: `defaultReadArchive` zip-format errors mention the file path but not the source/job id

File: `libs/bc/hangar/src/source-fetch.ts:138-179`

Problem: Errors here read `zip: end-of-central-directory not found in /Users/joshua/Documents/airboss-handbook-cache/hangar-blobs/sectional/src_pdx_sectional/2026-04-01/chart.zip`. That tells you the path but not the job id, source id, or expected edition. The catch in `runSectionalFetch:370` softens the failure to `archive manifest read failed: ...`, which is fine, but the other three throws (line 154, 160, 168) propagate to the worker as fatal handler errors with only the path - the job id and source id you need to pull the full audit chain are buried in `ctx.job`, not the message.

Fix: Take a `context` arg into `defaultReadArchive` (or inline these throws into `runSectionalFetch` where `row.id` and `ctx.job.id` are in scope) and prefix every thrown message with `[job=<jobId> source=<sourceId>]`. Mirrors how `upload-handler.ts:69-80` already prefixes `upload job <jobId>:` to its messages.

---

### MINOR: `appendJobLog` does a SQL subquery for `MAX(seq)+1` per call - per-line cost, no batching

File: `libs/hangar-jobs/src/enqueue.ts:128-140`

Problem:

```typescript
const nextSeq = sql<number>`coalesce((select max(${hangarJobLog.seq}) from ${hangarJobLog} where ${hangarJobLog.jobId} = ${input.jobId}), -1) + 1`;
```

This is correct but expensive per line. The worker's `ctx.logStdout`/`ctx.logStderr` use a local counter (good), but any out-of-worker caller (recovery, e2e tests, future scripts) hits this path. If a future feature streams a 50k-line extract log via `appendJobLog`, the table scan becomes a quadratic hot spot. Not a 2am bug today, but the kind of thing that *becomes* a 2am bug under load.

Fix: Document the per-call cost in the docstring and recommend the local-counter pattern (`makeContext` in `worker.ts`) for any caller emitting > a handful of lines. Optional: add a `seq SERIAL` style fallback, or accept a `nextSeq` callback so callers can hold their own counter.

---

### MINOR: `updateSource` / `updateReference` rev-conflict messages do not name the conflicting actor

File: `libs/bc/hangar/src/registry.ts:248-251, 277-279, 298-300, 415-419, 446-448, 478-481`

Problem: `RevConflictError` messages read `reference 'foo' is at rev 7; submitted rev 6 is stale`. That tells the user their submission is stale, but at 2am - when an operator is pinning down "did sync clobber my edit?" - the missing piece is *who* bumped the rev. The audit log has it, but the error message that lands on the form does not.

Fix: Read `bauth_user` for `existing.updatedBy` and surface `... is stale (last updated by alice@airboss.test at 02:13:14Z)`. Caller cost is one extra select per conflict, paid only on the rare conflict path.

---

### NIT: `void log; void basename; void dirname;` at the bottom of `source-fetch.ts` is a smell, not an error-suppression idiom

File: `libs/bc/hangar/src/source-fetch.ts:540-543`

Problem: The comment `// Silence unused-var warning when log gated out in prod builds; kept for debug hooks.` covers `log`, but `basename` and `dirname` are imported and silenced, which means the code does not actually use them - the void statements just mute biome. A future reader trying to figure out "where do we use basename in this module?" follows the import, finds the void, and spends 30 seconds making sure nothing actually relies on them.

Fix: Remove the unused imports. If the `log = createLogger('hangar:source-fetch')` is truly only there for ad-hoc debug, comment that explicitly and drop the `void`.

---

### NIT: `makeContext` increment-via-closure has no guard against caller racing the counter

File: `libs/hangar-jobs/src/worker.ts:102-146`

Problem: `seq++` is fine for the single-handler case, but `JobContext` is handed to a handler that can fan out work. If a handler does `await Promise.all([ctx.logStdout('a'), ctx.logStdout('b')])`, both writes share `seq` (they both read `seq=N` before either increments). DB unique-key on `(job_id, seq)` would catch it; without that constraint (`schema.ts` would need to confirm), you get duplicate seq numbers and the cursor-polling endpoint produces garbled order.

Fix: Verify there is a `UNIQUE(job_id, seq)` constraint in `schema.ts`. If not, either add one or wrap the increment in `await`-serialised form (`await writeLine; seq++` is already sequential per call, but the compound `(seq++, db.insert(... seq))` has the read-before-write race when callers run two log writes concurrently).

---

### NIT: `formatSummary` and `conflictMessage` in `run-sync-job.ts` build sentences with English plural rules inline

File: `libs/hangar-sync/src/run-sync-job.ts:139-147, 180-181`

Problem: `entr${len === 1 ? 'y' : 'ies'}` and `reference${ref === 1 ? '' : 's'}` are correct but cluttered, and the pattern is duplicated three or four times across the cluster. A small `pluralize(n, 'entry', 'entries')` helper in `@ab/utils` would clean every callsite up.

Fix: Extract to a helper. Low priority but reduces "is this off-by-one a typo?" churn during reviews.

---

### NIT: `bootWorker()` swallows boot failure with a single error log

File: `apps/hangar/src/hooks.server.ts:38-41`

Problem:

```typescript
} catch (err) {
  log.error('hangar worker failed to start', undefined, err instanceof Error ? err : undefined);
}
```

Boot failure leaves `worker = null` forever; every subsequent request still serves UI, every form action still calls `enqueueJob` (which writes a `queued` row), but no worker is polling. The UI shows "queued" forever with no signal that the worker is dead. The boot-fail log line is the only breadcrumb, and if it scrolled off journal it is gone.

Fix: Write a `hangar.worker_state` row (or a `hangar.sync_log` "boot-failed" entry) on boot failure, and surface a banner on `/jobs` when the worker has not heartbeat in N seconds. At minimum, retry boot on an exponential backoff rather than giving up after one attempt. The current single-shot is the worst of both worlds: it neither crashes loudly (so a process supervisor restarts it) nor recovers itself.

## Status as of 2026-05-04

| Finding | Verdict | Closure |
| ------- | ------- | ------- |
| MAJOR: failed binary-visual fetch leaves only job-log trail | CLOSED | PR #442 -- try/catch with audit emission on every terminal state including failure (closes per-source audit gap) |
| MAJOR: worker.ts swallows handler crash detail | CLOSED | PR #436 -- terminal writes in `db.transaction`; per-write try/catch with `console.error` fallback |
| MAJOR: setInterval(cancelPoll) swallows errors | CLOSED | PR #436 -- try/catch + log.error on `isCancelled` failure |
| MAJOR: no worker liveness signal | CLOSED | PR #436 -- `lastHeartbeatAt` column on `hangar.job` updated by `heartbeat()` (`worker.ts:369-380`) |
| MINOR: generic error messages drop offending value | CLOSED | PR #467 wave -- log.warn lines now carry sourceId/jobId/path context |
| MINOR: formatPrBody uses raw actorId | CLOSED | PR #467 wave -- actorEmail + commitSha + syncLog.id added to PR body |
| MINOR: recoverOrphanedRunning count not queryable | CLOSED | PR #436 -- audit row per orphan + boot-summary log entry; recovery-event constants under JOB_AUDIT_REASONS |
| MINOR: ProcessError.message truncates stderr | CLOSED | PR #467 wave -- stdout fallback + cap on combined output |
| MINOR: defaultReadArchive errors lack source/job context | CLOSED | PR #467 wave -- inline throws now include `[job=... source=...]` prefix |
| MINOR: appendJobLog MAX(seq) per-call cost | CLOSED | PR #448 -- atomic seq allocator via `nextLogSeq` column + UNIQUE(job_id, seq) constraint |
| MINOR: rev-conflict messages don't name the actor | CLOSED | PR #467 wave -- conflict message includes `last updated by ...` |
| NIT: `void log; void basename; void dirname;` smell | CLOSED | PR #467 wave -- unused imports removed |
| NIT: makeContext seq counter race | CLOSED | PR #448 -- DB-side atomic seq allocator (UNIQUE constraint enforces) |
| NIT: formatSummary inline plural rules | CLOSED | PR #467 wave -- `pluralize(n, sing, plural)` helper in `@ab/utils` |
| NIT: bootWorker swallows boot failure | CLOSED | PR #436 -- exponential-backoff retry + `worker_state` heartbeat surfacing on /jobs |

Total: 15 closed / 0 open. `review_status` was already `done` -- preserved.
