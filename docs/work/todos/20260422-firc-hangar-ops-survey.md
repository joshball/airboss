# FIRC hangar / ops / downloader survey

Research date: 2026-04-22. Target repo surveyed: `/Users/joshua/src/_me/aviation/airboss-firc` (read-only).

## TL;DR

airboss-firc already ships a full `apps/hangar/` admin app (auth-guarded, role-gated, with references CRUD, task board, validation triggers, compliance dashboards) and a standalone `scripts/faa-ingest/` CLI that downloads the full FAA corpus (PHAK, AFH, AIM, PCG, ACS, eCFR Title 14) with hash/ETag tracking into `data/faa/`. What is missing is the marriage of the two: no UI triggers the downloader, the hangar references table is metadata-only (title/type/source/url, no file pipeline), and `data/faa/manifest.json` has no app-facing representation. The biggest gap for airboss's data-management need is a UI surface that owns the `data/sources/` lifecycle (fetch/replace/version + trigger `references extract|build|diff|validate`) and can extend beyond text to charts/plates.

## What exists in airboss-firc

### apps/hangar (exists, substantial, shipped)

Path: `/Users/joshua/src/_me/aviation/airboss-firc/apps/hangar/`

Auth: `requireAuth` in `src/routes/+layout.server.ts` redirects anon to login. `(app)/+layout.server.ts` gates the whole app to `AUTHOR | OPERATOR | ADMIN`. Wrong-role users are redirected to their correct app via `getAppUrlForRole`, not 403'd.

Nav groups (from `apps/hangar/src/routes/(app)/+layout.svelte`):

- Content: Scenarios, Modules, Questions, Micro-lessons, Student Models, Competencies, Publish
- References: Library
- Compliance: Dashboard, Traceability, Validation, TCO, FAA Package, Submissions, Regulatory Checks
- Tasks: Board
- Docs: Browse
- Review: Work Packages
- Analytics: Coverage, Inventory, Questions, Time

Dashboard (`(app)/+page.svelte`) is a simple `StatCard` grid of content counts with `ROUTES.*` links, loaded from BC counts.

Route index (relevant to data-management):

