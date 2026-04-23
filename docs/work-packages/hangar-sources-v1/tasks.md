---
title: 'Tasks: Hangar sources v1'
product: hangar
feature: hangar-sources-v1
type: tasks
status: unread
review_status: pending
---

# Tasks: Hangar sources v1

Depends on `wp-hangar-registry` being merged to main.

## Phase 1 — Download + UI ports

- [ ] Port `downloadFile` from airboss-firc `scripts/faa-ingest/lib/download.ts` into `libs/aviation/src/sources/download.ts`. Add retry + etag handling.
- [ ] Port `DataTable.svelte` into `libs/ui/src/components/`. Re-author to use role tokens.
- [ ] Port `FormStack.svelte` into `libs/ui/src/components/`. Role tokens only.
- [ ] Port `ConfirmDialog.svelte` — wrap existing `ConfirmAction` if already present; otherwise port fresh.
- [ ] Port `ValidationReport.svelte`. Role tokens only.
- [ ] Unit tests: `downloadFile` with mocked HTTP server (happy, retry, 304).

## Phase 2 — Job handlers

- [ ] Extend `JobKind` enum with `fetch | upload | extract | build | diff | validate | size-report`.
- [ ] Register handlers in `apps/hangar/src/lib/server/jobs.ts`. Each handler spawns `bun run references <cmd>` with scoped args.
- [ ] Stream stdout + stderr into `hangar.job_log`; parse final JSON (if emitted) into `job.result`.
- [ ] Upload handler: accepts the payload (sha + destPath), no subprocess; writes file + updates source row.
- [ ] Unit tests per handler (mock the subprocess for cmd-based ones).

## Phase 3 — `/sources` flow diagram

- [ ] `ROUTES.HANGAR.SOURCES*` constants.
- [ ] `+page.server.ts` load: pull source list + manifest summary + validation result + verbatim counts.
- [ ] `+page.svelte`: diagram component (SVG + Svelte). Each node is a Svelte component with tokens. Arrows drawn with `<path>` using `--edge-subtle` stroke; animated briefly when a connected job is running (CSS `@keyframes` on `--motion-dash-offset`).
- [ ] Source table below the diagram: `DataTable` with per-row action buttons.
- [ ] Status panel tiles.
- [ ] `Rescan`, `Revalidate`, `Build`, `Size report` global actions each enqueue the matching job.

## Phase 4 — Source detail + files + diff + upload

- [ ] `/sources/[id]/+page.{server.ts,svelte}` — detail.
- [ ] `/sources/[id]/files/+page.{server.ts,svelte}` — filesystem browser. Per-extension preview components under `apps/hangar/src/lib/components/preview/`.
- [ ] `/sources/[id]/diff/+page.{server.ts,svelte}` — hunk renderer. Enqueues diff job on load if none recent; otherwise shows cached `job.result`.
- [ ] `/sources/[id]/upload/+page.server.ts` — multipart action. Size limit from constants. Checksum + version-archive logic.
- [ ] Delete action gated to ADMIN.

## Phase 5 — `/jobs` live view

- [ ] `/jobs/+page.{server.ts,svelte}` — list with filters.
- [ ] `/jobs/[id]/+page.{server.ts,svelte}` — detail.
- [ ] Live log: polling hook reads `readJobLog(jobId, sinceSeq)` at 1 Hz until status is terminal.
- [ ] Cancel action for `queued` + `running` jobs (respects the cancellation contract in the worker).

## Phase 6 — Nav + redirect

- [ ] Change `/` redirect from `/glossary` to `/sources`.
- [ ] Nav: `Sources | Glossary | Jobs`.
- [ ] Breadcrumbs on detail pages.

## Phase 7 — Polish

- [ ] Empty states on every list + diagram node.
- [ ] Loading skeletons for the flow diagram while counts load.
- [ ] Error boundaries for each job panel.
- [ ] Toast notifications for action triggers (links to `/jobs/[id]`).

## Phase 8 — Gates

- [ ] `bun run check` clean
- [ ] All tests pass
- [ ] Theme-enforcement lint zero violations in `apps/hangar/**` + `libs/ui/**`
- [ ] Contrast tests pass across appearances
- [ ] Manual walkthrough passes
- [ ] PR opened via `gh pr create`
