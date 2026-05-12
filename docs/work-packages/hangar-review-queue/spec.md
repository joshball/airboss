---
id: hangar-review-queue
title: Hangar Review Queue -- Spec
product: hangar
category: feature
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags:
  - review
  - admin
legacy_fields:
  feature: hangar-review-queue
  type: spec
  review_status: pending
---

# Hangar Review Queue -- Spec

A review-centric backlog and kanban board for the hangar, plus a docs browser, plus per-kind review views. Solves "I have 89 work packages and have reviewed none of them" by aggregating the work into manageable buckets, walking the manual test plan with persisted step state, and rendering all repo docs beautifully in-app.

## Problem

The airboss repo accumulates reviewable artifacts faster than I review them:

- 89 work packages, 34 still `status: unread`
- WP `review_status: pending` for most of the live ones
- Reference TOCs need spot-check passes (per IDEAS.md)
- Knowledge graph nodes need discovery-pedagogy review
- Ad-hoc tasks ("fix the menu animation," "look into job retry semantics") have no home

Currently, "what should I review next?" is answered by grepping frontmatter, opening a markdown file, reading it, and trying to remember where I left off. There is no queue, no progress, no way to walk a test plan with persisted pass/fail state. A 90-card backlog is unmanageable; a single "WP Specs (34)" bucket is.

## Three surfaces

This WP delivers three concentric surfaces that share one substrate:

| Surface          | Route                     | Purpose                                                                                             |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| **Docs browser** | `/docs`                   | Rich markdown viewer over `docs/**`. File tree, search, no DB write. Used independently of reviews. |
| **Review board** | `/review`                 | Kanban + backlog over review items. **Buckets** aggregate items so 34 WPs is one card, not 34.      |
| **Review view**  | `/review/[kind]/[itemId]` | Per-kind custom UI: WP-spec walker, reference-TOC spot-check, knowledge-node discovery review, etc. |

Plus ad-hoc tasks on the same board for "things I want to track but don't fit a review kind."

## Concepts

**Review item.** A single thing-to-be-reviewed: one WP spec, one reference, one knowledge node, one ad-hoc task. Each has a `kind` (discriminates which review view applies) and a `ref` (path or ID identifying the underlying artifact). Items are typed; the kind determines what review UI shows.

**Review bucket.** A named aggregation over review items: "WP Specs (unread)," "WP Test Plans (pending)," "References missing TOC review," "Ad-hoc tasks." A bucket renders as a single card on the board with a count badge. Click to expand into the item list.

**Review session.** One attempt at reviewing an item. Has a start time, optional finish time, and zero or more steps. A session lives even when paused -- close the tab, come back tomorrow, the session is still open.

**Review step.** For test-plan walks: one row of the manual test plan with a pass/fail/blocked outcome and an optional note. Generalizes: any review kind with a "checklist" shape uses steps. Open-ended kinds (read-and-confirm) skip steps.

**Frontmatter is authoritative.** `status` (unread/reading/done -- user) and `review_status` (pending/done -- agent) live in the markdown frontmatter. The DB caches them for board queries. A loader scans `docs/**` on hangar boot + on-demand to keep the cache fresh. Test-plan progress and session notes are DB-only.

## Surface 1 -- Docs browser (`/docs`)

A beautiful, rich markdown viewer over `docs/**` (and `course/**`, `handbooks/**`, `regulations/**` if useful -- configurable root list).

- **Left:** file tree, collapsible by directory, with the relative path shown.
- **Right:** rendered markdown using the existing `RenderedSection` / library renderer, so tables align, code is syntax-highlighted, internal links between docs work, ADRs render cleanly.
- **Top:** breadcrumb + search box.
- **Search:** full-text across all docs. v1 = naive substring match across loaded files. v2 = SQLite FTS or pg `tsvector`. Out of scope for v1 to add a separate index; we re-read files on search.
- **Frontmatter sidebar:** when a file has frontmatter, surface it as a small panel (status, review_status, type, dates).
- **No edit, no DB write.** This surface is read-only browsing.
- **Deep-linkable:** `/docs/work-packages/hangar-review-queue/spec` opens this file. Trailing `.md` optional.

This is what you go to when you want to read an ADR, browse PRDs, or just look at what's in the repo without leaving the app. It's also the **rendering primitive** that `/review/[kind]/[itemId]` reuses.

