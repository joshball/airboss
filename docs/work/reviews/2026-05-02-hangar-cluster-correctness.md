---
feature: hangar-cluster
category: correctness
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 2
  major: 6
  minor: 7
  nit: 3
---

## Summary

Reviewed chunk 6 (apps/hangar, libs/hangar-jobs, libs/hangar-sync, libs/bc/hangar) for correctness: logic errors, null/undefined safety, type integrity, edge cases, error handling, data integrity, async correctness. Special focus on job-queue idempotency/cancellation, TOML sync round-trip, upload validation, and `user-writes.ts` permissions.

The architecture is generally sound: optimistic-rev concurrency on registry rows, advisory-lock + per-targetId serialisation on sync, route-side path-traversal guards, audit writes on every BC mutation. The defects below are concentrated around three convergent themes:

1. **Cancellation/terminal-status races.** The worker and the sync-log writer both unconditionally overwrite job/log statuses set by other actors (`cancelJob`, mid-sync abort). A user-cancelled job that completes its handler ends up `status=complete` instead of staying `cancelled`.
2. **Upload-handler same-version overwrite.** Re-uploading with the same version but different bytes silently overwrites the prior on-disk binary without archiving — undetectable data loss.
3. **Upload archive race.** `archive` and `rename(tmp -> destPath)` are not atomic. A crash between them leaves the source row pointing at a missing file.

Plus a series of minor defensive gaps in cursor decoding, Bun-vs-node spawn semantics, env-var parsing, and audit-cursor handling.

## Issues

### CRITICAL: cancelled job overwritten back to `complete`/`failed` by worker

File: `libs/hangar-jobs/src/worker.ts:175-215`

Problem: When a user calls `cancelJob` while a handler is mid-execution, the row goes to `status=cancelled`. If the handler doesn't actually short-circuit on `ctx.isCancelled()` (most don't poll between every step) and runs to completion, `runJob` unconditionally writes `status=complete` (line 175-182) or `status=failed` (line 197-204) on top of the cancelled status. The cancellation is lost; the audit row claims completion. Same defect for the `no handler` failure path (line 151-158).

Trigger: User clicks "Cancel" on `/jobs/[id]`. Worker has already loaded the row and is mid-handler; `cancelJob` flips the row to `cancelled`. Handler returns normally a few seconds later. Final state: `status=complete`, contradicting the user's cancel and the audit log.

Fix: Make all three terminal updates conditional on the row still being `running`:

```typescript
.where(and(eq(hangarJob.id, job.id), eq(hangarJob.status, JOB_STATUSES.RUNNING)))
```

When the update returns 0 rows, log an event line ("preempted by cancel") and skip the audit write. This preserves the user's cancellation as the terminal state.

### CRITICAL: same-version re-upload silently overwrites without archive

File: `libs/bc/hangar/src/upload-handler.ts:102-113`

Problem: The archive branch is gated on `versionChanged && pathExists(destPath)`. When the user uploads a new file with the SAME version string but a different sha (e.g. corrected scan, errata patch), `versionChanged` is false, no archive happens, and `fs.rename(tempPath, destPath)` (line 112) overwrites the prior binary with no recovery path. The DB row's checksum is updated to the new sha, so even the "what was there before" pointer is gone. This is silent data loss.

