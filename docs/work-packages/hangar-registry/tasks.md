---
title: 'Tasks: Hangar registry'
product: hangar
feature: hangar-registry
type: tasks
status: unread
review_status: pending
---

# Tasks: Hangar registry

Serial. Each bucket ends with `bun run check` clean + its own commit. One PR for the whole WP at the end.

## Phase 1 — Codec + migration

- [ ] Author `libs/aviation/src/toml-codec.ts`. Export `encodeReferences(Reference[]) -> string`, `decodeReferences(string) -> Reference[]`, plus the `Source[]` equivalents. Stable key order. Deterministic whitespace.
- [ ] Vitest round-trip tests: take the current `AVIATION_REFERENCES` array, encode, decode, compare deep-equal. Same for `SOURCES`.
- [ ] Vitest byte-identity test: decode -> encode = input, for a golden fixture.
- [ ] Author `scripts/references/migrate-toml.ts` (one-shot, not committed to the dispatcher). Reads current `aviation.ts` + `sources/registry.ts`, writes `libs/db/seed/glossary.toml` + `sources.toml`.
- [ ] Run migrate-toml, commit the two generated TOML files.
- [ ] Rewrite `libs/aviation/src/registry.ts` to parse TOML on boot via `toml-codec`. Same exports as today (`AVIATION_REFERENCES`, `SOURCES`, `getReference`, etc).
- [ ] Delete `libs/aviation/src/references/aviation.ts`. Delete `libs/aviation/src/sources/registry.ts`'s hand-authored SOURCES array (move types to a types-only file if shared). Machine-generated `*-generated.ts` files untouched.
- [ ] Remove the migrate-toml script from the repo (or move to `.archive/` per CLAUDE.md rules).
- [ ] Verify: `bun run references validate` passes, study `/glossary` renders, wiki-link scan clean.

## Phase 2 — DB schemas + migrations

- [ ] Drizzle schema `libs/db/src/schemas/hangar.ts`. Namespace `hangar`. Tables: `reference`, `source`, `syncLog`, `job`, `jobLog`. Columns exactly per spec.
- [ ] Export from `libs/db/src/index.ts`.
- [ ] Generate migration via `bun run db generate`. Review SQL. Commit.
- [ ] Run `bun run db migrate` locally. Verify schema via `bun run db check`.

## Phase 3 — Job queue lib

- [ ] New workspace `libs/hangar-jobs/`. `package.json` with `@ab/hangar-jobs` name. `@ab/*` alias added to root `tsconfig.json`.
- [ ] `src/schema.ts` — TypeScript types for `JobKind`, `JobStatus`, `Job`, `JobLog`, `JobProgress`.
- [ ] `src/enqueue.ts` — `enqueueJob({ kind, targetType, targetId, actorId, payload })` inserts a row, returns the id.
- [ ] `src/query.ts` — `getJob(id)`, `listJobs({ kind?, status?, actorId?, limit })`, `readJobLog(jobId, { sinceSeq })`.
- [ ] `src/worker.ts` — `startWorker({ handlers })`. Loop: select oldest `queued`, respecting per-`targetId` exclusion, mark `running`, invoke handler, capture stdout/stderr into `jobLog` with monotonic seq, mark terminal status.
- [ ] Worker recovery: on boot, mark any `running` as `queued` with a log line "recovered from restart".
- [ ] Unit tests: enqueue+complete happy path, per-target serialisation, recovery, cancellation.

## Phase 4 — Sync service lib