| Route                            | Purpose                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/references`                    | List of `course.reference_document` rows with title/type/source/version/filter form + Add Document                                  |
| `/references/new`                | Create form: title, documentType, source, version, url, tags, notes. No file upload.                                                |
| `/references/[id]`               | Detail: metadata + linked content items (scenarios/modules/competencies/questions).                                                 |
| `/references/[id]/edit`          | Update, supersede (auto-creates compliance tasks for every linked content item), soft-delete.                                       |
| `/publish`                       | "Publish current content as new release" form: version + changelog; action calls `publishRelease()` in `@firc/bc/course/publish`.   |
| `/compliance/validation`         | "Run Validation" button -> server action calls `runValidation()` in `@firc/bc/compliance` -> renders `ValidationReport` component.  |
| `/compliance/dashboard`          | Compliance status overview.                                                                                                         |
| `/compliance/regulatory-checks`  | 90-day FAA policy monitoring workflow: checklist form, changes-found toggle, auto-creates tasks.                                    |
| `/tasks/board`                   | Kanban board. Drag-drop between columns. Filtered by type + product area. Receives auto-generated tasks from supersedes and checks. |
| `/docs/[...path]`                | Filesystem-backed browser of `docs/` from `REPO_ROOT` (via `@firc/work`). Already a pattern for exposing on-disk trees in the app.  |

DB tables owned / touched (from `libs/bc/course/src/schema.ts`):

- `course.reference_document` - id, title, documentType, source, version, url, filePath (column exists, unused by UI), tags jsonb, notes, isSuperseded, supersededById, createdAt, updatedAt
- `course.reference_link` - bidirectional join (refDocId x entityType x entityId), unique on triple
- `published.release` + `published.release_changeset` - immutable snapshots, version + faaStatus + changelog
- `compliance.regulatory_check` (per spec) - 90-day check ledger with auto-task linkage

Quality: looks complete and shipped. The reference-library spec at `docs/products/hangar/features/reference-library/spec.md` is marked `status: done` and the code matches. Compliance validation is real: the page action invokes a BC-level validator, logs an audit entry, returns a typed `ValidationReport`.

What hangar does NOT do:

- No UI for downloading source binaries
- No UI for file upload (form has a `filePath` column but no multipart handler)
- No UI for running extract/build/diff
- No UI for `data/faa/manifest.json` state
- No surface for non-text sources (charts, plates)

### apps/ops (exists, focused on people and records)

Path: `/Users/joshua/src/_me/aviation/airboss-firc/apps/ops/`

Auth: same hooks.server.ts pattern; `(app)/+layout.server.ts` gates to `OPERATOR | ADMIN`.

Nav (from `apps/ops/src/routes/(app)/+layout.svelte`):

- Operations: Dashboard, Users, Enrollments, Certificates, Records, Audit Trail, Analytics
- Account: Settings

Route index:

| Route                                | Purpose                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `/users`                             | Paginated user list, filter by role + status, Admin-gated "Invite user" button     |
| `/users/invite`                      | Admin-only form: email, first/last, role, address. Calls better-auth admin API.    |
| `/users/[id]`                        | User detail (role/status/ban management)                                            |
| `/enrollments`, `/enrollments/new`, `/enrollments/[id]`, `/enrollments/[id]/progress` | Enrollment CRUD + progress view                           |
| `/certificates`, `/certificates/issue`, `/certificates/[id]`, `/certificates/[id]/pdf` | Certificate issuance + PDF render                           |
| `/records`, `/records/learner/[userId]`, `/records/audit`                            | FAA-retention records view + audit log viewer              |
| `/analytics/*`                       | Learner, content, operational analytics dashboards                                  |

Quality: shipped. The user invite flow integrates with better-auth's admin API, parses a Zod `inviteUserSchema`, writes an audit log via `@firc/audit`. Paginated DataTable pattern is reusable.

What ops owns: people (users, roles, bans, invites), enrollments, certificates, learner records, audit trail. It is read-heavy and writes enrollment/certificate/user rows. Zero content editing, zero data-management primitives.

### Downloader tooling: scripts/faa-ingest/

Path: `/Users/joshua/src/_me/aviation/airboss-firc/scripts/faa-ingest/`. Invoked via `bun run faa <command>` (registered at `package.json` line 21).

Structure:

```text
scripts/faa-ingest/
  index.ts                 CLI dispatcher (fetch, extract, status, pcg, glossary, index, pages, seed-glossary, validate, all)
  manifest.ts              Typed MANIFEST[] of 18 FAA documents (manuals, acs, reference, ecfr) + state types
  lib/
    download.ts            fetch with HEAD pre-check, 3-attempt exponential backoff, .part temp, SHA-256 hashing
    manifest-state.ts      read/write data/faa/manifest.json (per-entry: downloadedAt, sha256, fileSize, lastModified, etag, extractedAt)
    paths.ts               data/faa/raw/{manuals,acs,reference,ecfr}/ and data/faa/extracted/...
    pdf-extractor.ts       pdftotext wrapper (requires brew install poppler)
    xml-parser.ts          eCFR XML splitter into part-level fragments
  commands/
    fetch.ts               Download per manifest; skips if sha256 matches, force flag re-downloads
    extract.ts             PDF->txt via pdftotext; eCFR XML -> per-part XML/TXT/MD
    status.ts              Pretty terminal table: id, category, downloaded?, size, fetched date, extracted?
    glossary.ts            CFR Part 1 definitions
    index-cmd.ts           Build citation index
    pcg.ts                 Parse Pilot/Controller Glossary
    pages.ts               Generate browsable reference pages under docs/faa-docs/
    seed-glossary.ts       Produce draft glossary entries
    validate.ts            FAA submission package validator (no DB)
```

MANIFEST entries (18 total): PHAK, AFH, AIH, IFH, IPH, AWH, WBH, RMH, 4 ACS (private, instrument, commercial, CFI), ACS companion, AIM, PCG, chart-guide, AC 00-45H, ECFR-title14. Each has id, name, category, url, filename, faaDocId.

State file `data/faa/manifest.json` tracks per-document `{ downloadedAt, sha256, fileSize, lastModified, etag, extractedAt }`. This is exactly the shape airboss's `<id>.meta.json` sidecar wants (with `extractedAt` as a bonus).

Quality: complete, shipped, used. User agent, retry logic, streaming to `.part` then rename, hash-based skip, HEAD fallback when servers reject HEAD. Has never been surfaced in UI; 100% CLI.

### Other relevant surfaces

- `apps/hangar/src/routes/(app)/docs/` - filesystem docs browser. Pattern for "expose repo dirs through authenticated UI" is already solved. Uses `@firc/work.REPO_ROOT`.
- `apps/hangar/src/routes/(app)/tasks/board/` - job/task trigger model lives here (manual + auto-created). Not a job queue; just rows with a kanban UI. Good enough for trigger-and-forget workflows if we want to defer long-running extract jobs.
- `apps/sim/src/routes/faa-reference/` (via `ROUTES.SIM_FAA_REFERENCE`) - learner-facing read surface over the extracted FAA corpus. Uses the `docs/faa-docs/` output of `bun run faa pages`.
- `libs/bc/course/src/publish.ts` - immutable snapshot pattern. Same shape airboss would want for versioned source releases.
- `libs/bc/compliance` (referenced via `runValidation`) - server-side validator runner that returns a typed report. Same shape airboss needs for surfacing `references validate` results.
- `libs/audit` (`logAction`, `auditError`) - every server action in hangar/ops logs an audit row. Portable.

## How firc splits hangar vs ops

Hangar is the **content workshop + compliance command center**: authors and admins shape what learners consume (scenarios, modules, questions, references, releases, regulatory checks, tasks). Ops is the **people and records surface**: operators and admins manage users, enrollments, certificates, and the audit/records trail. Reference documents and compliance validation live in hangar today; user management and auth administration live in ops. Both apps share the same `(public)/login` + `requireRole` + better-auth substrate, and both write through `@firc/audit`, but they own disjoint BC writes. Nothing in firc touches the "fetch the raw FAA corpus" axis from inside a webapp - that is exclusively the `bun run faa` CLI.

## What's portable

| firc path                                                                | airboss target                                                       | salvage value                  | port effort                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| `scripts/faa-ingest/manifest.ts`                                         | `libs/aviation/src/sources/registry.ts` (airboss already has stub)   | High                           | Low: already aligned in shape; reconcile with airboss SOURCES       |
| `scripts/faa-ingest/lib/download.ts`                                     | `libs/aviation/src/sources/download.ts` (new)                        | High                           | Low: drop-in. Streaming + hash + retry is what you want             |
| `scripts/faa-ingest/lib/manifest-state.ts`                               | `libs/aviation/src/sources/meta.ts` (per-source `.meta.json`)        | High                           | Low: per-document meta already close; promote to sidecar-per-source |
| `scripts/faa-ingest/commands/status.ts`                                  | hangar `/sources` index page loader                                  | High (logic), Low (CLI output) | Medium: reuse hasDownload/hasExtraction checks, render as UI        |
| `scripts/faa-ingest/commands/fetch.ts`                                   | hangar `/sources/[id]?/fetch` form action                            | High                           | Medium: wrap `runFetch` in a form action + audit log                |
| `scripts/faa-ingest/commands/extract.ts`                                 | hangar `/sources/[id]?/extract` form action                          | High                           | Medium: same wrap                                                   |
| `apps/hangar/src/routes/(app)/+layout.svelte` (shell + nav + theme wire) | `apps/hangar/src/routes/(app)/+layout.svelte`                        | High                           | Low: port shape, drop FIRC-specific nav groups                      |
| `apps/hangar/src/routes/(app)/+layout.server.ts` (role gate)             | same                                                                 | High                           | Trivial                                                             |
| `apps/hangar/src/routes/(app)/references/*` (CRUD pattern)               | hangar `/sources/*` CRUD                                             | High (pattern), Low (schema)   | Medium: borrow DataTable/FormStack/ConfirmDialog + action shapes    |
| `apps/hangar/src/routes/(app)/docs/*` (FS browser)                       | hangar `/data` or `/sources/[id]/files`                              | High                           | Low: same `readdir` loader pattern                                  |
| `apps/hangar/src/routes/(app)/compliance/validation/*`                   | hangar `/validate` (or per-source)                                   | High                           | Low: swap `runValidation()` for `references validate` runner        |
| `apps/hangar/src/routes/(app)/publish/*`                                 | "Build generated refs + commit" trigger (if we keep the verb)        | Medium                         | Medium: conceptually fits `references build`                        |
| `apps/hangar/src/routes/(app)/tasks/board/*`                             | hangar `/jobs` (if we want async job queue over kanban)              | Medium                         | Medium: reuse schema + drag-drop UX; retire FIRC-specific task types |
| `apps/ops/src/routes/(app)/users/*`, `users/invite/*`                    | airboss ops `/users/*`                                               | High                           | Low: better-auth + Zod schema + audit are repo-agnostic             |
| `apps/ops/src/routes/(app)/+layout.*` (role gate + shell)                | airboss ops shell                                                    | High                           | Trivial                                                             |
| `libs/auth/src/auth.ts` (`requireAuth`, `requireRole`)                   | `libs/auth/src/auth.ts`                                              | High                           | Trivial                                                             |
| `libs/constants/src/roles.ts` + `app-urls.ts`                            | `libs/constants/src/roles.ts`                                        | High                           | Trivial: 4 roles (learner, author, operator, admin) already right   |
| `libs/audit` + audit-log pattern                                         | `libs/audit` (new)                                                   | High                           | Low: one table + `logAction`/`auditError` helpers                   |
| `libs/bc/course/src/schema.ts` `reference_document` + `reference_link`   | Consider mirroring as `sources.source_document` if DB-backed desired | Medium                         | N/A today: airboss registry is code, not DB. Revisit if schema flips |

## What's NOT portable

- **Carrier / NATOPS / flight deck metaphor.** Any hangar UI text that calls sections "the island" or "the flight deck" or leans on the carrier theme is FIRC-branded. airboss is post-pivot: broader platform, neutral aviation voice.
- **FIRC-specific compliance surface.** `/compliance/tco`, `/compliance/submissions`, `/compliance/package`, `/compliance/traceability`, the FAA-submission-package validator. These exist because FIRC is a regulated FAA course. airboss (study / reference platform) has no FAA submission lifecycle.
- **Regulatory 90-day check workflow** (`/compliance/regulatory-checks`). This is AC 61-83K-driven for FIRC. airboss doesn't have that constraint; its "is the source current?" question is answered by the registry's `updated` date + freshness check in `references validate`.
- **Release / publish to `published.*` schema.** FIRC publishes immutable content snapshots for sim learners. airboss's equivalent is committing `*-generated.ts` to git. Different mechanism; don't port as-is.
- **Content tables** (`course.scenario`, `course.module`, `course.question`, etc.). airboss authors knowledge-graph nodes as markdown files, not BC rows.
- **FAA cert issuance** (ops `/certificates`). Not applicable to airboss.
- **Enrollment management + learner progress + records retention**. FIRC-course-lifecycle features; airboss doesn't sell courses.
- **`pdftotext` dependency on poppler.** airboss's per-source extractor plugs in at `libs/aviation/src/sources/<type>/extract.ts`. We don't want a global PDF-to-TXT monolith; each source owns its parser. The firc pdf-extractor can live inside `poh/extract.ts` or wherever, but not as a shared lib.

## Gap to airboss's data-management need

airboss needs a **sources surface** that fuses two things firc keeps apart: the manifest/download/hash state (firc CLI) and the admin UI (firc hangar). Specifically:

Already solved by porting:

- Auth-guarded admin shell with role gates (`AUTHOR | OPERATOR | ADMIN`)
- DataTable + form patterns for metadata CRUD
- HTTP download with retry + hash + etag
- Per-source state tracking (downloadedAt, sha256, fileSize, lastModified, etag, extractedAt)
- CLI commands `fetch / extract / status / validate` that can be wrapped in form actions
- Audit logging on every server action
- Filesystem browser pattern for on-disk dirs
- Validation results UI that renders a typed report

Net-new for airboss:

1. **UI trigger for download.** `POST /sources/[id]?/fetch` form action that wraps `downloadFile()` and updates the meta sidecar. Today this is CLI-only.
2. **Manual file upload.** multipart form action writing to `data/sources/<type>/<id>.<ext>` + writing `.meta.json` with source=manual, sha256, size. firc never implemented this (`reference_document.filePath` column exists but is dead).
3. **Replace / version operation.** Upload a new version of an existing source, archive the old binary, bump the registry version, keep the old `.meta.json` under `<id>@<version>.meta.json`. firc has supersede semantics for reference-doc metadata rows but not binaries.
4. **Dispatch UI for `references extract | build | diff | size-report`.** Each maps to a form action. `diff` needs a results view (render the text-change hunks). `size-report` needs a tally view (commit/LFS/external classification).
5. **Per-source health-at-a-glance.** Counts (how many `verbatim` entries, how many orphans), freshness (days since source URL updated), validation state (green/yellow/red). firc `status.ts` does the first two in text; the UI version is net-new.
6. **Non-textual sources.** Charts, approach plates, airport diagrams, NTSB CSVs, AOPA HTML. firc only handles PDF+XML. The airboss registry already anticipates this, but UI affordances (preview a chart tile, display a CSV sample) don't exist anywhere in firc.
7. **Long-running job feedback.** Extracting 14 CFR or the full AIM is slow. firc runs CLI-sync; a UI trigger needs either streaming progress (SSE) or a job row with status polling. firc's task board is the nearest primitive but it's manual-kanban, not a job queue.
8. **Diff review workflow.** `references diff` produces text changes between committed `*-generated.ts` and a fresh extract. firc has no analog; publish diffing is a different beast. Net-new component.

## Recommendation (sketch only; user decides)

**Name**: **hangar**. The hangar vision already declares itself the command center for content, compliance, and reference documents. Data-management is a natural fourth pillar. Ops is people + enrollments + certificates - a poor fit for "fetch the eCFR XML." Put the sources surface under hangar at `/sources` (and `/jobs` if we want async). If airboss later adds learner/operator separation, ops can be stood up as a separate app with ported user management only.

**Port order, minimum viable hangar**:

1. **Shell + auth**: port `apps/hangar/src/routes/+layout*`, `hooks.server.ts`, `libs/auth/src/auth.ts`, `libs/audit`, role constants. Gate to `ADMIN` initially (single-user).
2. **Sources CRUD**: port the references-library pattern (list/new/detail/edit/supersede) but rewire the schema to the airboss source registry (code-based in `libs/aviation/src/sources/registry.ts`, not DB-based). The UI reads the registry at SSR time; writes go through editing the TS file or a form action that rewrites it. Decision needed: code-as-source-of-truth vs DB mirror. If code stays source of truth, "create" means opening a form that generates a TS diff for review.
3. **Fetch action**: port `scripts/faa-ingest/lib/download.ts` into `libs/aviation/src/sources/download.ts`. Wire `/sources/[id]?/fetch` form action around it. Write sha256 + fileSize + etag + lastModified into `<id>.meta.json`. Audit-log the action.
4. **Manual upload action**: multipart form at `/sources/[id]/upload`. Net-new. Same meta-sidecar write path.
5. **Status page**: port `commands/status.ts` logic into a loader on `/sources`. Table columns: id, type, version, downloaded?, size, fetched, extracted?, validation.
6. **Validate action**: wrap `bun run references validate` as a form action on `/sources` (global) and per-source. Render results via a `ValidationReport` component (port from firc or build fresh with the same BC pattern).
7. **Extract / build / diff actions**: form actions that shell out to the `references` dispatcher. Decide sync-block vs background; for MVP, sync with a spinner + audit row is probably fine. Defer job-queue design.
8. **Users**: port ops user-management only if a second user enters the picture. Otherwise this is day-N.
9. **Non-textual sources**: add after the core text pipeline is live in UI. New source type only needs a parser; the sources CRUD UI stays the same because types are registry-driven.

What the minimum viable hangar looks like on day 1: a single `/sources` index page with a row per registered source, fetch/extract/validate buttons, an upload box, and a simple size/freshness/validation panel at the top. Everything else (tasks board, publish, compliance, analytics) is out of scope until airboss has content lifecycle needs.

Open questions to resolve before building:

- Source registry: stay code-based (current airboss design) or add a DB mirror? Code-based keeps it git-diffable; DB-based makes admin UI edits native. Suggest: stay code-based, treat the UI as "inspect + trigger" for MVP, add a DB mirror only if multi-user editing lands.
- Long-running job model: sync-block-with-spinner, SSE progress, or job-rows-with-polling? Suggest: sync for MVP, promote to job-rows (port firc task-board schema, rename `task` -> `job`) when first extract exceeds ~10s in practice.
- Authoring source TS files from UI: write through (UI edits the .ts file and commits) vs read-only (UI is inspect-only, editing happens in the editor)? Suggest: read-only for MVP. Adding a source means editing `registry.ts`, not clicking a button.
