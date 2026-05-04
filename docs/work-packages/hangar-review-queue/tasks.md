---
title: Hangar Review Queue -- Tasks
product: hangar
feature: hangar-review-queue
type: tasks
status: draft
review_status: pending
---

# Hangar Review Queue -- Tasks

Phased build. Each phase ends with a review pass and frontmatter status update. Phases 1-3 ship the substrate; 4-6 ship the killer features; 7-8 ship polish.

## Phase 1 -- Constants, schema, BC primitives

Goal: types and tables exist; nothing renders yet.

- [ ] Add `libs/constants/src/review.ts` (kinds, outcomes, frontmatter statuses, default columns).
- [ ] Add review-related route constants to `libs/constants/src/routes.ts`.
- [ ] Extend `libs/bc/hangar/src/schema.ts` with: `board`, `board_column`, `review_kind`, `review_bucket`, `review_item`, `review_session`, `review_step`, `task`. Use `hangar` schema namespace; don't create a new one.
- [ ] Drizzle push (project uses `db push`, not migrate -- per `drizzle/README.md`).
- [ ] Generate IDs via `@ab/utils` `createId(prefix)` -- prefixes: `brd`, `bcol`, `rkind`, `rbkt`, `ritem`, `rses`, `rstp`, `task`.
- [ ] BC primitives in `libs/bc/hangar/src/review.ts`:
  - `getOrCreateBoard`, `listColumns`, `createColumn`
  - `listKinds`, `seedDefaultKinds`
  - `listBuckets`, `seedDefaultBuckets`
  - `listItems(boardId, filters)`, `getItem`, `upsertItem`, `pinItemToColumn`
  - `startSession`, `getOpenSession`, `finishSession`, `listSessions(itemId)`
  - `recordStep`, `listSteps(sessionId)`
  - `listTasks`, `createTask`, `updateTask`, `deleteTask` (ad-hoc; mirrors firc shape)
- [ ] Vitest unit tests for each primitive. No mocks of the DB; use the test container per project test pattern.

Acceptance: `bun run check` clean, all unit tests pass, schema visible in `\dt hangar.*`.

## Phase 2 -- Frontmatter parser + writer + loader

Goal: scan `docs/**`, populate `review_item`, write frontmatter on demand. No UI yet.

- [ ] Add `libs/utils/src/frontmatter.ts`:
  - `parseFrontmatter(text)` -> `{ data, body }` (existing? confirm; reuse if so)
  - `setFrontmatterField(filePath, field, value)` -> writes one field, byte-stable elsewhere
  - `setFrontmatterFields(filePath, updates)` -> batch
- [ ] Test-plan parser in `libs/bc/hangar/src/review-test-plan.ts`:
  - Parse markdown to AST (reuse existing `unified` / `remark` chain if present; else add)
  - Extract tables under H2 sections; emit step list with stable `stepRef` hash
  - Vitest: round-trip on the existing flightbag-scaffold test-plan + at least 3 others
- [ ] Discovery rules in `libs/bc/hangar/src/review-discovery.ts`:
  - `wp_spec`, `wp_test_plan` rules over filesystem
  - `reference_toc` rule over `reference` table
  - `knowledge_node` rule over `course/knowledge/**` (frontmatter `discovery_review: pending`)
  - `ad_hoc` is hand-created, no discovery
- [ ] `loadReviewItems()` orchestrator: runs all rules, upserts items, soft-prunes missing ones, emits a summary `{ added, updated, removed, errors }`.
- [ ] Wire the loader into `apps/hangar/src/hooks.server.ts` to run on boot (debounced; not on every request).
- [ ] Manual loader trigger script `bun run hangar:reload-reviews` for ad-hoc refreshes.

Acceptance: running the loader against the current main produces ~89 WP items + the live reference rows, with cached statuses matching frontmatter. A frontmatter edit + reload reflects in the cache.

## Phase 3 -- Docs browser (`/docs`) + Postgres FTS

Goal: a beautiful read-only viewer over `docs/**`, with proper full-text search. Independent of reviews.

- [ ] `apps/hangar/src/routes/(app)/docs/+layout.svelte` -- two-pane layout, sidebar tree + content.
- [ ] `apps/hangar/src/routes/(app)/docs/+page.svelte` -- index (renders `docs/work/NOW.md` by default).
- [ ] `apps/hangar/src/routes/(app)/docs/[...path]/+page.server.ts` -- read the file, parse frontmatter, return body.
- [ ] `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte` -- breadcrumb + rendered body + frontmatter rail.
- [ ] FileTree component in `libs/ui/src/FileTree.svelte` -- collapsible, persists open state in `localStorage`. Source: a `listDocsTree()` BC function that returns the directory shape.
- [ ] Internal markdown links: `[ADR](docs/decisions/011-...)` resolves to `/docs/decisions/011-...` -- post-process the rendered HTML or extend the renderer's link resolver.
- [ ] Add `hangar.docs_search_index` table: `path`, `title`, `body`, `frontmatter` (jsonb), `tsv` (`tsvector` GENERATED column over `setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B')`), `updatedAt`. GIN index on `tsv`.
- [ ] Extend the loader (Phase 2) to walk `DOCS_SEARCH_ROOTS` and upsert rows into `docs_search_index`. Prune missing.
- [ ] BC function `searchDocs(query, limit)` in `libs/bc/hangar/src/review-search.ts`: runs `plainto_tsquery` + `ts_headline` + `ts_rank`, returns `{ path, title, snippet, rank }[]`.
- [ ] Search UI: top-right input, debounced 200ms, results dropdown with path + title + highlighted snippet.
- [ ] If the index is empty (loader never ran), surface "Index not built -- run loader" with a button.
- [ ] Add Docs entry to hangar sidebar nav.

