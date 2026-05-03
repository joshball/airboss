---
feature: hangar-cluster
date: 2026-05-02
branch: main
reviewers_run: 12
total_issues: 213
critical: 9
major: 64
minor: 87
nit: 53
status: unread
review_status: done
---

# 10x Review -- Chunk 6: hangar cluster

12 reviewers, all complete. Scope: `apps/hangar/`, `libs/hangar-jobs/`, `libs/hangar-sync/`, `libs/bc/hangar/`.

## Summary table

| Category     | Critical | Major | Minor | Nit | Total | File |
|--------------|---------:|------:|------:|----:|------:|------|
| correctness  |        2 |     6 |     7 |   3 |    18 | [link](2026-05-02-hangar-cluster-correctness.md) |
| security     |        0 |     2 |     6 |   4 |    12 | [link](2026-05-02-hangar-cluster-security.md) |
| perf         |        0 |     5 |     7 |   4 |    16 | [link](2026-05-02-hangar-cluster-perf.md) |
| architecture |        1 |     4 |     4 |   3 |    12 | [link](2026-05-02-hangar-cluster-architecture.md) |
| a11y         |        2 |     8 |     9 |   6 |    25 | [link](2026-05-02-hangar-cluster-a11y.md) |
| patterns     |        0 |     0 |     6 |   4 |    10 | [link](2026-05-02-hangar-cluster-patterns.md) |
| testing      |        1 |     9 |     9 |   4 |    23 | [link](2026-05-02-hangar-cluster-testing.md) |
| dx           |        0 |     4 |     7 |   4 |    15 | [link](2026-05-02-hangar-cluster-dx.md) |
| schema       |        1 |     4 |     5 |   3 |    13 | [link](2026-05-02-hangar-cluster-schema.md) |
| backend      |        0 |     4 |     6 |   3 |    13 | [link](2026-05-02-hangar-cluster-backend.md) |
| svelte       |        0 |     5 |     9 |   6 |    20 | [link](2026-05-02-hangar-cluster-svelte.md) |
| ux           |        2 |     9 |    11 |   6 |    28 | [link](2026-05-02-hangar-cluster-ux.md) |
| **TOTAL**    |    **9** |**60** |**86** |**50**|**205**| |

## CRITICAL findings (9)

### 1. (correctness) Worker silently overwrites `cancelled` -> `complete`/`failed`
Worker's terminal-status update is unconditional. When a handler finishes after `cancelJob` ran, it overwrites the cancellation. The user's cancel is silently lost. **Fix**: gate terminal-status updates on `where status = running`.

### 2. (correctness) Same-version upload data loss
Upload handler's same-version overwrite path silently clobbers prior binaries with no archive. Different-checksum re-upload with same version = unrecoverable data loss.

### 3. (architecture) Three-way package.json cycle
`@ab/bc-hangar`, `@ab/hangar-jobs`, `@ab/hangar-sync` form a circular dependency graph. Workspace path aliases hide it from TypeScript but the dependency graph is unambiguously circular. **Fix**: move job tables out of `bc-hangar/schema.ts` into `hangar-jobs` (it owns those writes); relocate handler-map registration from `bc-hangar/jobs.ts` to the hangar app.

### 4. (schema) `hangar.job_log (job_id, seq)` has no unique constraint and `appendJobLog()` computes seq non-atomically
`coalesce(max(seq), -1) + 1` racing with the worker's separate in-memory counter. Concurrent paths (orphan recovery + draining worker) collide; the polling cursor `seq > sinceSeq` tolerates duplicates badly. **Fix**: unique `(job_id, seq)` + atomic seq allocation (sequence column or UPSERT).

### 5. (a11y) Audit-page actor combobox is incomplete
No `aria-activedescendant`, no keyboard navigation between option buttons, listbox children are buttons not options, no result-count announcement. **Keyboard-only users cannot select an actor.**

### 6. (a11y) Job-detail "tablist" declares ARIA tabs pattern but ships none of the contract
No roving tabindex, no arrow keys, no `tabpanel`. Should be downgraded to a toggle group with `aria-pressed`, or fully implemented.

### 7. (testing) `audit-queries.test.ts` post-filters by inserted IDs
Integration block post-filters every result by `insertedAuditIds.includes(r.id)` before asserting filter shape. A broken WHERE clause that returns extra rows still passes. Tests look thorough but don't actually verify the filters they claim to.

