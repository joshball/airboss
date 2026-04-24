---
title: 'Test plan: Hangar sources v1'
product: hangar
feature: hangar-sources-v1
type: test-plan
status: unread
review_status: pending
---

# Test plan: Hangar sources v1

## Automated

- [ ] Unit: `downloadFile` happy path, retry after 5xx, 304 skip
- [ ] Unit: each job handler with mocked subprocess
- [ ] Unit: upload handler computes sha + archives old file + updates row
- [ ] Unit: diff hunks parse from the real `references diff` output
- [ ] Integration: trigger a full extract job against a tiny fixture CFR XML; verify `*-generated.ts` updated
- [ ] Integration: trigger a sync-to-disk after commit-diff; verify the generated file lands in git

## Manual walkthrough

### Flow diagram

1. Open `/sources`. **Pass:** diagram renders, counts populated, no hex anywhere (inspect the DOM).
2. Tab through the diagram. **Pass:** every action button reachable with focus ring visible.

### Fetch

3. Pick a source with a known small URL (e.g., a small demo XML). Click `Fetch`. **Pass:** redirect to `/jobs/[id]`, log streams, job completes, `hangar.source` shows new checksum + downloaded_at.
4. Click `Fetch` again immediately. **Pass:** 304/no-change path; job ends with "no change" in log.

### Upload

5. On the same source, click `Upload`, pick a new version. **Pass:** file lands on disk, old file archived under `<id>@<version>.<ext>`, source row updated.
6. Upload the same file again. **Pass:** rejected with "no change" toast.
7. Upload a file exceeding the size limit. **Pass:** 413 response with a clear message.

### Extract + diff + commit

8. Click `Extract` on a fetched source. **Pass:** job runs, `*-generated.ts` updates, verbatim count increases.
9. Upload a slightly different version, re-extract, click `Diff`. **Pass:** hunks render with a header per changed id.
10. Click `Commit this diff`. **Pass:** generated file written to disk, sync-to-disk job enqueued, commit lands.

### Validate + build

11. Click `Revalidate` from the diagram. **Pass:** job runs, status tile updates to the latest result.
12. Click `Build` (global). **Pass:** job runs scan + extract pipeline, generated files refreshed, diff available.

### Concurrency

13. Two users: one triggers fetch on source A, one triggers fetch on source B. **Pass:** both run in parallel.
14. Two users: both trigger fetch on source A. **Pass:** second is queued; log shows it waiting.
15. User A runs extract; User B tries upload on the same source. **Pass:** upload blocked with "source is busy".

### Files browser

16. Navigate to `/sources/[id]/files`. **Pass:** lists files in `data/sources/<type>/`, per-extension previews render.
17. Click an archived-version file. **Pass:** preview shows old content; actions show `Download` (no delete for non-admin).

### Jobs

18. `/jobs` shows recent jobs with correct status. **Pass:** cancel a queued job; status changes to `cancelled`.
19. `/jobs/[id]` for a completed job. **Pass:** full log scrollable, result jsonb pretty-printed.
20. Kill hangar mid-job. Restart. **Pass:** in-flight job recovered; job log has "recovered from restart" entry.

### Theme invariants

21. Toggle appearance; every affordance + node still contrast-pass.
22. Token-enforcement lint: zero violations across `apps/hangar/**` and `libs/ui/**`.
23. Contrast suite: pass WCAG AA on all role-pairs rendered.
24. No FOUC on first paint.

### End-to-end yearly refresh simulation

25. In one session: fetch -> extract -> diff -> commit-diff -> sync-to-disk. **Pass:** commit lands, generated file diff matches the hunks shown in step 9/10, sync-log row has the SHA.

## Review

- [ ] Self + `/ball-review-full`
- [ ] Spec drift check
