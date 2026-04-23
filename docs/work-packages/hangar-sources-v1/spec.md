---
title: 'Spec: Hangar sources v1'
product: hangar
feature: hangar-sources-v1
type: spec
status: unread
review_status: pending
---

# Spec: Hangar sources v1

The interactive operations surface for source documents. `/sources` becomes the primary admin experience: an HTML version of the reference-system flow diagram where every touchpoint is a live affordance (fetch, upload, extract, build, diff, validate, size-report). Reuses the `hangar.job` queue and sync service shipped in `wp-hangar-registry`. Wraps the CLI `bun run references <cmd>` as form actions + job handlers so everything the terminal can do happens in the UI with a streamed log.

Orchestrator: [20260423-hangar-finish-plan.md](../../work/todos/20260423-hangar-finish-plan.md)
Locked plan: [20260422-hangar-data-management-plan.md](../../work/todos/20260422-hangar-data-management-plan.md)
Reference flow doc: [REFERENCE_SYSTEM_FLOW.md](../../platform/REFERENCE_SYSTEM_FLOW.md)

## In scope

### `/sources` index — interactive flow diagram

Primary artifact. An SVG / Svelte-component rendering of the pipeline from [REFERENCE_SYSTEM_FLOW.md](../../platform/REFERENCE_SYSTEM_FLOW.md). Every node and every bracketed affordance is live.

Nodes (top -> bottom):

- **Content** box: count of wiki-links + count of help pages + count of TBD-ids. Click -> modal listing them. No action buttons (content is edited in its own markdown / TS files).
- **Manifest** box: count of cited ids + refresh timestamp. Button: `Rescan`. Enqueues a `scan` job.
- **Validation** box: error + warning counts. Button: `Revalidate`. Enqueues a `validate` job.
- **Source registry** panel (below validation): one row per source with `{ id, type, title, version, state, counts, actions }`. State shows `pending download` / `downloaded` / `extracted`. Counts show `cited-by / verbatim-materialised`. Action buttons: `Fetch`, `Upload`, `Extract`, `Diff`, `Open`.
- **Registry merge** box: count of references + sources. No action (read-only derived state).
- **Glossary render** box: link to `/glossary` (hangar edit) and link to study's `/glossary` (read).

The flow connects these with arrows that animate briefly when a connected job is running (progress affordance). Theme token compliant. Keyboard-navigable: Tab moves through affordances left-to-right, top-to-bottom.

Status panel below the diagram:

| Metric                                | Pulled from                   |
| ------------------------------------- | ----------------------------- |
| Registered sources                    | `hangar.source` count         |
| Downloaded                            | sources with `checksum` not null |
| Verbatim blocks materialised          | count of verbatim in `*-generated.ts` |
| TBD wiki-links                        | `references validate` output  |
| Validation                            | latest `validate` job result  |
| Freshness                             | oldest source `downloaded_at` |

### `/sources/[id]` — source detail

- Header: id, type, title, version, url, actions (`Fetch`, `Upload`, `Extract`, `Diff`, `Validate this source`, `Delete`).
- State cards: binary-on-disk state, meta.json state, checksum match, cited-by count, verbatim-coverage count, last-successful-action timestamp.
- Locator shape: JSON editor for source-type-specific locator fields (e.g., CFR uses `{ title, part, section }`).
- Last 20 audit rows filtered to this target.
- Embedded `/sources/[id]/files` filesystem browser (see below).

### `/sources/[id]/files` — filesystem browser

- Lists `data/sources/<type>/*` (the files owned by this source).
- For each file: name, size, mtime, actions (`Preview`, `Download`, `Delete` behind ADMIN).
- Preview kind is determined by extension and rendered inline: `.xml` formatted, `.json` pretty-printed, `.md` rendered, `.pdf` via object embed, `.csv` via tabular view, binary/unknown via "no preview available" + download link.

### `/sources/[id]/diff` — verbatim diff view

- Runs `references diff <id>` as a `diff` job.
- Renders hunks with syntax-highlighted diff. Collapsible per-id sections (one section per reference whose verbatim changed).
- Actions: `Commit this diff` (writes an updated `*-generated.ts` and enqueues a sync-to-disk job for that file) or `Discard` (no-op, the committed file stays as it was).

### `/sources/[id]/upload` — versioned upload

- Multipart form. Accepts one file.
- On submit: compute sha256, write binary to `data/sources/<type>/<id>.<ext>`, archive previous file under `<id>@<version>.<ext>` if version changed, update `hangar.source` row with new checksum + downloaded_at + size, audit.
- Rejects if sha matches current checksum (pass-through with a "no change" toast).
- Enforced size limit via env (default 500 MB for PDFs, configurable per source type).

### `/jobs` + `/jobs/[id]` — extended from WP2

- Job kinds added in this WP: `fetch`, `upload`, `extract`, `build`, `diff`, `validate`, `size-report`.
- Each is a thin handler that wraps a `bun run references <cmd>` subprocess (`Bun.spawn`), streaming stdout + stderr into `hangar.job_log`.
- For `diff`: result jsonb contains the parsed hunks for rendering in `/sources/[id]/diff`.
- For `size-report`: result jsonb contains the size-classification table.

