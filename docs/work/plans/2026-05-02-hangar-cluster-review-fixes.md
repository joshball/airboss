---
feature: hangar-cluster
date: 2026-05-02
reviews_consumed: 12
total_issues: 213
critical: 9
major: 64
minor: 87
nit: 53
---

# Hangar Cluster Review -- Fix Plan

## Strategy

213 issues across 12 reviewers. Fix at the root once for convergent findings.
Order: convergent root-cause fixes first (worker, source ingest, schema/cycle,
ConfirmDialog, status-pill glyph cue), then per-file remaining critical/major,
then minor, then nit.

## Convergent root-cause fixes

### 1. Three-way package cycle (CRITICAL architecture)

Move job tables (`hangarJob`, `hangarJobLog`) and job-related row types from
`libs/bc/hangar/src/schema.ts` into a new `libs/hangar-jobs/src/schema.ts`.
Re-export from `bc-hangar/schema` for back-compat. Move `JOB_KINDS` /
`JobKind` / `JOB_KIND_VALUES`, `HANGAR_SYNC_MODES`, `SYNC_OUTCOMES` from
`@ab/constants` to bc-hangar (per architecture review). Drop `@ab/bc-hangar`
from `libs/hangar-jobs/package.json`. Drop `@ab/hangar-sync` from
`libs/bc/hangar/package.json`. Move `hangarJobHandlers` to
`apps/hangar/src/lib/server/jobs.ts`.

### 2. Worker terminal-state atomicity + cancel preservation (CRITICAL correctness)

Rewrite `runJob`'s terminal write paths to use single `db.transaction`:
- Status-update gated on `where status = running`.
- If 0 rows updated -> the row was cancelled mid-flight; preserve cancel state, log "preempted by cancel" event, skip audit.
- Status-update + audit-write inside the transaction.
- Wrap each terminal block in inner try/catch with `console.error` fallback so a failing audit doesn't strand the row.

### 3. Worker liveness + cancel-poll resilience (MAJOR dx)

- Add `lastHeartbeatAt` column on `hangar.job`; update from `runJob` on a 5s timer.
- Wrap `nodeSpawnRunner` cancel-poll in try/catch.
- Add try/catch around `recoverOrphanedRunning` writes.

### 4. `(job_id, seq)` unique + atomic seq (CRITICAL schema)

- Add `unique('hangar_job_log_job_seq_unique').on(t.jobId, t.seq)` on `hangar_job_log`.
- Replace `appendJobLog`'s `coalesce(max(seq))+1` with retry-on-conflict pattern (transaction + row lock on `hangar_job`).
- Audit `recoverOrphanedRunning` to use `appendJobLog` (already does).
- Add an audit-write to `recoverOrphanedRunning` per orphan (correctness major).

### 5. Source ingest data integrity (CRITICAL+MAJOR correctness)

- Same-version upload: archive on checksum-mismatch even when version unchanged (`upload-handler.ts`).
- Atomic archive + rename: stage tmp inside destDir, rollback on failure.
- `runSectionalFetch`: try/catch the whole body, audit failure with step.
- Cap subprocess output: `OUTPUT_BYTE_CAP` constant, truncate `outLines`/`errLines`/`error`/`result.text` writes.

### 6. SSRF allowlist (MAJOR security)

- Add `bv_index_url` Zod schema mirroring `url` regex.
- Block private IPs in `defaultFetchHtml` and `defaultDownloader` via DNS resolve + IP range check.
- Add `https://` requirement on citation URL.

### 7. Audit cursor + actor-id helper (MAJOR)

- `decodeAuditCursor`: switch `indexOf` -> `lastIndexOf`.
- Add `getActorById` BC helper; use on audit page deep-link path.

### 8. Status-pill glyph cue (MAJOR a11y x7 sites)

- Update `@ab/ui` Badge / StatusChip primitives to accept a glyph prop / leading icon.
- Apply across glossary, sources, jobs, users badges.

### 9. ConfirmDialog rollout (CRITICAL+MAJOR ux)

- Wire `ConfirmDialog` on:
  - `/sources/[id]/files` archive delete (CRITICAL, typed confirmation)
  - `/glossary/[id]` soft-delete (CRITICAL, dialog body explains blast radius)
  - `/glossary/sources/[id]` soft-delete (CRITICAL, typed confirmation source-id)
  - `/sources/[id]/diff` Commit (MAJOR, scaled by line count)
  - `/jobs/[id]` Cancel (MAJOR, surfaces target+kind+runtime)

### 10. Audit log timestamp index (MAJOR perf, scope coordination)

- Add `audit_log_timestamp_idx (timestamp DESC, id DESC)` standalone.

### 11. Audit combobox + tablist a11y (CRITICAL a11y x2)

- Audit page combobox: full ARIA APG combobox with `aria-activedescendant`, keyboard nav, listbox with `role="option"` `<li>` not buttons.
- Job-detail tablist: downgrade to toggle-group with `aria-pressed` (simpler than full ARIA tabs implementation).

### 12. /sources counts from DB (MAJOR perf + architecture)

- Add `countAviationReferences()` / `countVerbatimReferences()` to `@ab/aviation` so route stops reading aviation.ts.
- Switch `/sources` loader to use them.

### 13. List query column projections (MINOR perf x4)

- `listLiveSources`, `listJobs`, `listRunningJobs`, `getActiveJobForTarget`, `listRecentJobsForTarget`, `getJob` (polling): trim to needed columns.
- Add LIMIT to `listRunningJobs`.

### 14. Constants extraction (MINOR patterns x6)

- `QUERY_PARAMS.REDIRECT_TO` in hangar layout guard
- `JOB_LOG_STREAMS.EVENT` in `recoverOrphanedRunning`
- `QUERY_PARAMS.SINCE_SEQ` on poll URL
- `DRAIN_POLL_INTERVAL_MS` in worker
- `JOB_POLL_INTERVAL_MS` on client
- `REGISTRY_TARGET_ID` constant for build/validate audit rows
- Add comments on `as` casts (`as ReadableStream`, `as JobStatus`, etc.)

### 15. Test hardening

- `audit-queries.test.ts`: add length assertions so broken WHERE fails.
- `dashboard-queries.test.ts`: capture before-count, assert delta.
- `searchActorIds` cap test: discriminating fixtures.
- Fix preview-component "grep source string" tests.
- Fix `theme-tokens` test cwd guard.
- Fix `jobs-queries` running-rows leak.
- Fix `audit-queries` time-window exact-count.
- Add worker test coverage.
- Add upload form action coverage.

## Execution sequence

1. Schema + constants + package cycle (step 1 root prereq).
2. Worker rewrite (steps 2, 3, 4).
3. Source ingest + SSRF (steps 5, 6).
4. Audit fixes (steps 7, 11).
5. ConfirmDialog rollout (step 9).
6. Status-pill glyph + Badge primitive (step 8).
7. Perf + projections (steps 10, 12, 13).
8. Patterns + nits (step 14).
9. Tests (step 15).

After each cluster: `bun run check`. Final: full check + relevant tests.

## Deferrals

- E2E Playwright suite for hangar (testing major) -- noting as separate work package needed; opening deliberately as a noted gap in the PR body.
- Library extraction pass for repeated route CSS (svelte major) -- separate `libs/ui` work package; tracked in PR body.