- [x] New workspace `libs/hangar-sync/`. `@ab/hangar-sync`.
- [x] `src/detect-drift.ts` — compute drift between DB (`dirty = true` rows) and current on-disk TOML.
- [x] `src/detect-conflict.ts` — compare DB revs against the last successful sync's `rev_snapshot`; abort sync if any row advanced past the baseline.
- [x] `src/emit-toml.ts` — serialise dirty-applied DB state to TOML via `toml-codec`.
- [x] `src/emit-aviation-ts.ts` — regenerate `libs/aviation/src/references/aviation.ts` per Option 3 (keep the TS artifact so study's client bundle stays fast).
- [x] `src/commit-and-maybe-pr.ts` — two-mode runner (`commit-local` / `pr`); PR mode branches + pushes + opens a `gh pr create`.
- [x] `src/git.ts` — `ProcessRunner` interface backed by `node:child_process.spawn` so hangar (node) + scripts (bun) share one implementation; tests inject a fake runner.
- [x] `src/run-sync-job.ts` — `runSync` + `runSyncJob`. `executeSync` is the pure core state machine; `runSync` wraps it with the DB transaction (pg_advisory_xact_lock + loaders + writers); `runSyncJob` wraps `runSync` with the `@ab/hangar-jobs` `JobContext` adapter.
- [x] `libs/db/src/hangar.ts` extended with `rev_snapshot` column on `hangar.sync_log` (new `0002_hangar_sync_rev_snapshot.sql` migration).
- [x] `SYNC_OUTCOMES.NOOP` added to `libs/constants/src/jobs.ts`.
- [x] Unit tests for detect-drift, detect-conflict, emit-aviation-ts (round-trip + byte-identity), and end-to-end run-sync-job (happy, conflict, noop paths + pr-mode process-runner assertions).

## Phase 5 — Hangar job handler registration

- [x] `apps/hangar/src/lib/server/jobs.ts`: register the `sync-to-disk` handler wrapping `@ab/hangar-sync`.
- [x] Hook the worker startup into `hooks.server.ts` — module-scope `bootWorker()` fires once, `recoverOrphanedRunning` runs before `startWorker`, `beforeExit` requests a graceful drain.
- [x] Env plumbing: `HANGAR_SYNC_MODE` is resolved inside `resolveSyncMode(config)` with `commit-local` as the dev default.
- [x] `apps/hangar/svelte.config.js` alias entries added for `@ab/hangar-jobs`, `@ab/hangar-sync`, and `@ab/aviation` so the worker wiring resolves.

## Phase 6 — Edit UI (`/glossary`)

- [ ] `ROUTES.HANGAR.GLOSSARY*` constants.
- [ ] `/glossary/+page.server.ts` — load filtered, paginated reference list from DB. Filters + sort via URL params.
- [ ] `/glossary/+page.svelte` — table component, filter bar, pagination, "Sync all pending" action when dirty count > 0. All styling via theme tokens (no hex). Keyboard-accessible; focus states visible.
- [ ] `/glossary/new/+page.{server.ts,svelte}` — create form. Zod validate; server action uses `auditWrite` on success. 5-axis tag pickers driven by enums from `libs/constants/src/reference-tags.ts`.
- [ ] `/glossary/[id]/+page.{server.ts,svelte}` — detail/edit form. Carries `rev`; server rejects stale rev with 409 and surfaces diff preview.
- [ ] Markdown preview for `paraphrase`: reuse `libs/help/src/ui/MarkdownBody.svelte` if available; otherwise lightweight local render.
- [ ] Delete action: soft-delete (set `deleted_at`) since references might be cited; hard-delete behind ADMIN only.

## Phase 7 — Sources edit UI

- [ ] Mirror the `/glossary` stack at `/glossary/sources`. Smaller schema (no tags, no paraphrase). Same dirty-badge + sync integration.

## Phase 8 — Jobs UI

- [ ] `/jobs/+page.{server.ts,svelte}` — list, filterable by kind/status.
- [ ] `/jobs/[id]/+page.{server.ts,svelte}` — detail. Poll log at 1 Hz while `running`.
- [ ] Styling via theme tokens. "Running" status uses `--signal-warn-*`; "failed" uses `--signal-error-*`; etc.

## Phase 9 — Wire-up + nav

- [ ] `/` in hangar redirects to `/glossary` (replacing the scaffold's audit-ping home — move that demo to `/admin/audit-ping` or delete).
- [ ] Nav shell gains three links: Glossary, Sources, Jobs. Nav component lives in `apps/hangar/src/lib/components/Nav.svelte` using role tokens.

## Phase 10 — Gates

- [ ] `bun run check` clean
- [ ] All tests pass (`bun test`)
- [ ] Manual walkthrough against the test plan
- [ ] Theme enforcement: run the lint rule from [theme-system/03-ENFORCEMENT.md](../../platform/theme-system/03-ENFORCEMENT.md); zero violations in hangar code
- [ ] Contrast tests pass for (light, dark) × (all role-pairs hangar renders)
- [ ] No FOUC on first paint (verify by disabling JS then reloading)
- [ ] PR opened against main with `gh pr create`; do not self-merge

## Deferred (surface only, not implemented here)

- Presence indicators
- Bulk approve/revert
- Cron-based automatic sync
- SSE (stay on polling until sluggish)
- Public (non-admin) job log view