### 8. (ux) Archive Delete on `sources/[id]/files` is one-click with no confirmation
Destructive, no `ConfirmDialog`. The same product gates user-management hazards behind email-typed `ConfirmDialog`; the asymmetry is the largest UX bug in the cluster.

### 9. (ux) Soft-delete on `glossary/[id]` and `glossary/sources/[id]` is one-click with no confirmation
Same as above -- destructive, unconfirmed. Pair with #8 on a single fix pass that wires every destructive form-action through `ConfirmDialog`.

## Convergent / root-cause findings

### Job worker fragility (4 reviewers)
- **correctness (critical)**: silent cancel overwrite (above)
- **correctness (major)**: `recoverOrphanedRunning` writes a job-log line but no audit row (state-transition contract broken)
- **correctness (major)**: worker `claimNext` race -- `runningTargets.delete` in handler's `finally` runs before post-handler audit/status writes commit, so a queued same-target job can start before the prior fully terminates
- **dx (major)**: `worker.ts:194-215` runs 3 sequential awaits on failure path with no inner try -- if `db.update` or `auditWrite` throws while handler is also failing, job stays in `running` until worker reboot ("ghost running job" path)
- **dx (major)**: `setInterval` cancel poll inside `nodeSpawnRunner` is async with no try/catch -- db blip turns into silent unhandled rejection and cancel button stops working
- **dx (major)**: no worker liveness signal or per-job heartbeat -- "worker stuck" indistinguishable from "worker working" at 2am
- **backend (minor)**: terminal job state transitions in `worker.ts` (success/fail/cancel) and `enqueueJob` are non-atomic with their audit emissions
- **testing (major)**: `libs/hangar-jobs/` worker.ts + enqueue.ts ship with **zero direct test coverage**
- **Root cause**: rewrite worker terminal-state path as a single transaction (status-update + audit-write atomic), gate the update on `where status = running`, add try/catch to cancel poll, add worker heartbeat, then add tests for the claim race and orphan recovery.

### Source ingest data integrity (3 reviewers)
- **correctness (critical)**: same-version upload silently clobbers binaries (above)
- **correctness (major)**: upload archive + rename pair non-atomic; crash mid-flow leaves source row pointing at missing file
- **dx (major)**: `auditWrite` in `source-fetch.ts` only fires on success -- per-source audit queries miss every failure
- **backend (major)**: source-job subprocess output unbounded -- huge stderr/stack/diff lands wholesale in `hangar.job_log` / `.error` / `.result`. Cap needed.
- **backend (major)**: upload action has fragile temp-dir-leak ordering (`enqueued = true` set after `redirect(...)` not after `enqueueJob`)
- **Root cause**: rewrite the upload + fetch pipeline to: (1) archive-before-write with rollback, (2) emit audit on every terminal state regardless of outcome, (3) cap subprocess output bytes (constant in `@ab/constants`).

### Sync drift/conflict detection brittleness (1 reviewer, multiple findings)
- **correctness (major)**: `detectDrift` does string-compare on TOML output (brittle to codec/whitespace drift); should compare semantic decoded objects
- **correctness (major)**: `detectConflict` only walks current revs, never baseline keys -- deletes between syncs vanish silently
- **correctness (minor)**: registry rev-conflict refresh races a third writer
- **schema (major)**: `hangar.sync_log.rev_snapshot` jsonb has no runtime Zod validation despite driving `detectConflict` correctness
- **Root cause**: rebuild diff/conflict detection on decoded objects (not text), include baseline-key walking, add Zod validation on `rev_snapshot` writes.