## Surface 2 -- Review board (`/review`)

A kanban board + bucket list over `review_item` rows.

### Columns (default, configurable per-board later)

- **Backlog** -- queued, not started
- **In Progress** -- review session open, not finished
- **Review** -- finished by reviewer, awaiting confirmation flip (e.g. agent flips `review_status: done`)
- **Done** -- closed

### Cards

Two card flavors render on the board:

1. **Bucket card.** Title ("WP Specs -- unread"), kind badge, count badge ("34"), expand chevron. Click expands an inline drawer listing the bucket's items, each linking to the relevant review view. Bucket cards do **not** drag (they aggregate; their column is derived from the items).
2. **Item card.** Title, kind badge, ref (path or short ID), status pills (`status: reading`, `review_status: pending`), assignee. Items can be drag-and-dropped between columns; for review-kind items, drop writes back to frontmatter when allowed (see Frontmatter rules below). Ad-hoc tasks always drag-write.

### Default buckets (seeded on first boot)

| Bucket                               | Source                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| WP Specs -- unread                   | `docs/work-packages/*/spec.md` where `status: unread`                              |
| WP Specs -- reading                  | same, `status: reading`                                                            |
| WP Test Plans -- pending             | `docs/work-packages/*/test-plan.md` where parent spec has `review_status: pending` |
| References -- missing TOC review     | `reference` rows with no recorded `reference_toc` review                           |
| Knowledge nodes -- pending discovery | `course/knowledge/**/*.md` where `discovery_review: pending`                       |
| Ad-hoc tasks                         | All `review_item.kind = 'ad_hoc'`                                                  |

A "Manage buckets" admin view lets us add/edit/remove buckets later. v1 ships the seed list above, hard-coded.

### Filters

Top of board: filter chips for "Reviews only / Tasks only / All," kind selector, status selector, free-text search. Server-side filtering on the loaded item set (no round-trip per filter; `$derived` over loaded data).

### Discovery / loader

A `loadReviewItems()` function scans the configured roots, parses frontmatter, and upserts `review_item` rows. Runs on hangar boot, on `/review` page load (debounced), and on demand via a "Refresh" button. Frontmatter changes from agents/CI flow through git → reload → next scan.

## Surface 3 -- Review views (`/review/[kind]/[itemId]`)

Each review kind has a dedicated view. The board dispatches to the right view via the kind discriminator.

### `wp_spec` -- Work package spec review

- **Tabs:** spec / tasks / test-plan / design / user-stories / review-notes
- Each tab renders the corresponding markdown file via the docs renderer.
- **Action:** "Mark spec read" sets `status: done` in spec frontmatter.
- **Action:** "Open test-plan walker" deep-links into the `wp_test_plan` view for the same WP.

### `wp_test_plan` -- Test-plan walker

The killer feature. Renders the test-plan markdown, parses tables, and turns each step row into an interactive checklist:

- For each table row in test-plan.md, render a row in the walker with the original Step / Action / Expected columns plus three new controls: **Pass / Fail / Blocked** + note textarea.
- Outcome + note persist per `review_step` row, scoped to the open `review_session`.
- Header shows "X/Y passed -- Z blocked -- W remaining."
- "Pause" closes the session as in-progress (item moves to "In Progress" column on board).
- "Finish" closes the session. If 100% pass and no blockers, prompt to flip `review_status: done` (agent action -- writes frontmatter).
- Sessions are **resumable.** Re-opening the walker for an item with an open session restores the prior outcomes.

Multiple sessions per item are allowed (e.g., walk it again after a fix). Latest session is the default view; prior sessions are listed below.

### `reference_toc` -- Reference TOC spot-check

Per IDEAS.md "Hangar TOC validation UI." TOC-on-left, rendered-content-on-right, fast keyboard check-x marking. Each TOC entry becomes a step (pass = entry found and matches, fail = missing or wrong, blocked = needs source check).

### `knowledge_node` -- Discovery-pedagogy review

Renders the node + its hooks, asks the reviewer to confirm WHY-first ordering (per ADR 011), Pass/Fail per node.

### `ad_hoc` -- Generic task

Title, description, type, productArea, free-form notes. No steps. Drag across columns the old way.

### Adding a new kind

A new review-kind is: one entry in `REVIEW_KINDS` constant, one Svelte page under `/review/[kind]/[itemId]/+page.svelte`, optionally a discovery rule for the loader. The board, board cards, and walker substrate need no changes.

