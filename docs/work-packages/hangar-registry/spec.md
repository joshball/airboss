---
title: 'Spec: Hangar registry (TOML-hybrid)'
product: hangar
feature: hangar-registry
type: spec
status: unread
review_status: pending
---

# Spec: Hangar registry (TOML-hybrid)

The foundational data-management WP for hangar. Migrates glossary + source registry from hand-authored TypeScript to checked-in TOML files; mirrors them into DB tables at runtime; builds the hangar `/glossary` edit UI; stands up the `hangar.job` queue + worker; ships the sync-to-disk service that writes TOML edits back with a git commit (local or gh PR). Everything in `wp-hangar-sources-v1` and `wp-hangar-non-textual` reuses the job queue and sync service this WP lands.

Orchestrator: [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md)
Locked plan: [20260422-hangar-data-management-plan.md](../../work/todos/20260422-hangar-data-management-plan.md)

## In scope

### Data migration

- Author `libs/aviation/src/toml-codec.ts`. Round-trips `Reference[]` and `Source[]` to/from TOML. Tested byte-identical for all 175 references + every source.
- One-shot generator script: read current `libs/aviation/src/references/aviation.ts` + `libs/aviation/src/sources/registry.ts`, emit `libs/db/seed/glossary.toml` + `libs/db/seed/sources.toml`.
- Rewrite `libs/aviation/src/registry.ts` to parse TOML on boot. Validate with Zod. Expose `AVIATION_REFERENCES` + `SOURCES` identically to today.
- Delete `libs/aviation/src/references/aviation.ts`. Machine-generated `*-generated.ts` files stay (they're verbatim blocks, not content).

### Database

Drizzle schemas in a new `hangar` namespace.

- `hangar.reference` — runtime mirror of `glossary.toml`. Columns: `id`, `rev` (int, optimistic lock), `display_name`, `aliases` (jsonb), `paraphrase` (text), `tags` (jsonb, 5-axis), `sources` (jsonb), `related` (jsonb), `dirty` (bool), `updated_at`, `updated_by`.
- `hangar.source` — runtime mirror of `sources.toml`. Columns: `id`, `rev`, `type`, `title`, `version`, `url`, `locator_shape` (jsonb), `checksum`, `downloaded_at`, `format`, `size_bytes`, `dirty`, `updated_at`, `updated_by`.
- `hangar.sync_log` — every sync-to-disk event. Columns: `id`, `actor_id`, `kind` (enum: `commit-local` | `pr`), `files` (jsonb), `commit_sha`, `pr_url` (nullable), `outcome` (enum: `success` | `conflict` | `failed`), `message`, `started_at`, `finished_at`.
- `hangar.job` — generic job row. Columns: `id`, `kind` (enum: all job kinds), `target_type` (nullable), `target_id` (nullable), `status` (queued | running | complete | failed | cancelled), `progress` (jsonb: `{ step, total, message }`), `result` (jsonb, nullable), `error` (text, nullable), `actor_id`, `created_at`, `started_at`, `finished_at`.
- `hangar.job_log` — append-only streamed output for a job. Columns: `id`, `job_id`, `seq`, `stream` (stdout | stderr | event), `line` (text), `at`.

Migrations under `libs/db/migrations/`. Seed reconciliation: on hangar boot, parse TOML, upsert into `hangar.reference` + `hangar.source` keyed by id, preserve `dirty` flags, flag any DB row whose source id is missing from TOML.

### Edit UI (`/glossary`)

- `/` in hangar redirects to `/glossary` (scaffold currently renders the audit-ping home; change to redirect).
- `/glossary` index: table of references with filters by tag axes (5 axis), free-text search over displayName/aliases/paraphrase, sort columns, pagination. Columns: id, displayName, sourceType, updated_at, dirty badge, last synced SHA (from `sync_log`).
- `/glossary/new`: create form. Fields: id (slug, validated), displayName, aliases (chip input), paraphrase (textarea with live markdown preview), 5-axis tag pickers (enum-driven dropdowns from `libs/constants/src/reference-tags.ts`), sources (repeatable group: type + locator JSON + url), related (id picker).
- `/glossary/[id]`: detail page. Same form as new, prefilled. Shows: audit log for this reference (last 20), sync state (clean / dirty / synced in SHA / synced in PR #123), rev number.
- Actions on detail: save, revert (discard local edits vs current DB), sync-one, delete.
- Global "Sync all pending" action in the table header; only enabled when `count(dirty = true) > 0`.
- Optimistic lock: form submits carry rev; server rejects stale writes with a 409 and a diff preview.

### Sources edit UI (`/glossary/sources` as a sibling tab for now)

- Table of sources with the same filter/sort pattern. Columns: id, type, title, version, updated_at, dirty badge.
- `/glossary/sources/new` + `/glossary/sources/[id]` mirror the reference forms.
- `wp-hangar-sources-v1` replaces this with the `/sources` interactive flow; for now, registry edits need a surface.

### Job queue + worker

- In-process Bun worker thread spawned at hangar server boot (`hooks.server.ts` startup hook).
- Picks `hangar.job` rows with `status = queued`, oldest first, respecting per-target-id serialisation (two fetches on the same source do not run simultaneously; two fetches on different sources do).
- Writes progress updates to `hangar.job.progress` and streams output into `hangar.job_log` with monotonic `seq`.
- On process restart, requeues any `running` rows as `queued` with a "recovered" log entry. No orphaned "stuck running" rows survive a restart.
- Exposes `enqueueJob(kind, target, actorId, payload)` from `libs/hangar-jobs/src/index.ts` (new lib).
- Job kinds landed in this WP: `sync-to-disk` (the only one actually run in this WP). WP3 adds fetch, upload, extract, build, diff, validate, size-report.

### `/jobs` route (skeleton)

- `/jobs` lists recent jobs (last 100 by default) with filters: kind, status, actor, target.
- `/jobs/[id]` shows one job: kind, target, status, progress, full log (streamed via polling at 1 Hz while `status = running`, static fetch once `complete | failed | cancelled`).
- WP3 promotes this to full parity with form-action triggers.

### Sync service

- New file `libs/hangar-sync/src/index.ts` (lib or inline in hangar — prefer lib so WP3 can reuse).
- Inputs: a set of dirty reference + source ids, the actor id, and the sync mode (`commit-local` | `pr`).
- Output: a `sync_log` row with outcome.
- Flow:
  1. Take an advisory lock on `hangar.sync_log` (single sync at a time).
  2. Reload DB rows for the dirty set.
  3. Re-emit `glossary.toml` + `sources.toml` via `toml-codec` from current DB state.
  4. Diff vs on-disk TOML. If diff is empty, mark dirty rows clean, record `success (no-op)`.
  5. If disk TOML has changed out-of-band since the last sync (compare sha of on-disk vs the sha stored at last successful sync), abort with `conflict`, surface both diffs, leave DB rows dirty.
  6. Write new TOML files.
  7. `git add libs/db/seed/glossary.toml libs/db/seed/sources.toml`.
  8. Commit with a structured message (template: `hangar: sync <N> references, <M> sources (actor: <id>)`).
  9. If mode = `commit-local`: record commit SHA, mark rows clean, record success.
  10. If mode = `pr`: push to `hangar-sync/<timestamp>` branch, `gh pr create`, record SHA + PR URL, mark rows clean, record success.
- Env controls: `HANGAR_SYNC_MODE = commit-local | pr` (default: `commit-local` in dev, `pr` in prod).

### Constants + routes

- `ROUTES.HANGAR.GLOSSARY`, `.GLOSSARY_NEW`, `.GLOSSARY_DETAIL(id)`, `.GLOSSARY_SOURCES`, `.GLOSSARY_SOURCES_NEW`, `.GLOSSARY_SOURCES_DETAIL(id)`, `.JOBS`, `.JOB_DETAIL(id)`.
- `AUDIT_TARGETS.HANGAR_REFERENCE`, `.HANGAR_SOURCE`, `.HANGAR_SYNC`, `.HANGAR_JOB`.
- Job kind enum in `libs/constants/src/jobs.ts`.

### Theme compliance (non-negotiable)

- Every new Svelte component uses role tokens from [04-VOCABULARY.md](../../platform/theme-system/04-VOCABULARY.md) — no hex, rgb, rgba, hsl, or named colors in `<style>` blocks.
- CSS tokens referenced by name (e.g. `--ink-1`, `--surface-raised`, `--edge-subtle`, `--action-primary-rest`). If a role doesn't exist in vocabulary, stop and add it there first; do not invent a local name.
- Appearance toggle (light/dark) continues to work end-to-end in hangar.
- WCAG AA contrast holds in every theme × appearance combination hangar exposes.
- No FOUC on first paint.

## Out of scope

- Interactive flow diagram at `/sources` — lives in wp-hangar-sources-v1
- Fetch / upload / extract / build / diff job kinds — the *queue* exists here; the job *runners* are in wp-hangar-sources-v1
- Chart / plate / diagram preview rendering — wp-hangar-non-textual
- Presence / "someone else is editing" — post-MVP
- Cron-based automatic sync — post-MVP
- Multi-file conflict resolution UI — out-of-band edits produce a conflict that the user resolves by editing TOML on disk; no in-UI 3-way merge

## Architecture notes

### Why TOML

Decided in the locked plan (§Registry strategy). JSON has no comments and noisy diffs; YAML has indentation footguns; TOML handles multiline `paraphrase` cleanly, supports comments, diffs one field per line. Round-tripping through `toml-codec` must be byte-identical for already-sorted TOML so diffs are minimal.

### Why DB-mirror, not direct TOML edits

Multi-user safety. Two concurrent edits to `glossary.toml` race at the filesystem. Two concurrent edits to `hangar.reference` (optimistic lock + transaction) don't. The TOML file stays authoritative on disk (read by study, read by the scanner, read by the extractor). Hangar is the only mutator, routes all writes through the DB, and syncs back.

### Why extract the job queue to a lib

`wp-hangar-sources-v1` needs the same queue for fetch/upload/extract/build/diff. Having it live in `libs/hangar-jobs/` from day one avoids a same-day refactor in WP3. The lib exposes `enqueueJob`, `getJob`, `listJobs`, `subscribeJobLog` (polling-friendly cursor-based read).

### Why sync-to-disk is itself a job kind

Uniform audit surface. The queue worker handles one kind of work (`kind = sync-to-disk`). The UI's "Sync all pending" button enqueues a job and redirects to `/jobs/<id>`. The user sees the commit happen live. Rollback (if it fails) is the same as any other failed job.

### Where the edit UI lives

`/glossary` in hangar, not `/references`. The user-facing shared surface across apps is `/glossary` (in study) — it makes sense for hangar's edit surface to use the same name. A second tab handles sources.

### Interplay with the reference system scripts

`scripts/references.ts` and its subcommands still work standalone. `bun run references scan`, `validate`, etc. read the TOML (via the library parse). After this WP, they never touch `aviation.ts` (it's deleted) or `sources/registry.ts` (it's deleted — the parsed SOURCES collection still lives in `libs/aviation/src/registry.ts`, just hydrated from TOML).

## Dependencies

- `libs/audit/` (shipped in wp-hangar-scaffold)
- `libs/constants/` (extended here with new routes + job kinds)
- `libs/aviation/` (extended here with toml-codec + registry rewrite)
- `libs/db/` (connection + new `hangar` schema)
- `libs/hangar-jobs/` (new lib, created here)
- `libs/hangar-sync/` (new lib, created here)
- `@ab/themes` (no changes needed; hangar pulls tokens already)
- better-auth (session + role gate — already wired)

## Success criteria

- [ ] `bun run check` clean
- [ ] `bun run dev hangar` boots cleanly, no console errors
- [ ] All 175 references round-trip TOML <-> DB byte-identical (snapshot test)
- [ ] `/glossary` renders the table; each row links to a working detail page
- [ ] Edit a reference, submit, see dirty badge, hit "Sync all pending"; commit lands on `main` in dev mode (PR opens in prod mode)
- [ ] Two actors editing different references at the same time both succeed; same reference at the same time produces a 409 with a clear diff
- [ ] Kill the hangar server mid-sync; restart; the job requeues and completes
- [ ] `/jobs` lists the sync job with a streamed log
- [ ] Study's `/glossary` still renders correctly, reads identical content, no DB dependency
- [ ] Zero hardcoded colors (verify with lint rule from [theme-system/03-ENFORCEMENT.md](../../platform/theme-system/03-ENFORCEMENT.md))
- [ ] Every mutating action audits
- [ ] Contrast tests pass (WCAG AA) in light + dark appearance