### Audit explorer / queries (4 reviewers)
- **correctness (major)**: audit cursor `decodeAuditCursor` uses `indexOf` instead of `lastIndexOf`; stale/crafted cursors silently match nothing instead of resetting to page 1
- **backend (major)**: `searchActorIds(decoded.actorId, 1)` resolves deep-linked actor chip via name/email ILIKE, but better-auth IDs never match -- chip silently empty for every URL with `?actor=<id>`. Needs `getActorById`.
- **perf (major)**: audit log has no standalone timestamp index (chunk-3 finding); 24h-window query degrades linearly. (Closes via chunk-3 [PR #426](https://github.com/joshball/airboss/pull/426).)
- **testing (critical)**: post-filter by inserted IDs (above)

### Status-pill convergent a11y (1 reviewer, 7 hangar sites)
- **a11y (major)**: status pills/badges everywhere (dirty/clean/pending/downloaded/extracted/banned/active job state) carry meaning by color + text label only; need a glyph cue. Convergent fix at the `@ab/ui` pill component clears 7 hangar sites.

### Heavy visual CSS in route files (convergent with chunk 1)
- **svelte (major)**: `.table-wrap`/table, `.badge`, `.role-pill`, `.status-chip`, `.btn-like`, `.crumbs`, `.filter-bar` skins duplicated 4-9x across routes. One `libs/ui` extraction pass, not 12 inline edits.
- **architecture (minor)**: 5 copies of "enqueue + redirect" boilerplate across routes
- **Root cause**: same as chunk 1 -- routes treated as pages instead of assembly. UI primitives belong in `libs/ui/`.

### Destructive-action confirmation gaps (ux convergent)
- **ux (critical x2)**: above (#8, #9)
- **ux (major)**: "Commit this diff" is destructive but unconfirmed
- **ux (major)**: Job Cancel is destructive but unconfirmed
- **a11y (minor)**: missing confirmation on soft-delete forms (`ConfirmDialog` already exists, used on user-detail page -- convergent fix)
- **Root cause**: wire every destructive form-action through `ConfirmDialog`. The component exists.

### Fire-and-forget submits with no feedback (ux convergent)
- **ux (major)**: `sources/[id]` action row (Fetch / Extract / Diff / Validate), `sources/+page.svelte` Rescan/Revalidate/Build, diff page Run/Commit -- operator clicks and sees nothing happen.
- **a11y (major)**: job log lines stream into a non-live region while a misleading static `aria-live` span sits next to it; body needs `role="log" aria-live="polite"`.
- **Root cause**: standardize the "enqueued -> link to job" pattern + `aria-live` on log streams.

### `hangar-jobs` not actually generic (architecture)
- **architecture (major)**: `hangar-jobs` markets itself as generic infra but imports `@ab/bc-hangar/schema` -- pick one
- **Root cause**: closes when critical #3 (3-way cycle) is fixed.

### Outbound-fetch SSRF (security)
- **security (major)**: `bv_index_url` and source `url` accept any `^https?://` URL -- any AUTHOR can point fetcher at cloud metadata / localhost / internal hosts; response body lands in job log
- **security (major)**: `bv_index_url` skips even the http(s) regex used by the main url field
- **Root cause**: add host/IP allowlist (or denylist for RFC1918 + link-local + metadata) + Zod schema for BV fields.

### Test coverage gaps (testing major)
- worker.ts + enqueue.ts: no tests
- upload form action: no tests (path-traversal, 413, 409, tmpdir-cleanup all unproven)
- BetterAuthApiError wrap path tested only for `setUserRole`; ban/unban/revoke don't cover api-throws
- Cancellation handoff in source-jobs plumbed but never exercised
- **No Playwright e2e for hangar at all** (confirmed empty)

### Missing index for terminal-state job lookups (schema major)
- `hangar.job_status_idx (status, created_at)` should be partial `WHERE status = 'queued'` -- table dominated by terminal-state rows
- `getLatestCompleteJobByKind` / `getLatestCompleteJobForTarget` have no covering index for `kind + status='complete' + ORDER BY finished_at DESC`

### Performance hot spots
- **perf (major)**: `/sources` re-reads `libs/aviation/src/references/aviation.ts` (~160 KB, 4095 lines) and runs 2 regex sweeps on every load just to render 2 integer tiles
- **perf (major)**: `listRunningJobs` returns `SELECT *` with no LIMIT
- **perf (major)**: job-detail log buffer grows unbounded on client; `pollLog` appends up to 500 lines/sec, no cap, no virtualization
- **perf (major)**: `revokeAllUserSessions` uses `LIMIT Number.MAX_SAFE_INTEGER` and pulls full session rows just to count

## What's clean (preserve)

- **patterns**: cleanest review of chunk 6 -- 0 critical, 0 major. Strong shape on project patterns: all `@ab/*` aliases, `createId()` everywhere, `SCHEMAS.HANGAR`, no Svelte 4, no `any`, no `!`, `sql.raw` confined to schema check-constraint construction.
- **architecture**: `hangar-sync` is the cleanest of the three packages -- pure-of-IO state machine (`executeSync`), genuinely surface-agnostic, no app concerns leaking in. Schema namespace correct everywhere. BC owns every Drizzle query.
- **security**: every page-server load + form action calls `requireRole`, dual-gate auth contract honored, optimistic-rev locking on every write through `registry.ts`, audit-write coverage consistent, file-serving routes have triple-belt path traversal guards (string check + resolved-prefix check + filename-prefix check), upload action defangs `originalFilename` by writing to fixed `upload.bin` in per-request `mkdtemp`, `lastIndexOf('.')` extension extraction provably can't escape destDir.
- **backend**: dual-gate auth, Zod validation everywhere, `db.transaction` on registry CRUD + sync, advisory lock on sync, audit emissions on user admin / sync / job lifecycle.
- **dx**: `user-writes.ts` is the gold-standard pattern (typed errors, audit before/after, 1:1 error-class-to-status mapping). Source-job handlers should adopt this template.
- **svelte**: zero Svelte 4 patterns, runes/snippets/$app/state all clean.
- **perf**: keyset pagination on audit, `Promise.all` triple in registry list helpers, partial indexes for dirty rows, single-query LEFT JOIN aggregate for users last-seen, explicit hard caps on USERS_LIST_LIMIT / AUDIT_LIST_HARD_CAP.

## Recommended fix order

1. **Critical-first** (in order):
   - Worker cancel-overwrite gate + transaction wrap (#1) -- closes 4 dx/correctness findings together
   - Upload same-version data loss + atomic archive+rename (#2 + correctness major)
   - 3-way package cycle (#3) -- moves job tables to hangar-jobs, hoists handler-map to app
   - `hangar.job_log (job_id, seq)` unique + atomic seq (#4)
   - Audit combobox keyboard nav (#5)
   - Job-detail tablist: downgrade to toggle group OR ship full ARIA tabs (#6)
   - `audit-queries.test.ts` filter assertion fix (#7)
   - Wire all 4+ destructive form-actions through existing `ConfirmDialog` (#8, #9, +Commit/Cancel)
2. **Convergent root-causes**:
   - Worker liveness + cancel-poll try/catch + heartbeat
   - Drift/conflict detection on decoded objects + baseline-key walking
   - Audit cursor `lastIndexOf` + `getActorById` helper
   - Status-pill `@ab/ui` glyph cue (closes 7 a11y sites)
   - Hangar-jobs barrel split (closes when cycle is fixed)
   - SSRF allowlist for outbound fetches + BV Zod schema
3. **Performance**: subprocess output cap, /sources tile sourcing, list LIMITs, log virtualization, partial-index migration for queued jobs.
4. **Test coverage**: worker.ts + enqueue.ts, upload form action, e2e Playwright for hangar core flows.
5. **Heavy route CSS**: extraction pass to `libs/ui` -- runs LAST per project convention.

## Severity guide

- **critical**: data loss, cancel-overwrite, circular dep, false-confidence test, keyboard-only blocked, destructive-without-confirm
- **major**: race, broken contract, won't-scale, missing protection, convergent pattern across many sites
- **minor**: defensive gap, naming, missing test
- **nit**: polish, style preference

## Final close-out as of 2026-05-04

Walked every per-category file heading-by-heading; re-grepped current main for each finding. Verdicts and closing PRs are recorded in each file's "Status as of 2026-05-04" section.

### Per-category tally

| Category     | Closed | Deferred (with trigger) | Open | Total | Status |
|--------------|-------:|------------------------:|-----:|------:|--------|
| correctness  |     18 |                       0 |    0 |    18 | done   |
| security     |     12 |                       0 |    0 |    12 | done   |
| perf         |     16 |                       0 |    0 |    16 | done   |
| architecture |     11 |                       1 |    0 |    12 | done   |
| a11y         |     25 |                       0 |    0 |    25 | done   |
| patterns     |     10 |                       0 |    0 |    10 | done   |
| testing      |     23 |                       0 |    0 |    23 | done   |
| dx           |     15 |                       0 |    0 |    15 | done   |
| schema       |      4 |                       9 |    0 |    13 | done   |
| backend      |     14 |                       0 |    0 |    14 | done   |
| svelte       |     20 |                       0 |    0 |    20 | done   |
| ux           |     28 |                       0 |    0 |    28 | done   |
| **TOTAL**    | **196**|                   **10**|**0** |**206**|        |

The original INDEX summary table records 205-213 issues across two row totals (the table shows 205 in the row total, 213 in the frontmatter `total_issues`); the per-category file counts sum to 206 here. The 10 deferred items are 1 architecture (REPO_ROOT consolidation) + 9 schema (partial-index migrations, free-text check constraints, sentinel-string column types, anticipatory indexes, sync_log timestamps); each has a stated trigger and is captured in its category file's status table.

### Critical findings (9 of 9)

All 9 criticals are CLOSED:

1. Worker cancel overwrite (correctness) -- PR #436
2. Same-version upload data loss (correctness) -- PR #442
3. Three-way package cycle (architecture) -- PR #435
4. `(job_id, seq)` no unique constraint (schema) -- PR #448
5. Audit combobox a11y (a11y) -- PR #455
6. Job-detail tablist a11y (a11y) -- PR #455
7. Audit-queries WHERE-clause filter coverage (testing) -- PR #463 + this audit
8. Archive Delete no confirmation (ux) -- PR #433
9. Glossary soft-delete no confirmation (ux) -- PR #433

### Convergent root causes

Every convergent root-cause cluster called out in the original INDEX has been resolved:

- Job worker fragility -> PR #436 (atomic terminal-state, heartbeat, cancel-poll error handling, recovery audit)
- Source ingest data integrity -> PR #442 (atomic archive+rename, audit on every terminal state, output caps)
- Sync drift/conflict detection -> PR #452 (decoded-object comparison, baseline-key walking, Zod validation)
- Audit explorer -> PR #438 (lastIndexOf cursor + getActorById helper) + chunk-3 PR #426 (timestamp index)
- Status-pill a11y -> PR #440 (Badge glyph cue, 7 sites closed at once)
- Heavy route CSS -> PR #464 (Breadcrumbs/FilterBar/RolePill/etc. extracted to @ab/ui) + #440 (Badge)
- Destructive-action confirmations -> PR #433 (every destructive form-action through ConfirmDialog)
- Fire-and-forget submits -> PR #467 wave + #548 (Banner-on-success + invalidateAll polling)
- hangar-jobs not generic -> PR #435 (cycle break + own schema)
- Outbound-fetch SSRF -> PR #441 (denylist + Zod schema for BV fields)
- Test coverage gaps -> PR #463 (worker, enqueue, upload action, BetterAuthApiError wrap, cancellation handoff)
- Missing job-table indexes -> PR #436 + #448 partials; full partial-index migration deferred with trigger documented in schema file
- Performance hot spots -> PR #453 (slim projections, log buffer cap, list LIMITs, /sources DB-backed counts)

### Mechanical fixes landed in this audit pass

Items the audit found still open and fixed in-line (in addition to the per-category status writeups):

- `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte`: replaced `?sinceSeq=-1` magic-string with `?${QUERY_PARAMS.SINCE_SEQ}=-1` in the trim-notice fallback link.
- `libs/bc/hangar/src/audit-queries.test.ts`: sharpened `searchActorIds` cap test (exact length + fixture-id assertion + cap-5 widen check); sharpened time-window filter test (`toHaveLength(2)` + id-set pinning).
- `libs/bc/hangar/src/dashboard-queries.test.ts`: sharpened `countLiveSources` to `after - before === 1` instead of `>= 1`.
- `libs/bc/hangar/src/jobs.test.ts`: added seq-monotonicity assertion on the duplicate-poll test.
- `libs/bc/hangar/src/source-fetch.test.ts`: pinned `dbPatches[0]?.id === 'sectional-denver'`.
- `libs/bc/hangar/src/registry.test.ts`: asserted `updatedBy` persists on update + softDelete paths.
- `libs/bc/hangar/src/jobs-queries.test.ts`: pinned per-fixture count on `listRunningJobs` test.
- Renamed `apps/hangar/src/lib/components/preview/MarkdownPreview.svelte` -> `MarkdownFilePreview.svelte` to disambiguate from the form-side `MarkdownPreview.svelte`; updated route + test imports.

`bun run check` is clean.

### Next-action summary

- Schema partial-index migration (queued + running + kind-complete): tracked as future perf work with explicit trigger ("when job table volume warrants").
- `target_type` / `format` check constraints: tracked as a focused schema hardening pass.
- `pending-download` sentinel + `reviewed_at` text->date: tracked as a schema-types cleanup pass.
- REPO_ROOT consolidation into `@ab/utils`: tracked as architecture follow-up; behavior is correct today.

`review_status` flipped to `done` on all per-category files and on this INDEX. Punch-list closed.
