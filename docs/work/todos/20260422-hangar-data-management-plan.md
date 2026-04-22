# Hangar data-management app: plan

Proposal for airboss's first admin app. Scope, shape, and work packages for a surface that lets a human manage source documents, trigger the reference pipeline, and extend beyond text to charts and plates.

Status: draft -- awaits user sign-off before work packages are authored.

Companion reading:

- [FIRC hangar / ops / downloader survey](./20260422-firc-hangar-ops-survey.md)
- [Reference system flow](../../platform/REFERENCE_SYSTEM_FLOW.md)
- [Reference system architecture](./20260422-reference-system-architecture.md)

## TL;DR

**App name: `hangar`.** Evidence-backed (FIRC already ships one, ops is for people/enrollments/certs which airboss doesn't have). Day-1 scope: a `/sources` surface that merges what FIRC keeps apart -- the CLI downloader and the admin UI. First render is **an interactive HTML version of the pipeline flow diagram** where every touchpoint is clickable and leads to its admin action: fetch (URL-driven), upload (manual), extract, build, diff, validate, size-report. Source-type-agnostic: the same CRUD + trigger surface extends cleanly to charts, approach plates, POHs, NTSB CSVs, AOPA articles. Heavy port from FIRC (download lib, auth, audit, DataTable, ValidationReport, status logic); net-new is UI-triggered fetch/upload, versioned replacement, diff review, long-running-job feedback, and binary/visual source previews.

## Why hangar, not ops

| Property                                  | hangar           | ops              |
| ----------------------------------------- | ---------------- | ---------------- |
| FIRC scope                                | content + compliance + references | users + enrollments + certificates |
| Target role                               | `AUTHOR | OPERATOR | ADMIN` | `OPERATOR | ADMIN` |
| Reads/writes content domain               | yes              | no               |
| Reads/writes source documents             | yes (metadata today, binaries tomorrow) | no |
| Triggers validation / build / release    | yes              | no               |
| Runs user admin                           | no               | yes              |
| Fits airboss data-management              | yes              | poor             |

Ops can still be stood up later if user management needs a home; it's a different axis.

## Day-1 scope

One app (`apps/hangar/`), one route family (`/sources`), one DB table if needed (probably not for v1 -- registry is code), one background-job story (sync + spinner, defer queue).

### Routes

```text
/                               Redirect to /sources (single surface for now)

/sources                        Index. Flow diagram + source table.
/sources/[id]                   Detail. One source, its state, its actions.
/sources/[id]/files             Filesystem browser for data/sources/<type>/<id>.*
/sources/[id]/diff              Render references diff output for this source
/sources/[id]/edit              (Later) edit source metadata

/jobs                           (Later) long-running job log when we add a queue

/login                          Auth (shared login with other apps via cross-subdomain cookie)
```

### The index page -- interactive flow diagram

**Primary artifact. The HTML version of [REFERENCE_SYSTEM_FLOW.md](../../platform/REFERENCE_SYSTEM_FLOW.md).**

Top half of `/sources` renders the data-flow diagram as an interactive SVG / Svelte-component tree. Each node in the flow is a clickable affordance:

```text
┌──────────────┐       ┌─────────────────────────┐
│   content    │──────▶│  manifest.json          │
│  (nodes,     │ scan  │  (212 cited ids, 3 TBD) │──┐
│  help pages) │       │  [ Rescan ▶ ]          │  │
└──────────────┘       └─────────────────────────┘  │
                                                    ▼
                                  ┌────────────────────────┐
                                  │   validation           │
                                  │  0 errors, 1 warning   │
                                  │  [ Revalidate ▶ ]     │
                                  └───────────┬────────────┘
                                              │
┌───────────── 15 sources registered ─────────┼──────────────┐
│                                                            │
│  cfr-14        ▶ 3/10 extracted       [ Fetch ] [ Upload ] │
│  aim-current   ▶ pending download     [ Fetch ] [ Upload ] │
│  phak-current  ▶ pending download     [ Fetch ] [ Upload ] │
│  ... 12 more                                               │
│                                                            │
└────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                              ┌─────────────────────────┐
                              │ per-source extraction   │
                              │  [ Extract all ▶ ]     │
                              │  [ Build (scan+extract) ▶ ] │
                              │  [ Diff (yearly review) ▶ ] │
                              └──────────┬──────────────┘
                                         │
                                         ▼
                              ┌─────────────────────────┐
                              │ /glossary reads merged  │
                              │ registry at load time.  │
                              │  175 refs, 10 verbatims │
                              │  [ Open /glossary ▶ ]  │
                              └─────────────────────────┘
```

Every bracketed affordance is a **form action** on the same page. Clicking "Fetch" runs the download, updates the meta sidecar, writes an audit row, and revalidates the page. Clicking "Extract all" kicks off extraction (sync for MVP, with spinner). Clicking "Diff" routes to `/sources/[id]/diff` with rendered hunks.

Below the diagram, a **status panel**:

| Metric                                | Value today              |
| ------------------------------------- | ------------------------ |
| Registered sources                    | 15                       |
| Downloaded                            | 0 / 15                   |
| Verbatim blocks materialized          | 0 / 175 references cited |
| TBD wiki-links in content             | 3                        |
| Validation                            | green (0 errors)         |
| Freshness                             | oldest source: never     |

### Per-source detail

One row per `Source` in the registry becomes a detail page `/sources/[id]`:

- Metadata: id, type, title, version, URL, checksum, downloadedAt, format, path
- File state: binary present? size? last verified? meta.json present? meta.json valid?
- Reference count: how many airboss references cite this source
- Extract state: how many of those references have verbatim blocks materialized
- Actions: Fetch (re-download), Upload (manual replace), Extract (this source only), Diff (this source vs committed generated), Validate (this source's subset), Open in filesystem browser
- Audit log: last N actions on this source (who, when, outcome)

### File upload contract

Multipart form at `/sources/[id]/upload`. Server action:

1. Accepts one file
2. Computes sha256
3. Writes binary to `data/sources/<type>/<id>.<ext>` (archiving the old one under `<id>@<version>.<ext>` if versioned replacement)
4. Writes `<id>.meta.json` with `{ sourceId, version, url: (optional, pass-through), checksum: <new sha>, downloadedAt: <now>, format, sizeBytes }`
5. Audit-logs the action
6. Redirects to `/sources/[id]` with a toast

Works for every source type because the sidecar shape is uniform.

### Fetch contract

Form action at `/sources/[id]?/fetch`:

1. Reads `Source.url` from registry
2. Invokes the ported `downloadFile(url, path)` from firc's `scripts/faa-ingest/lib/download.ts`
3. Same post-download path as upload: sha256, meta.json, audit, redirect
4. Handles the skip-if-unchanged case (etag / sha256 match) by rendering "no change"

### Validate / extract / build / diff actions

Each is a form action that wraps the existing `bun run references <command>`. MVP behavior:

- Validate: sync; render the current result inline on `/sources`
- Extract: sync with a progress spinner; blocks the request
- Build: sync with a spinner
- Diff: sync; render output at `/sources/[id]/diff`
- Size-report: sync; render a table on `/sources`

For sources where extract takes >10 seconds, flag as a follow-up for the `/jobs` route (not in MVP).

## Generic architecture for source types

The whole appeal of this surface is that new source types cost nothing in the UI. Specifically:

### The Source type enum is the extension point

Already in `libs/constants/src/reference-tags.ts`. Adding a new source type means:

1. Add the string to `REFERENCE_SOURCE_TYPES` (e.g. `'chart-sectional'`, `'approach-plate'`, `'aopa'`)
2. Add an entry to `SOURCES[]` in `libs/aviation/src/sources/registry.ts`
3. Write a `SourceExtractor` at `libs/aviation/src/sources/<type>/extract.ts`

The hangar UI picks up the new type automatically. No hangar code change.

### For non-textual sources (charts, plates)

The `Reference.verbatim` field holds GFM markdown, which supports embedded images. Options:

- **Option A: `verbatim` stays null.** A chart Reference has `paraphrase` + sources + an embedded-image preview in the detail page. The "extraction" step is just metadata validation + preview generation.
- **Option B: `verbatim` holds a markdown image tag** pointing to a committed preview (generated thumbnail under `libs/aviation/src/sources/<type>/previews/`). Glossary renders the thumbnail.
- **Option C: extend the schema** with a `binaryPreview: { path, alt, sizeBytes }` field. More typed but schema churn.

Recommendation: A for v1, B once charts land (generate a thumbnail as the extraction step), C only if B feels wrong in practice.

### Extractors can be async or skip gracefully

Today's contract:

```typescript
export interface SourceExtractor {
  canHandle(sourceId: string): boolean;
  extract(locator: Record<string, string | number>, sourceFile: string): Promise<VerbatimBlock>;
}
```

For non-text sources:

- `canHandle` still true
- `extract` returns a `VerbatimBlock` with `text` pointing to a generated preview or a rendered description ("14 approach plates at KSLC, see /sources/chart-ksfo/files")

For sources we don't parse yet (e.g. raw NTSB CSV with no extraction):

- Registry entry exists
- No extractor registered
- UI surfaces the source, offers upload/fetch, skips extract button with "no parser yet"
- Downstream references still cite the source; `verbatim` stays null; glossary shows paraphrase only

## What ports from FIRC, what's net-new

Direct port (low effort):

| FIRC                                                 | airboss target                                              |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `libs/auth/src/auth.ts` (`requireAuth`, `requireRole`) | `libs/auth/src/auth.ts` (same shape; already partly there) |
| `libs/audit` lib                                     | `libs/audit/` (new)                                         |
| `libs/constants/src/roles.ts` + `app-urls.ts`        | `libs/constants/src/roles.ts`                               |
| `apps/hangar/src/routes/+layout*` + `hooks.server.ts` | `apps/hangar/src/routes/+layout*`                          |
| `scripts/faa-ingest/lib/download.ts`                 | `libs/aviation/src/sources/download.ts`                     |
| `scripts/faa-ingest/lib/manifest-state.ts`           | Already aligned with `libs/aviation/src/sources/meta.ts`; reconcile |
| `scripts/faa-ingest/commands/status.ts` logic        | `/sources` index page loader                                |
| `apps/hangar/DataTable.svelte` + `FormStack` + `ConfirmDialog` | `libs/ui/src/components/*`                         |
| `apps/hangar/ValidationReport.svelte`                | `libs/ui/src/components/ValidationReport.svelte`            |
| `apps/hangar/docs/*` filesystem browser              | `/sources/[id]/files`                                       |
| `apps/ops/users/*` (later)                           | `apps/ops/src/routes/(app)/users/*`                         |

Net-new for airboss (not in FIRC):

1. Interactive SVG/Svelte flow diagram at `/sources`
2. UI-triggered fetch (FIRC has the CLI; no UI wrapper)
3. UI-triggered upload + versioned replacement (FIRC's `filePath` column is dead)
4. UI dispatch for extract / build / diff / size-report
5. Per-source health panel (counts, freshness, validation state)
6. Diff review workflow (hunk rendering)
7. Long-running job feedback (MVP: spinner; v2: job rows with SSE or polling)
8. Non-textual source handling (charts, plates) -- everything downstream is ready, UI is net-new

Explicitly NOT porting:

- FIRC-specific compliance surface (`/compliance/tco`, `/compliance/submissions`, `/compliance/package`, `/compliance/traceability`). Different product.
- Carrier / NATOPS / "flight deck" branding language. airboss is post-pivot.
- Release / publish to `published.*` schema. airboss commits generated files to git instead.
- FIRC content tables (`course.scenario`, `course.module`, `course.question`). airboss authors markdown.
- FAA cert issuance. Not applicable.
- Enrollment + learner records. Not applicable.
- `pdftotext` as a global dep. Each source owns its parser.

## Work packages (proposed)

Three packages, serial dependency:

### wp-hangar-scaffold (first)

Stand up `apps/hangar/` with auth, role gates, shell, nav, theme wire, audit log. No data-management features yet. The skeleton to build on.

- `apps/hangar/` workspace + `svelte.config.js` + `package.json` + routing scaffold
- `/login` shared with other apps (cross-subdomain cookie)
- `/` redirect to `/sources`
- Port `requireAuth` + `requireRole` from FIRC into `libs/auth/`
- Port `libs/audit` from FIRC (one table, one helper, one action)
- Port roles from FIRC (4 values already right)
- Biome config, tests config, svelte-kit sync wiring
- `ROUTES.HANGAR_*` constants
- `HOSTS.HANGAR` + `PORTS.HANGAR` in constants; add to `scripts/dev.ts` DEV_URLS
- Dev setup: `/etc/hosts` entry for `hangar.airboss.test`

Gate: `bun run check` clean. `bun run dev hangar` boots. Login works via existing better-auth. Auditable stub action on the empty home page to prove the logging path.

### wp-hangar-sources-v1

The interactive flow + source table + fetch + upload + validate + extract + build + diff. The meat.

- `/sources` index: flow diagram + source table + status panel
- `/sources/[id]` detail
- `/sources/[id]/files` filesystem browser
- `/sources/[id]/diff` diff view
- Form actions: fetch, upload, extract, build, diff, validate, size-report
- Port `downloadFile` from FIRC into `libs/aviation/src/sources/download.ts`
- Port `DataTable` + `FormStack` + `ConfirmDialog` components to `libs/ui/`
- Port `ValidationReport` component
- Server loaders compute per-source state (binary present, meta present, verbatim coverage, freshness)
- Audit-log every action
- Spinner UX on long-running actions
- Write through to `data/sources/<type>/<id>.<ext>` + `.meta.json`

Gate: fetch + upload + validate + extract + diff all work end-to-end for the CFR source when a 14 CFR XML is present. `bun run check` clean.

### wp-hangar-non-textual (later, after v1 ships)

Charts, approach plates, airport diagrams, NTSB CSV, AOPA HTML. Extends the Source-type enum, adds per-type parsers, adds preview rendering.

- New source types: `chart-sectional`, `chart-ifr-enroute`, `approach-plate`, `airport-diagram`, `aopa`, `ntsb` (registry-only, no parser)
- Per-type preview generation (thumbnails for charts, PDF first-page for plates)
- `/sources/[id]/files` extended to render preview tiles
- Glossary detail pages show embedded previews when verbatim is a preview-markdown
- `references validate` extended to check preview-file existence + freshness

Gate: seeding one sectional chart works end-to-end; glossary page for a chart-referenced entry renders the preview.

## Open questions for user

Before any work starts, decide these. My recommendations in parens; override freely.

1. **Source registry: code-based or DB-mirrored?** (Code-based for MVP. UI is inspect + trigger; adding a source means editing `registry.ts` in an editor. Flip to DB-mirror only if multi-user editing lands.)
2. **Long-running job model: sync + spinner, SSE, or job rows?** (Sync for MVP. Promote to job rows when the first extract exceeds ~10s in practice.)
3. **UI-authored source entries: read-only for MVP, or writeable (form → TS diff → commit)?** (Read-only. Adding a source means editing `registry.ts`.)
4. **App URL:** `hangar.airboss.test` in dev? (Yes, matches the pattern.)
5. **Port `libs/audit` into airboss or re-author from scratch?** (Port -- it's small and battle-tested; just rename FIRC-isms.)
6. **Include the `/jobs` route (task board from FIRC) in MVP?** (No. Defer with a `/jobs` stub that says "coming soon" if users start asking.)
7. **Users + roles: reuse the existing 4-role enum from CLAUDE.md stack, or reduce to 2 (`admin`, `author`) for hangar?** (Reuse 4-role; airboss will grow into ops eventually. Hangar gates to `AUTHOR | OPERATOR | ADMIN`.)
8. **Single-user (just you) for now, or multi-user day 1?** (Single-user. Invite flow lives in `ops` if we stand it up later. Hangar just checks role.)

## Success criteria

A human (you, for now) can:

- Visit `hangar.airboss.test`, see the flow diagram, know what the system is in 15 seconds
- Click "Fetch" on a registered source, watch it download, see it flip from "pending" to "downloaded"
- Drop a PDF on a source's upload box, see it verified + versioned
- Trigger `extract` and `build`, see verbatim counts tick up
- Open `/sources/cfr-14/diff` after a yearly refresh, review the text changes, decide what to commit
- Run `validate` any time, see a green / yellow / red indicator with details

All without touching a terminal.

## Not in scope (explicitly)

- User invite / role management (maybe later, as ops)
- Job queue (spinner for MVP)
- DB-backed source registry (code stays authoritative)
- Chart / plate source types (separate WP)
- Content authoring (knowledge nodes stay markdown in an editor)
- FIRC compliance features (TCO, FAA package, traceability)
- Release / publish semantics (airboss uses git commits for this)
- Enrollment / certificate issuance
- Analytics dashboards

## Timeline shape

Agent-driven, serial:

1. wp-hangar-scaffold → PR → review → merge
2. wp-hangar-sources-v1 → PR → review → merge → manual walkthrough
3. download a real CFR XML, use hangar to fetch/extract/build/diff for real (this closes the Extract-2 blocker from the reference-system work)
4. wp-hangar-non-textual (after we have a chart in mind)

## What I need from you

- **Go / hold / change-X** on this plan
- Answers to the 8 open questions (or "use your recommendations")
- A rough sense of priority vs the other outstanding work (manual test passes, CFI content review, KG scaling)

Once the plan's approved, wp-hangar-scaffold starts as an isolated-worktree agent.