### Forms use the reference-system scripts

Each form action does:

1. Validate input (Zod).
2. Audit-log the trigger.
3. `enqueueJob({ kind, targetType: 'hangar.source', targetId: id, actorId, payload })`.
4. 303 redirect to `/jobs/[id]` so the user watches the live log.

### Download library

- Port `scripts/faa-ingest/lib/download.ts` from airboss-firc into `libs/aviation/src/sources/download.ts`.
- Same interface: `downloadFile(url, destPath) -> Promise<{ sha256, sizeBytes }>`.
- Respects etag + If-None-Match for the skip-if-unchanged case.
- Timeout + retry policy set via constants (`libs/constants/src/sources.ts`).

### UI components ported from FIRC

Under `libs/ui/src/components/`, theme-compliant:

- `DataTable.svelte` — the filterable sortable table base used across `/sources`, `/glossary`, `/jobs`
- `FormStack.svelte` — vertical form layout with consistent spacing via `--space-*` tokens
- `ConfirmDialog.svelte` — "are you sure?" dialog wrapping `ConfirmAction` behaviour
- `ValidationReport.svelte` — renders a validation result (errors / warnings / info) in theme-compliant panels

All re-authored to use role tokens. No FIRC colour choices survive.

### Constants

- `ROUTES.HANGAR.SOURCES`, `.SOURCE_DETAIL(id)`, `.SOURCE_FILES(id)`, `.SOURCE_DIFF(id)`, `.SOURCE_UPLOAD(id)`
- `AUDIT_TARGETS.HANGAR_SOURCE_*` (fetch, upload, extract, diff, validate, delete)
- `JOB_KINDS` enum extended with the new kinds
- `SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES` etc.

### Theme compliance

Same bar as WP2. Any new component must:

- Use role tokens from [04-VOCABULARY.md](../../platform/theme-system/04-VOCABULARY.md)
- Pass the token-enforcement lint from [03-ENFORCEMENT.md](../../platform/theme-system/03-ENFORCEMENT.md)
- Contrast-check in light + dark appearance
- No FOUC

### Nav

- `/sources` replaces `/glossary` as the primary redirect target (`/` -> `/sources`)
- Nav: Sources | Glossary | Jobs

## Out of scope

- Chart / plate / diagram types — `wp-hangar-non-textual`
- Cron-based automatic refresh — post-MVP
- Cross-source bulk diff review (one source at a time is fine)
- Analytics / dashboards

## Architecture notes

### Why the flow diagram is the primary surface

The reference-system flow is the mental model. Every admin action maps to a touchpoint in that flow. A table of sources alone doesn't communicate "what does fetching do / why does extract come next / what's waiting on what." The diagram does. Once an operator has seen it once, the table-only detail pages make sense.

### Why job handlers shell out to `bun run references`

The dispatcher already exists, already has `--help`, already handles argument parsing and error codes. Wrapping it in a handler (instead of reimplementing) keeps the source of truth in one place. If an author runs `bun run references extract` from a terminal, they get the same behaviour as hangar's UI.

### Why uploads version-archive the old file

Yearly reg refreshes replace the same file (cfr-14.xml). Keeping the previous version under `cfr-14@2025.xml` enables the diff review to be meaningful ("compare this year's verbatim to last year's"). Archive retention is configurable (default: keep latest 3).

### Why diff review commits the updated `*-generated.ts`

Extraction produces the verbatim; diff shows what changed; the author reviews. Committing the file is the "accept the change" action. Without this, every yearly refresh would require a manual `git add` from a terminal.

### Concurrency constraints

- Two fetches on the same source id: serialised (per-target lock in the worker).
- Two fetches on different source ids: parallel.
- Upload + extract on the same source: serialised. Trying to upload while extract is running returns a 409 "source is busy, try again when job X finishes".

## Dependencies

- All WP2 deliverables must be merged before starting
- `libs/hangar-jobs/` exists and works
- `libs/hangar-sync/` exists and works
- `hangar.source` table exists and holds the registry

## Success criteria

- [ ] `bun run check` clean
- [ ] `/sources` renders the flow diagram with live counts
- [ ] Click `Fetch` on a registered source: job runs, binary lands on disk, checksum recorded, audit row written
- [ ] Click `Upload` with a real file: versioned-archive happens, old file preserved
- [ ] Click `Extract`: `*-generated.ts` updates, verbatim count ticks up
- [ ] Click `Diff` after extract: hunks render, "Commit this diff" writes the generated file + enqueues sync
- [ ] Click `Validate`: full validator runs, result renders inline
- [ ] Two users can act on different sources simultaneously
- [ ] Everything tab-navigable; focus states visible
- [ ] Theme invariants hold; zero hardcoded colors
- [ ] `/etc/hosts` + setup unchanged (hangar already works from WP1)
- [ ] Manual walkthrough passes end-to-end, including a full yearly-refresh simulation