Acceptance: every existing `docs/**` markdown file renders correctly; the WP we're authoring (`spec.md`) renders with its tables aligned and links functional. Searching "discovery-first pedagogy" returns ADR 011 and CLAUDE.md with snippets; ranked by relevance.

## Phase 4 -- Review board (`/review`)

Goal: kanban board with bucket cards + item cards over the loaded items.

- [ ] Routes: `/review` (board), `/review/buckets/[id]` (bucket detail).
- [ ] Server load: get-or-create board, seed columns + kinds + buckets if absent, list items, return shape `{ board, columns, buckets, items }`.
- [ ] Board.svelte component: 4 columns, two card flavors.
- [ ] BucketCard.svelte: title + count + expand drawer with item rows.
- [ ] ItemCard.svelte: title + status pills + ref subtext + drag handle.
- [ ] Drag-and-drop `move` form action: updates `columnId`, calls frontmatter writer per spec rules.
- [ ] Filter chip bar: All / Reviews / Tasks + kind multi-select + free-text search (`$derived`).
- [ ] Refresh button: triggers `loadReviewItems()` with toast on summary.
- [ ] Add Review entry to hangar sidebar nav.

Acceptance: visiting `/review` after Phase 2 has populated items shows the seed buckets with live counts. Dragging an item updates its column and writes frontmatter (verifiable via `git diff`).

## Phase 5 -- WP spec view + test-plan walker

Goal: the killer feature.

- [ ] `/review/wp_spec/[itemId]/+page.svelte` -- tabs over the WP files. Tabs render via the docs renderer.
- [ ] Footer actions: Mark spec read, Open walker, Flip review_status (with confirm).
- [ ] `/review/wp_test_plan/[itemId]/+page.svelte` -- the walker.
- [ ] Walker server load:
  - Look up item, find associated test-plan.md path
  - Parse steps via the test-plan parser
  - Get-or-create open session for `(itemId, userId)`
  - Load existing step outcomes for the session
- [ ] Walker actions:
  - `recordStep`: outcome + note, persist to `review_step`, return updated state
  - `pauseSession`: set `finishedAt` to null kept open (no-op if already open); navigates back to board
  - `finishSession`: prompt to close; if 100% pass, prompt to flip `review_status`
- [ ] Walker UI: section headers, step rows, outcome buttons (Pass/Fail/Blocked), note textarea (debounced save on blur).
- [ ] Resume behavior: re-opening the walker for an item with an open session restores outcomes.
- [ ] Session history panel on the WP spec view (sessions, outcomes, finish times).

Acceptance: walking [`flightbag-scaffold/test-plan.md`](../flightbag-scaffold/test-plan.md) end-to-end persists every outcome, survives a reload mid-walk, and on finish offers to flip frontmatter.

## Phase 6 -- TOC review + knowledge node review + ad-hoc tasks

Goal: the other review kinds + ad-hoc.

- [ ] `/review/reference_toc/[itemId]` -- TOC pane + content pane. Keyboard nav `j`/`k`/`b`. Each TOC entry = one step.
- [ ] `/review/knowledge_node/[itemId]` -- single-decision review. Pass/Fail/Note.
- [ ] `/review/tasks/new` and `/review/tasks/[taskId]/edit` -- port from airboss-firc task forms (kept thin).
- [ ] Ad-hoc tasks render as item cards on the board with full drag CRUD (no review session).

Acceptance: each kind opens its custom view and persists outcomes. Adding an ad-hoc task lands it on the board.

## Phase 7 -- Loader admin + bucket admin + bucket counts in nav

- [x] `/review/admin/loader` -- shows last scan summary, errors, manual refresh button.
- [x] `/review/admin/buckets` -- list buckets: name, kind, filter criteria summary, item count, sort order. Edit/Delete actions per row.
- [x] `/review/admin/buckets/new` -- create form: name, kind dropdown, structured filter editor (kind / cachedStatus.frontmatterStatus / cachedStatus.reviewStatus dropdowns), Advanced jsonb predicate textarea, sort order.
- [x] `/review/admin/buckets/[id]/edit` -- same form, pre-filled, with Delete button (confirm).
- [x] BC primitives in `libs/bc/hangar/src/review.ts`: `createBucket`, `updateBucket`, `deleteBucket`, `getBucket`, `countReviewQueueOpen`. Server-side validation: name unique per board (PG 23505 mapped to inline error), filter parses through `validateBucketFilterCriteria`, kind in `REVIEW_KINDS`.
- [x] On bucket delete, items are not deleted; they fall through to whatever bucket catches them (or hide).
- [x] Sidebar Review entry shows total open-review count badge.
- [ ] Surface bucket counts on the sub-nav. (Bucket counts already render on each bucket card on `/review`; admin sub-nav left as Loader / Buckets without per-bucket counts since the per-bucket count is on the buckets list page itself.)

## Phase 8 -- Polish + e2e

- [ ] Playwright e2e: load board, drag a card, verify frontmatter write.
- [ ] Playwright e2e: walk a test plan to completion, verify session + steps persisted.
- [ ] Playwright e2e: docs browser renders nested paths and resolves an internal link.
- [ ] Visual polish: animations on bucket expand, drag ghost, walker step transitions.
- [ ] `/ball-review-full` pass; fix everything; flip `status: ready-for-review`.

## Out of phase / follow-up WPs

- Multi-user assignment / mentions (-> `hangar-review-collab`, only when we go multi-user)
- Slash command keyboard nav (-> small follow-up)
- Notifications / in-header review badges (-> small follow-up)