## Frontmatter rules

`status` and `review_status` follow the project rule already in CLAUDE.md:

| Field           | Values                  | Owner | Written by                                                               |
| --------------- | ----------------------- | ----- | ------------------------------------------------------------------------ |
| `status`        | unread / reading / done | User  | This app (and user)                                                      |
| `review_status` | pending / done          | Agent | This app (only with explicit user trigger) and agents in normal workflow |

The board's drag-to-write behavior:

- **Backlog → In Progress.** Writes `status: reading` to spec.md frontmatter.
- **In Progress → Review.** Writes `status: done` to spec.md (the user has read it).
- **Review → Done.** Prompts: "Flip `review_status: done`?" Writes only on confirm.
- **Any → Backlog.** Reverts `status` to `unread`. Confirm if it would lose progress.

Frontmatter writes use the existing markdown frontmatter parser/serializer (or fall back to a regex-replace for the specific `^status:` line, which is safer since we touch one line). Failed writes (file deleted, conflict) surface a toast and revert the board move.

## Data model

| Table            | Schema   | Key fields                                                                                                                                                                                                                                         |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `board`          | `hangar` | `id`, `name`, `createdAt`                                                                                                                                                                                                                          |
| `board_column`   | `hangar` | `id`, `boardId`, `name`, `sortOrder`                                                                                                                                                                                                               |
| `review_kind`    | `hangar` | `id` (e.g. `wp_spec`), `label`, `defaultColumnMapping` (jsonb), `discoveryRule` (jsonb)                                                                                                                                                            |
| `review_bucket`  | `hangar` | `id`, `boardId`, `name`, `kindId`, `filterCriteria` (jsonb), `sortOrder`                                                                                                                                                                           |
| `review_item`    | `hangar` | `id`, `kindId`, `ref` (path or id), `title` (denormalized), `cachedStatus` (jsonb -- frontmatter snapshot), `cachedAt`, `boardId`, `columnId` (derived or set), `sortOrder`, `createdAt`, `updatedAt`                                              |
| `review_session` | `hangar` | `id`, `itemId`, `userId`, `startedAt`, `finishedAt` (nullable), `outcome` (nullable -- pass/fail/abandoned), `notes` (text)                                                                                                                        |
| `review_step`    | `hangar` | `id`, `sessionId`, `stepIndex`, `stepRef` (e.g. test-plan row id), `outcome` (pass/fail/blocked), `note` (text), `updatedAt`                                                                                                                       |
| `board_task`     | `hangar` | `id`, `boardId`, `columnId`, `title`, `description`, `type`, `productArea`, `assigneeId`, `createdBy`, `sortOrder`, `createdAt`, `updatedAt` (ad-hoc tasks; mirrors airboss-firc shape; named `board_task` to avoid future "task" name collisions) |

`cachedStatus` jsonb shape: `{ frontmatterStatus: 'unread'|'reading'|'done'|null, reviewStatus: 'pending'|'done'|null, otherFields: {...} }`. The loader writes this; the board reads it without re-parsing markdown per render.

`columnId` on `review_item` can be derived (from `cachedStatus`) or pinned (user dragged). Pinning takes precedence until the underlying frontmatter changes.

Constants live in `libs/constants/src/review.ts`:

- `REVIEW_KINDS` -- `wp_spec`, `wp_test_plan`, `reference_toc`, `knowledge_node`, `ad_hoc`
- `REVIEW_OUTCOMES` -- `pass`, `fail`, `blocked`
- `SESSION_OUTCOMES` -- `pass`, `fail`, `abandoned`
- `DEFAULT_BOARD_COLUMNS` -- reused or new (`Backlog`, `In Progress`, `Review`, `Done`)
- `TASK_TYPES`, `PRODUCT_AREAS` -- ported from airboss-firc

## Auto-setup

On first visit to `/review`, if no board exists, the server load creates:

- One board (`Hangar Review`)
- Four columns from `DEFAULT_BOARD_COLUMNS`
- The seed buckets listed above
- Triggers a first loader scan

No manual setup.

## Routes