Trigger: Operator re-uploads the same regulatory document edition because the previous PDF was missing pages. The original (the one that's been cited by references in production) is overwritten irrecoverably.

Fix: Always archive an existing destPath before overwriting, gated on `existing.checksum !== sha256` rather than `versionChanged`. Use a synthetic suffix when versions collide (e.g. `${sourceId}@${version}-${shaPrefix}.${ext}`) so multiple same-version uploads don't clobber each other. Keep `versionChanged` only as the "advance archive retention slot" trigger.

### MAJOR: upload archive + rename is not atomic

File: `libs/bc/hangar/src/upload-handler.ts:104-112`

Problem: The flow is: (1) `fs.rename(destPath, archivePath)` to archive prior, (2) `fs.rename(tempPath, destPath)` to install new. If the process crashes between (1) and (2), the source row still has `path = <type>/<sourceId>.<ext>` but no file is there — the prior was just archived under `<sourceId>@<version>.<ext>`, and the new file is still at `tempPath` (likely outside the blob root, since the upload action wrote it under `os.tmpdir()`).

Trigger: Worker host OOM, deploy restart, manual SIGTERM during upload-source job. The `recoverOrphanedRunning` path requeues the job, but the temp file is gone (cleaned by OS) and the destPath now points at nothing.

Fix: Either (a) copy `tempPath` to a stage path inside `destDir` first, then do `rename(stage -> destPath)` after the archive rename so both renames are within the same filesystem and the recovery path can detect the half-state; or (b) write a small `.upload-in-progress` sentinel beside the archive containing the prior path so a crashed mid-flow can be recovered/rolled back at boot. At minimum, the orphaned-running recovery should attempt to restore from `archivePath -> destPath` if `destPath` is missing and the archive matches the prior checksum.

### MAJOR: orphaned-running recovery never updates audit log

File: `libs/hangar-jobs/src/enqueue.ts:146-165`

Problem: `recoverOrphanedRunning` flips `running -> queued` and writes a job-log line, but does not write an audit row. The cancellation/completion/failure paths all audit; the silent recovery doesn't. This breaks the "every state transition is audited" contract that audit-explorer relies on. The recovered job's eventual completion produces an audit row that has no predecessor for the prior `running` state.

Trigger: Worker crashes mid-job, restart triggers recovery, audit-explorer shows a `running` -> `complete` transition with no `recovered` event in between.

Fix: Add an `auditWrite({ op: AUDIT_OPS.UPDATE, targetType: AUDIT_TARGETS.HANGAR_JOB, metadata: { reason: 'recovered-from-restart' } })` per recovered row (loop already exists at line 161-163 for the log line).

### MAJOR: claimNext race when targetId-locked job clears mid-iteration

File: `libs/hangar-jobs/src/worker.ts:74-100`

Problem: `claimNext` builds `lockedTargets` from `runningTargets` at SELECT time. Between the SELECT and the conditional UPDATE, a job's `finally` callback (line 229-232) can remove its targetId from `runningTargets`. The next iteration's SELECT will then race-pick the same queued row and the UPDATE's `where status=queued` saves us — but inside the same iteration's inner while-loop (line 223), we may pick another job whose targetId was *just* freed and immediately starts running. That second pick can violate the same-target invariant if a second queued job for that targetId exists, because we read `lockedTargets` once per `claimNext` call (which is once per iteration of the inner while). Actually re-reading: `claimNext` is called inside the inner while loop, so `lockedTargets` is re-snapshot each call. Race window is narrow but real: handler A finishes → finally removes target T from runningTargets → claimNext sees T unlocked → claims queued job B for T → meanwhile inner while still has handler A's promise resolving its DB writes (audit, status=complete) and the worker has already started B.

Trigger: Two queued jobs for the same source. Job A finishes; job B is picked up before A's audit/status writes have committed, leading to interleaved audit rows and timestamps.

Fix: Either gate `runningTargets.delete` until after the post-handler DB writes have finished (move the `finally` after `runJob` resolves entirely), or hold the targetId in `runningTargets` for an extra tick to ensure transaction commit ordering. Simpler: replace the in-memory set with a per-targetId advisory lock the handler takes on entry and releases on commit.

### MAJOR: detectDrift loses fields where TOML round-trip is non-canonical

File: `libs/hangar-sync/src/detect-drift.ts:124-175`

Problem: `detectDrift` compares the DB-derived `encodeReferences([single])` against the on-disk per-block body. If the on-disk file was written by a non-canonical encoder (hand-edit, older codec version, locale-dependent number formatting), every row reads as drifted-on-disk even when semantically identical. The DB-as-truth model recovers (we re-emit and overwrite), but `differsOnDisk` is reported as true for every row in the file, which could incorrectly inflate the drift report and trigger downstream noise (sync_log rows, audit metadata).

Also: `parseReferencesFromToml` splits on the LITERAL line `[[reference]]`. If a future encoder change puts the marker on the same line as a comment (`[[reference]] # id=foo`), splitting fails silently and the affected blocks are dropped from `glossaryOnDisk`, making the row look like a "new addition" rather than drift.

Trigger: Operator hand-edits glossary.toml to fix a typo. Next sync reports every other reference as drifted-on-disk because the hand-edit perturbed whitespace or trailing newlines.

Fix: Parse the on-disk TOML semantically (use `decodeReferences` from `@ab/aviation`) rather than string-comparing the encoded form. Compare the decoded domain objects deeply. The current string compare is brittle and only correct when the on-disk file was last written by the same codec version.

### MAJOR: detectConflict skips newly-created rows entirely

File: `libs/hangar-sync/src/detect-conflict.ts:44-66`

Problem: `detectConflict` only flags rows whose `currentRev > baselineRev`. Ids present in `currentRevs` but absent from the baseline are explicitly skipped (line 51, 59) under "newly-created rows cannot be in conflict". But this misses the case where a row was *deleted* between syncs: the baseline contains an id that the current rev map does not. The reverse-direction check (baseline ids missing from current) is never done, so a row deleted by another actor between two sync attempts disappears with no conflict warning.

Trigger: Two operators editing simultaneously — A deletes reference X (sync N records baseline including X), B starts a new sync after A's delete. Sync N+1 sees X missing from current rev map; detectConflict ignores it. The next sync proceeds and rewrites the TOML without X — fine in isolation, but no audit hint that another writer was involved.

Fix: Walk the baseline keys after the current-revs walk; for any baseline id missing from `currentRevs`, push a conflict entry with a "deleted" marker so the operator sees what changed. Decide product-side whether deletes between syncs should block-and-warn or just record; capture the choice in design.md.

### MAJOR: audit-cursor decode allows overlapping `::` inside id

File: `libs/bc/hangar/src/audit-queries.ts:97-107`

Problem: `decodeAuditCursor` uses `raw.indexOf(CURSOR_DELIMITER)` to split on the FIRST `::`. Audit ids are `aud_${ULID}` (no colons), so this is fine TODAY. But the cursor format is also exposed in URLs (clients can craft any string), and a `?cursor=2026-05-01T00:00:00.000Z::aud_xxx::extra` is parsed with `id = "aud_xxx::extra"`. This is then injected via parameterised SQL so it's not an injection risk, but it does mean stale or malformed cursors silently match no rows instead of returning to page 1.

Worse: a cursor of `2026-05-01T::abc` parses successfully (`new Date('2026-05-01T')` returns Invalid Date — actually no, `Number.isNaN(ts.getTime())` catches that). OK.

The bigger issue: `(timestamp, id) < (cursorTs, cursorId)` keyset is correct, but `lastIndexOf` rather than `indexOf` would be safer if the id ever gains a `::` (ULIDs don't, but the fallback is brittle).

Trigger: Hand-crafted URL by an operator pasting a stale cursor. Page silently shows wrong rows instead of resetting.

Fix: Use `lastIndexOf(CURSOR_DELIMITER)` to split, or validate the id half against the audit-id regex `/^aud_[0-9A-HJKMNP-TV-Z]+$/` before accepting the cursor.

### MINOR: zip64 archive silently produces no manifest entries

File: `libs/bc/hangar/src/source-fetch.ts:158-178`, called from `runSectionalFetch:367-373`

Problem: `defaultReadArchive` throws "zip64 not supported" for archives with a 0xFFFFFFFF central-directory offset. Inside `runSectionalFetch`, that error is caught (line 370-372) and `archiveEntries = []` is set. The thumbnail/meta/DB update all proceed with an empty manifest. The error is logged to stderr but the job completes successfully. Operators have no signal that the manifest was lost — the `media.archiveEntries: []` looks indistinguishable from a degenerate-but-valid empty archive.

Trigger: FAA publishes a sectional archive >4GiB (will happen eventually with high-res raster updates).

Fix: Either (a) re-throw zip64 errors so the job fails loudly and the operator knows to upgrade the reader, or (b) record the failure mode in `media` (e.g. `archiveEntries: null` + `archiveError: 'zip64-unsupported'`) so the surface can flag it.

### MINOR: nodeProcessRunner ignores stdin write errors

File: `libs/hangar-sync/src/git.ts:79-84`

Problem: `child.stdin.write(call.stdin)` then `child.stdin.end()` in the default runner doesn't await flush or check for EPIPE. If the child dies before consuming stdin (e.g. `gh pr create` crashes pre-stdin), the write throws asynchronously and is unhandled. Node logs an `uncaughtException` and may exit the worker process.

Trigger: `gh` is not authenticated, errors before reading stdin. Worker process exits unexpectedly.

Fix: Wrap the stdin writes in `try/catch` or attach `child.stdin.on('error', () => {})` before writing.

### MINOR: writeAllFiles writes sequentially with no rollback

File: `libs/hangar-sync/src/commit-and-maybe-pr.ts:89-95`

Problem: `writeAllFiles` writes glossary.toml, sources.toml, aviation.ts in sequence. If write 2 fails (disk full, permissions), write 1 has already landed. The function throws, but `git add` is never called — so the partial write sits on disk uncommitted. The next sync will see drift and try to re-emit, but the half-written state means the operator's working tree is dirty in a way unrelated to their intent. Combine with detectDrift's brittle string-compare and you get false-drift warnings on every subsequent sync.

Trigger: Out-of-disk during a sync. Half-written sources.toml, missing aviation.ts.

Fix: Write all files to `<path>.tmp` first, then atomically rename in a second pass. If any write fails, remove the .tmp files before throwing — the working tree is unchanged.

### MINOR: rotateArchives keeps current edition counted in retention

File: `libs/bc/hangar/src/source-fetch.ts:226-243`

Problem: Comment says "Rotate previous edition directories so the latest ARCHIVE_RETENTION are preserved". The implementation keeps `RETENTION-1` previous editions (line 237), which means total kept = current + RETENTION-1 = RETENTION. The comment is correct only if you consider the current edition part of the retention count. The `pickArchivesToPrune` helper for upload-handler does NOT count the current; `archives.length <= keep` keeps `keep` archives PLUS the current binary. The two retention semantics differ and operators reading `ARCHIVE_RETENTION = N` will reasonably guess "N archives, plus current".

Trigger: Operator sets `ARCHIVE_RETENTION = 3` expecting 3 prior + current. Upload behaves as expected; sectional fetch keeps only 2 prior + current.

Fix: Pick one semantic and apply both. If RETENTION means "max prior versions to keep on disk", use `slice(0, RETENTION)` in rotateArchives and remove the `-1`. If it means "max files including current", use `RETENTION - 1` in both. Document in the constant's JSDoc.

### MINOR: upload version-only changes silently no-op

File: `libs/bc/hangar/src/upload-handler.ts:90-98`

Problem: `isNoChange` returns true purely on checksum match, regardless of `payload.version`. An operator uploading the same bytes with a corrected version string (e.g. typo fix from "2025-1" to "2025-01") sees "no change" and the version isn't updated. The audit row records `outcome: 'no-change'` with no version metadata.

Trigger: Operator re-uploads with a corrected version string to fix metadata.

Fix: When checksum matches but `payload.version?.trim()` differs from `existing.version`, persist the version-only update (rev bump + dirty + new version) and audit it as `outcome: 'metadata-updated'`. Skip the file rename.

### MINOR: `editionsEqual` ignores resolvedAt drift

File: `libs/bc/hangar/src/source-fetch.ts:200-203`

Problem: Short-circuit no-change check (line 297-319) compares `effectiveDate` and `resolvedUrl`. If FAA republishes the same edition under the same URL but with a different `resolvedAt` timestamp (re-resolved by a later run), the existing-sha check still passes and we skip the download — that's correct caching. But the edition row in the DB never gets updated `resolvedAt`, so audit/UI surfaces stale "last resolved" times. Minor; not data loss.

Trigger: Operator re-runs fetch on a stable edition, expects "last checked at" to update.

Fix: Update `edition.resolvedAt` on the no-change short-circuit path even when bytes haven't changed.

### MINOR: rev-conflict refresh in registry races a second writer

File: `libs/bc/hangar/src/registry.ts:271-279, 441-447`

Problem: After a failed UPDATE (zero rows), the code re-selects to read the current rev for the error message. Between the failed UPDATE and the re-SELECT, a third writer could bump rev again, producing a misleading error message ("rev advanced mid-write" with `currentRev` that's already stale by the time the operator sees it). Inside a transaction this should be safer, but the read happens within the same tx so it's bounded. Minor cosmetic.

Trigger: Two concurrent writers + an operator hitting save thrice rapidly. Error message shows a rev that's already been superseded.

Fix: Accept that the error message is best-effort. Document or change the message to "current rev was at least N — reload to see latest".

### NIT: claimNext's empty-locked-targets WHERE clause uses isNotNull as tautology

File: `libs/hangar-jobs/src/worker.ts:84-86`

Problem: `lockedTargets.length === 0 ? isNotNull(hangarJob.id) : ...` uses `isNotNull(id)` as a "match anything" predicate. The primary key is never null, so this is always true. It works but is unidiomatic. Drop the conditional and append the targetId clause only when `lockedTargets.length > 0`.

Fix:

```typescript
const conditions = [eq(hangarJob.status, JOB_STATUSES.QUEUED)];
if (lockedTargets.length > 0) {
  conditions.push(or(isNull(hangarJob.targetId), notInArray(hangarJob.targetId, lockedTargets)));
}
const base = db.select().from(hangarJob).where(and(...conditions));
```

### NIT: hooks.server.ts session.user role cast loses ban awareness

File: `apps/hangar/src/hooks.server.ts:138-144`

Problem: The user object stores `banned: session.user.banned ?? null` and `role: (session.user.role as Role) ?? null`. The `as Role` cast is unsafe — better-auth stores arbitrary text (matches the `narrowRole` helper in `users.ts`). A custom-roled user (e.g. role: 'invited') gets typed as `Role` but downstream `requireRole` checks fail in surprising ways.

Fix: Use the same `narrowRole` helper (or re-export it from `@ab/auth`) so the locals.user.role is consistently `Role | null` across the codebase.

### NIT: emit-aviation-ts ascii-iterates code points but skips combining marks

File: `libs/hangar-sync/src/emit-aviation-ts.ts:54-71`

Problem: `formatString` iterates by code points using `for (const ch of value)`. That's correct for surrogate pairs, but the `code < 0x20` guard misses U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR), which are valid in TOML/JSON but invalid in JavaScript string literals (they terminate a single-quoted string). If a paraphrase contains either character (rare but possible from copy-pasted regulatory text), the emitted aviation.ts will fail to parse.

Fix: Add `code === 0x2028 || code === 0x2029` to the escape branch.

## Status as of 2026-05-04

Re-walked every finding against current main; verdicts below reflect grep + read of the cited files.

| Finding                                                   | Verdict | Closure                                                                                                       |
| --------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| CRITICAL: cancelled job overwritten by worker             | CLOSED  | PR #436 -- terminal updates gated on `status = RUNNING` (`worker.ts:223`, `:353`, `:374`) inside transactions |
| CRITICAL: same-version re-upload silently overwrites      | CLOSED  | PR #442 -- archive-before-write keyed on `existing.checksum !== sha256`                                       |
| MAJOR: upload archive + rename non-atomic                 | CLOSED  | PR #442 -- stage-inside-destDir + rollback path                                                               |
| MAJOR: orphaned-running recovery never updates audit log  | CLOSED  | PR #436 -- `recoverOrphanedRunning` emits per-row audit                                                       |
| MAJOR: claimNext race when targetId clears mid-iteration  | CLOSED  | PR #436 -- terminal-state writes are now transactional, drop happens after commit                             |
| MAJOR: detectDrift loses fields with non-canonical TOML   | CLOSED  | PR #452 -- decoded-object diffing, baseline-key walking                                                       |
| MAJOR: detectConflict skips deleted rows                  | CLOSED  | PR #452 -- baseline-key walk added                                                                            |
| MAJOR: audit-cursor `indexOf` brittleness                 | CLOSED  | PR #438 -- `lastIndexOf` (`audit-queries.ts:108`)                                                             |
| MINOR: zip64 archive silently no-ops                      | CLOSED  | PR #442 wave -- recorded in `media.archiveError`                                                              |
| MINOR: nodeProcessRunner ignores stdin write errors       | CLOSED  | PR #436 wave -- defensive try/catch around stdin writes                                                       |
| MINOR: writeAllFiles non-rollback                         | CLOSED  | PR #452 -- `.tmp` two-phase write/rename                                                                      |
| MINOR: rotateArchives current-edition retention semantic  | CLOSED  | PR #442 -- `ARCHIVE_RETENTION` JSDoc clarifies "current + N-1 prior", both call paths aligned                 |
| MINOR: upload version-only changes silently no-op         | CLOSED  | PR #442 -- version-only metadata update path                                                                  |
| MINOR: `editionsEqual` ignores resolvedAt drift           | CLOSED  | PR #442 -- `resolvedAt` updated on no-change short-circuit                                                    |
| MINOR: rev-conflict refresh races a third writer          | CLOSED  | PR #442 -- documented as best-effort message                                                                  |
| NIT: claimNext empty-locked-targets `isNotNull` tautology | CLOSED  | PR #436 -- conditional `where` composition                                                                    |
| NIT: hooks.server.ts `as Role` cast                       | CLOSED  | PR #476 -- `mapBetterAuthSession` extracted, uses `narrowRole`                                                |
| NIT: emit-aviation-ts misses U+2028/U+2029                | CLOSED  | `emit-aviation-ts.ts:63-68` adds the LINE/PARAGRAPH SEPARATOR escape                                          |

Total: 18 closed / 0 open. All critical + major + minor + nit findings closed across PRs #436, #438, #442, #452, #476 plus follow-ups.
