---
title: 'Tasks: Hangar sources v1'
product: hangar
feature: hangar-sources-v1
type: tasks
status: unread
review_status: done
---

# Tasks: Hangar sources v1

Depends on `wp-hangar-registry` being merged to main.

## Phase 1 — Download + UI ports

- [x] Port `downloadFile` from airboss-firc `scripts/faa-ingest/lib/download.ts` into `libs/aviation/src/sources/download.ts`. Add retry + etag handling.
- [x] Port `DataTable.svelte` into `libs/ui/src/components/`. Re-author to use role tokens.
- [x] Port `FormStack.svelte` into `libs/ui/src/components/`. Role tokens only.
- [x] Port `ConfirmDialog.svelte` — wrap existing `ConfirmAction` if already present; otherwise port fresh.
- [x] Port `ValidationReport.svelte`. Role tokens only.
- [x] Unit tests: `downloadFile` with mocked HTTP server (happy, retry, 304).

## Phase 2 — Job handlers

- [x] Extend `JobKind` enum with `fetch | upload | extract | build | diff | validate | size-report`. (Reserved in WP2; wired here.)
- [x] Register handlers in `apps/hangar/src/lib/server/jobs.ts`. Each handler spawns `bun run references <cmd>` with scoped args.
- [x] Stream stdout + stderr into `hangar.job_log`; parse final JSON (if emitted) into `job.result`.
- [x] Upload handler: accepts the payload (sha + destPath), no subprocess; writes file + updates source row.
- [x] Unit tests per handler (mock the subprocess for cmd-based ones).

## Phase 3 — `/sources` flow diagram

- [x] `ROUTES.HANGAR_SOURCES*` constants.
- [x] `+page.server.ts` load: pull source list + manifest summary + validation result + verbatim counts.
- [x] `+page.svelte`: diagram component. Each node is a Svelte component with tokens. (Tile + arrow rendering; the CSS-keyframe arrow animation is deferred to a follow-up -- captured in 20260424-05-TODO.md.)
- [x] Source table below the diagram with per-row action chips.
- [x] Status panel tiles.
- [x] `Rescan`, `Revalidate`, `Build`, `Size report` global actions each enqueue the matching job.

## Phase 4 — Source detail + files + diff + upload

- [x] `/sources/[id]/+page.{server.ts,svelte}` — detail.
- [x] `/sources/[id]/files/+page.{server.ts,svelte}` — filesystem browser with inline previews keyed on extension (text/XML/JSON/CSV/Markdown; PDF + binary fall through to no-inline-preview).
- [x] `/sources/[id]/diff/+page.{server.ts,svelte}` — hunk renderer reading the latest diff-source job result.
- [x] `/sources/[id]/upload/+page.server.ts` — multipart action. Size limit from constants. Checksum + version-archive logic lives in the upload handler.
- [x] Delete action gated to ADMIN (archived versions only).

## Phase 5 — `/jobs` live view

- [x] `/jobs/+page.{server.ts,svelte}` — list with filters. (Inherited from WP2; new job kinds surface automatically via `JOB_KIND_VALUES`.)
- [x] `/jobs/[id]/+page.{server.ts,svelte}` — detail with 1 Hz log polling + cancel action (WP2).

## Phase 6 — Nav + redirect

- [x] Change `/` redirect from `/glossary` to `/sources`.
- [x] Nav: `Sources | Glossary | Jobs`.
- [x] Breadcrumbs on detail pages (source detail / files / diff / upload).

## Phase 7 — Polish

- [x] Empty states on every list + diagram node.
- [x] Error boundary for `/sources` (`+error.svelte`).
- [x] Action triggers redirect to `/jobs/[id]` with live log (implicit toast alternative).

## Phase 8 — Gates

- [x] `bun run check` clean
- [x] All new tests pass (38 new tests across 5 files)
- [x] Theme-enforcement lint zero violations in `apps/hangar/**` + `libs/ui/**`
- [x] Contrast: role-token pairs preserved across appearances (enforced by `libs/themes` contracts)
- [x] PR opened via `gh pr create`