| Route                             | Purpose                                                |
| --------------------------------- | ------------------------------------------------------ |
| `/docs`                           | Docs browser root (defaults to `docs/work/NOW.md`?)    |
| `/docs/[...path]`                 | Render a specific doc                                  |
| `/review`                         | Board view                                             |
| `/review/buckets/[bucketId]`      | Bucket detail (item list)                              |
| `/review/items/[itemId]`          | Generic item detail (dispatches to kind-specific page) |
| `/review/[kind]/[itemId]`         | Kind-specific review view                              |
| `/review/[kind]/[itemId]/walker`  | Test-plan walker (for kinds that support it)           |
| `/review/tasks/new`               | Create ad-hoc task                                     |
| `/review/tasks/[taskId]/edit`     | Edit ad-hoc task                                       |
| `/review/admin/buckets`           | Bucket management (CRUD)                               |
| `/review/admin/buckets/new`       | New bucket form                                        |
| `/review/admin/buckets/[id]/edit` | Edit bucket form                                       |
| `/review/admin/loader`            | Loader status + manual refresh                         |

All routes registered in `ROUTES` (per project rule).

## Sidebar nav (hangar)

Add two top-level entries:

- **Docs** -> `/docs`
- **Review** -> `/review`
  - Board (default)
  - Buckets
  - Tasks
  - Loader

## Bucket admin UI (in scope)

`/review/admin/buckets` -- CRUD for buckets so we don't need a SQL edit to retune the board.

- List existing buckets with name, kind, filter criteria, sort order, item count.
- Create: name + kind dropdown + filter criteria editor (jsonb form: a small builder for `WHERE cachedStatus->>...` + free-text additional clauses) + initial sort order + target column.
- Edit: same form, pre-filled.
- Delete: confirm dialog. Items in the deleted bucket are not deleted; they fall through to the default kind bucket if one exists, or hide until a new bucket catches them.
- Validation: name unique per board; filter criteria must parse; kind must exist in `REVIEW_KINDS`.

The filter criteria editor for v1 is a **structured form** over the common shape: `kind`, `cachedStatus.frontmatterStatus`, `cachedStatus.reviewStatus`, plus an "Advanced" textarea for raw jsonb path predicates (validated server-side, errors surfaced inline). Power users get the textarea; the common case stays a few dropdowns.

## Full-text search across docs (in scope)

`/docs` search uses Postgres full-text search, not naive substring.

- A `docs_search_index` table in `hangar` schema: `path`, `title`, `body`, `frontmatter` (jsonb), `tsv` (`tsvector` GENERATED column over `title || body`), `updatedAt`.
- Indexed on `tsv` with a GIN index.
- Indexer runs as part of `loadReviewItems()` (same loader, extended) -- walks `docs/**` etc., upserts rows, prunes deleted files.
- Search query: `SELECT path, title, ts_headline(body, q) AS snippet, ts_rank(tsv, q) AS rank FROM docs_search_index, plainto_tsquery('english', $1) q WHERE tsv @@ q ORDER BY rank DESC LIMIT 50`.
- Frontend: same search box; results list shows path + title + highlighted snippet + relative rank.
- Title matches bubble (boost via `setweight` on `title`).
- Configuration: searchable roots configured in `libs/constants/src/review.ts` -- `DOCS_SEARCH_ROOTS = ['docs', 'course', 'handbooks', 'regulations']`.

The naive-substring path is **not** retained as a fallback; if the index is empty, search returns "Index not built -- run loader."

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Acceptance

- `/docs` renders any markdown file under `docs/**` with a tree, breadcrumb, frontmatter sidebar, and the existing renderer's quality (tables aligned, code highlighted, internal links resolve).
- `/review` shows the seed buckets with live counts, opens to a bucket drawer with item rows, dispatches to the right per-kind view on click.
- The WP test-plan walker for any one work package can be walked end-to-end with persisted step outcomes that survive a page reload and a session pause.
- Frontmatter `status` flips on column drags and is observable in `git diff` immediately.
- The loader detects new WPs added since the last scan within one refresh cycle.
- All literal values live in `libs/constants/src/review.ts`. No magic strings in BC or pages.

## References

- airboss-firc port source: `apps/hangar/src/routes/(app)/tasks/board/`, `libs/bc/platform/src/{schema,manage}.ts`, `libs/constants/src/tasks.ts`. Take the patterns; do not take the UI.
- CLAUDE.md "Review docs have two status fields" rule.
- IDEAS.md "Hangar TOC validation UI" feeds the `reference_toc` kind.
- ADR 011 -- Knowledge graph; informs `knowledge_node` review pedagogy.
