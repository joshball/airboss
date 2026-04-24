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

- [ ] New workspace `libs/hangar-sync/`. `@ab/hangar-sync`.
- [ ] `src/detect-drift.ts` — compute drift between DB (`dirty = true` rows) and current on-disk TOML.
- [ ] `src/detect-conflict.ts` — compare on-disk TOML sha against the last `sync_log.commit_sha`; abort sync if drift detected.
- [ ] `src/emit.ts` — serialise dirty-applied DB state to TOML via `toml-codec`.
- [ ] `src/commit.ts` — `git add + commit` with structured message; returns SHA.
- [ ] `src/push-and-pr.ts` — push to `hangar-sync/<timestamp>`; `gh pr create` via `Bun.spawn`; returns PR URL.
- [ ] `src/run.ts` — entry point used by the `sync-to-disk` job handler: advisory lock, detect drift, detect conflict, emit, commit (or PR), clear `dirty`, write `sync_log`.
- [ ] Unit tests for detect-drift + detect-conflict + emit. Integration test with a temp git repo for commit.

## Phase 5 — Hangar job handler registration

- [ ] `apps/hangar/src/lib/server/jobs.ts`: register the `sync-to-disk` handler wrapping `@ab/hangar-sync`.
- [ ] Hook the worker startup into `hooks.server.ts` (fire-once on first request, or explicit boot hook — whichever matches the SvelteKit idiom).
- [ ] Env plumbing: `HANGAR_SYNC_MODE` read in the handler; default per-env.

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
