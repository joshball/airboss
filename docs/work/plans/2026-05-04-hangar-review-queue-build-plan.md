---
title: 'Build plan: hangar-review-queue'
type: plan
status: awaiting-approval
created: 2026-05-04
worktree: agent-ae8eb8cb532bdfcc4
branch: worktree-agent-ae8eb8cb532bdfcc4
---

# Build plan -- hangar-review-queue

Phased execution of [hangar-review-queue tasks.md](../../work-packages/hangar-review-queue/tasks.md) and aligned with [spec.md](../../work-packages/hangar-review-queue/spec.md), [design.md](../../work-packages/hangar-review-queue/design.md), [test-plan.md](../../work-packages/hangar-review-queue/test-plan.md), [user-stories.md](../../work-packages/hangar-review-queue/user-stories.md).

The spec is large (3 surfaces, 7+ new tables, 10+ routes, FTS, walker, bucket admin, e2e). The phase plan groups by layer so each phase ends with `bun run check` clean and a small, reviewable diff. Token / polish runs LAST and ALONE, per project rule.

## Sequencing rules used

- **Schema before BC, BC before pages.** Pages can't load if BC or schema is missing.
- **Loader (Phase 2) blocks Phase 4** -- the board has nothing to render until items exist.
- **FTS schema rides Phase 2 loader** but the search UI lands in Phase 3 (kept together so the `/docs` surface ships search-ready).
- **Walker (Phase 5) blocks Phase 8 e2e** -- e2e walks the walker.
- **No parallel sub-agents within a phase.** Risk of file collision is high (board page + filter chips + drag handler all touch one Svelte file). Sub-agents within phases are sequenced.
- **Polish + e2e (Phase 9) runs alone** so the token sweep doesn't collide with feature edits.

## Spec gaps surfaced before build

These were discovered during pre-build read-through and need a one-line decision to avoid mid-build stalls:

| # | Gap                                                                                                                                         | Recommended resolution                                                                                                                         |
| - | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `knowledge_node` discovery rule looks for `discovery_review: pending` frontmatter; **no knowledge node has it today** (46 nodes, 0 matches). | Phase 2: emit ALL `course/knowledge/**/node.md` as `knowledge_node` items with `cachedStatus.frontmatterStatus = 'unread'` if `discovery_review` is missing. Reviewer can flip via the per-kind view. |
| 2 | `reference_toc` discovery rule references `review_session` outcomes recursively (rule queries the same table the loader is filling).         | Phase 2: emit one `reference_toc` item per `hangar.reference` row whose `verbatim` jsonb has TOC content; "needs review" derived in the bucket filter, not the discovery rule. |
| 3 | spec says `task` table "mirrors airboss-firc shape" -- there is no `airboss-firc` checked out into the worktree.                            | Build a thin in-airboss task shape from spec column list. Fields: `id`, `boardId`, `columnId`, `title`, `description` (text), `type` (text -- enum lives in constants), `productArea` (text), `assigneeId`, `createdBy`, `sortOrder`, `createdAt`, `updatedAt`. No port; pure new. |
| 4 | `TASK_TYPES` and `PRODUCT_AREAS` "ported from airboss-firc" -- not ported, not specced inline.                                              | Use `['bug', 'feature', 'chore', 'investigation', 'follow-up']` for TASK_TYPES; `['hangar', 'study', 'sim', 'flightbag', 'platform', 'docs']` for PRODUCT_AREAS. Aligns with Joshua's product taxonomy memory entry. |
| 5 | spec route `/review/items/[itemId]` (dispatcher) is in design.md but not in tasks.md.                                                       | Add to Phase 4 -- thin redirect to per-kind route based on `kindId` lookup.                                                                    |
| 6 | spec adds `/docs` and `/review` to hangar sidebar -- existing `Nav.svelte` shows Sources / Glossary / Users / Jobs.                          | Phase 3 adds `Docs`, Phase 4 adds `Review`. No re-org of existing entries.                                                                     |
| 7 | "Browser-bundled libs must not statically import `node:*`" -- the loader needs `fs` to walk `docs/**`.                                      | Loader lives in `libs/bc/hangar/src/review-loader.ts` (BC, not browser-bundled). Test-plan parser similarly server-only. Frontmatter writer also server-only -- if any of this needs to land in `libs/utils/`, gate via `process.getBuiltinModule('node:fs')` per CLAUDE.md. |

If any of (1)-(7) need a different call, dispatcher should reply with the override before approval. Otherwise proceeding with the recommended resolutions.

## Phases

### Phase 1 -- Constants, schema, BC primitives

Goal: types and tables exist; no UI.

- `libs/constants/src/review.ts` -- `REVIEW_KINDS`, `REVIEW_OUTCOMES`, `SESSION_OUTCOMES`, `FRONTMATTER_STATUSES`, `FRONTMATTER_REVIEW_STATUSES`, `REVIEW_BOARD_DEFAULT_COLUMNS`, `DOCS_SEARCH_ROOTS`, `TASK_TYPES`, `PRODUCT_AREAS`, plus the `KIND_VIEWS` route map type stub. Export from `libs/constants/src/index.ts`.
- `libs/constants/src/routes.ts` -- add `DOCS`, `DOCS_PATH`, `REVIEW`, `REVIEW_BUCKET`, `REVIEW_ITEM`, `REVIEW_KIND`, `REVIEW_WALKER`, `REVIEW_TASK_NEW`, `REVIEW_TASK_EDIT`, `REVIEW_ADMIN_LOADER`, `REVIEW_ADMIN_BUCKETS`, `REVIEW_ADMIN_BUCKET_NEW`, `REVIEW_ADMIN_BUCKET_EDIT`. Add review action ids (`?/move`, `?/recordStep`, `?/pauseSession`, `?/finishSession`, `?/runLoader`).
- `libs/utils/src/ids.ts` -- helpers: `generateBoardId`, `generateBoardColumnId`, `generateReviewKindId`, `generateReviewBucketId`, `generateReviewItemId`, `generateReviewSessionId`, `generateReviewStepId`, `generateBoardTaskId`. Prefixes: `brd`, `bcol`, `rkind`, `rbkt`, `ritem`, `rses`, `rstp`, `task`.
- `libs/bc/hangar/src/schema.ts` -- add 8 tables in the existing `hangarSchema` namespace: `board`, `boardColumn`, `reviewKind`, `reviewBucket`, `reviewItem`, `reviewSession`, `reviewStep`, `boardTask`. CHECK constraints sourced from constants via `inList()` (existing pattern).
- `libs/bc/hangar/src/docs-search.ts` (new) -- table for `docs_search_index` lives here so it ships in the same schema push. Generated `tsv` column via Drizzle `sql` literal. GIN index.
- `bun run db reset` -- regenerates DB from TS schema. Optionally `drizzle-kit generate --name=review_queue` to keep the snapshot accurate (per drizzle README).
- `libs/bc/hangar/src/review.ts` -- BC primitives: `getOrCreateBoard`, `listColumns`, `createColumn`, `listKinds`, `seedDefaultKinds`, `listBuckets`, `seedDefaultBuckets`, `createBucket`, `updateBucket`, `deleteBucket`, `listItems(boardId, filters)`, `getItem`, `upsertItem`, `pinItemToColumn`, `startSession`, `getOpenSession`, `finishSession`, `listSessions(itemId)`, `recordStep`, `listSteps(sessionId)`, `listTasks`, `createTask`, `updateTask`, `deleteTask`. Each typed; no `any`. Cross-lib via `@ab/*`.
- `libs/bc/hangar/src/review.test.ts` -- Vitest unit per primitive. Uses the existing test-DB pattern (no mocks).
- Export new symbols from `libs/bc/hangar/src/index.ts`.

Acceptance: `bun run check` 0/0; `bun run test --filter @ab/bc-hangar` green; `\dt hangar.*` shows 8 new tables + `docs_search_index`.

Reviewers: schema, backend, correctness.

### Phase 2 -- Frontmatter writer, test-plan parser, loader

Goal: scan `docs/**`, populate `review_item`, write frontmatter on demand. No UI.

- `libs/utils/src/markdown.ts` already has `parseFrontmatter`. Add to the same file: `setFrontmatterField(text, field, value) -> string` and `setFrontmatterFields(text, updates) -> string`. Both pure-string transforms (no IO). Tests in `markdown.test.ts`.
- `libs/bc/hangar/src/review-frontmatter.ts` (new, server-only) -- IO wrapper: `readFrontmatter(path)`, `writeFrontmatterField(path, field, value)`. Uses Node `fs` directly (BC is server-only). Errors throw with file context.
- `libs/bc/hangar/src/review-test-plan.ts` -- markdown table parser. Walks the AST via a small markdown-table parser (zero new deps -- markdown is regular enough; lift the table-row regex into a tested helper). Each row -> `{ stepIndex, sectionTitle, title, action, expected, stepRef }` where `stepRef = sha256(filePath + '|' + h2 + '|' + rowIndex).slice(0, 12)`. Vitest round-trip on `flightbag-scaffold/test-plan.md` + 3 others (this WP's own, hangar-invite-flow, sim-card-mapping).
- `libs/bc/hangar/src/review-discovery.ts` -- `DISCOVERY_RULES`. Rules:
  - `wp_spec`: glob `docs/work-packages/*/spec.md`
  - `wp_test_plan`: glob `docs/work-packages/*/test-plan.md` (parent ref = sibling spec dir)
  - `reference_toc`: query `hangar.reference` rows with non-null `verbatim`
  - `knowledge_node`: glob `course/knowledge/**/node.md` (cf gap #1: emit ALL nodes, not only `discovery_review: pending`)
  - `ad_hoc`: hand-created, no discovery
- `libs/bc/hangar/src/review-loader.ts` -- `loadReviewItems()` orchestrator. Runs each rule, upserts items, soft-prunes missing (sets `deletedAt`), emits `{ added, updated, removed, errors }`. Also walks `DOCS_SEARCH_ROOTS` -> upserts `hangar.docs_search_index` rows; prunes deleted files. Idempotent.
- `apps/hangar/src/hooks.server.ts` -- run `loadReviewItems()` once on boot (debounced; behind a module-scoped `Promise` so concurrent requests share one scan).
- `scripts/hangar/reload-reviews.ts` + root `package.json` script `hangar:reload-reviews` -- CLI trigger.
- Tests: `review-loader.test.ts` (with a tiny temp dir of fixture markdown to assert add / update / prune), `review-discovery.test.ts`, `review-frontmatter.test.ts`.

Acceptance: running the loader against the current main produces ~89 WP items + ~46 knowledge-node items + reference rows. Frontmatter edit + reload reflects in `cachedStatus`.

Reviewers: backend, correctness, patterns.

### Phase 3 -- Docs browser (`/docs`) + Postgres FTS + sidebar entry

Goal: a beautiful read-only viewer over `docs/**` with FTS search. Independent of reviews.

- `libs/ui/src/components/FileTree.svelte` -- collapsible directory tree; persists open state in `localStorage` per a stable key. Active file highlighted. Source: a plain `{ path, type: 'file'|'dir', children?: ... }` tree.
- `apps/hangar/src/routes/(app)/docs/+layout.svelte` -- two-pane shell; `<FileTree>` left, `{@render children()}` right, search box top-right.
- `apps/hangar/src/routes/(app)/docs/+layout.server.ts` -- builds the docs tree (BC call `listDocsTree()`).
- `apps/hangar/src/routes/(app)/docs/+page.svelte` -- index landing; renders `docs/work/NOW.md` body via the existing markdown renderer.
- `apps/hangar/src/routes/(app)/docs/[...path]/+page.server.ts` -- read file by joined path (with `..` rejection + root allow-list check), parse frontmatter, return body + entries.
- `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte` -- breadcrumb, rendered body via `@ab/library/RenderedSection.svelte` (or a thin wrapper if section-shape doesn't fit), right-rail frontmatter panel, internal-link rewrite (`docs/...` -> `/docs/...`).
- `libs/bc/hangar/src/docs-tree.ts` -- `listDocsTree(roots)` -- recursive `fs.readdir`, returns the tree shape.
- `libs/bc/hangar/src/docs-search.ts` -- `searchDocs(query, limit)` -- `plainto_tsquery` + `ts_headline` + `ts_rank`, returns `{ path, title, snippet, rank }[]`.
- Search UI: a small `SearchBox.svelte` in `apps/hangar/src/lib/components/` -- 200ms debounce, results dropdown, click navigates.
- Empty-index state: "Index not built -- run loader" with a `?/runLoader` form action.
- Internal markdown link resolver: extend `renderMarkdown` with an option to rewrite link prefixes? Or post-process the output. Cheaper: post-process. Add a small `rewriteDocsLinks(html, currentPath)` helper in the docs `+page.svelte` server load.
- `apps/hangar/src/lib/components/Nav.svelte` -- add `Docs` link.

Acceptance: every existing `docs/**` markdown renders correctly; this WP's spec.md tables align; search "discovery-first pedagogy" returns ADR 011 + CLAUDE.md ranked by relevance.

Reviewers: svelte, ux, a11y, perf.

### Phase 4 -- Review board (`/review`) + sidebar entry

Goal: kanban with bucket cards + item cards over loaded items.

- `apps/hangar/src/routes/(app)/review/+layout.server.ts` -- get-or-create board, seed columns + kinds + buckets if absent, list items (filtered server-side per query params).
- `apps/hangar/src/routes/(app)/review/+page.svelte` -- the board. Columns by `boardColumn.sortOrder`. Two card flavors.
- `apps/hangar/src/routes/(app)/review/+page.server.ts` -- form actions: `?/move` (drag-drop -> updates columnId + frontmatter writer per spec rules), `?/runLoader` (refresh button).
- `libs/ui/src/components/BucketCard.svelte` -- title + count + expand chevron + inline drawer.
- `libs/ui/src/components/ItemCard.svelte` -- title + status pills + ref subtext + drag handle.
- `libs/ui/src/components/BoardColumn.svelte` -- column shell with drop-target.
- Drag-and-drop: HTML5 native (`dragstart`/`dragover`/`drop`); reuses pattern from existing UI library if any (search first; otherwise minimal new). On drop -> form action.
- Filter chip bar: `All / Reviews / Tasks` + kind multi-select + free-text -- all `$derived` over loaded items (no round-trip).
- `apps/hangar/src/routes/(app)/review/buckets/[id]/+page.{server.ts,svelte}` -- bucket detail, full sortable item list.
- `apps/hangar/src/routes/(app)/review/items/[itemId]/+page.server.ts` -- dispatcher; redirects to per-kind route.
- `apps/hangar/src/lib/components/Nav.svelte` -- add `Review` link.

Acceptance: `/review` shows seed buckets with live counts. Dragging a `wp_spec` from Backlog -> In Progress writes `status: reading` to the underlying spec.md (verifiable via `git diff`).

Reviewers: svelte, ux, a11y, backend, patterns.

### Phase 5 -- WP spec view + test-plan walker (the killer feature)

Goal: review a WP and walk its test plan with persisted step state.

- `apps/hangar/src/routes/(app)/review/wp_spec/[itemId]/+page.{server.ts,svelte}` -- tabs: Spec / Tasks / Test Plan / Design / User Stories / Notes. Each renders the corresponding markdown via the docs renderer. "Not present" placeholder if a file is absent.
- Footer actions: `Mark spec read` (writes `status: done`), `Open test-plan walker` (link to walker), `Flip review_status` (confirm dialog).
- `apps/hangar/src/routes/(app)/review/wp_test_plan/[itemId]/+page.{server.ts,svelte}` -- the walker.
- Walker server load: lookup item, find sibling test-plan.md, parse via `review-test-plan.ts`, get-or-create open session for `(itemId, userId)`, load existing steps.
- Walker actions: `?/recordStep` (outcome + note), `?/pauseSession` (no-op if open; navigates back), `?/finishSession` (with conditional flip prompt).
- `libs/ui/src/components/WalkerStepRow.svelte` -- step row with three outcome buttons + note textarea (debounced save on blur via the form action).
- Resume behavior: re-opening the walker for an item with an open session restores outcomes (server load returns them, UI hydrates).
- Session history panel on WP spec view (right rail).

Acceptance: walking `flightbag-scaffold/test-plan.md` end-to-end persists every outcome, survives reload, and on finish offers to flip frontmatter when 100% pass.

Reviewers: svelte, ux, a11y, correctness.

### Phase 6 -- Other review kinds (TOC, knowledge node) + ad-hoc tasks

- `apps/hangar/src/routes/(app)/review/reference_toc/[itemId]/+page.{server.ts,svelte}` -- TOC pane left, content pane right. Keyboard `j` / `k` / `b` for pass / fail / blocked. Each TOC entry = one step.
- `apps/hangar/src/routes/(app)/review/knowledge_node/[itemId]/+page.{server.ts,svelte}` -- single-decision Pass / Fail + note.
- `apps/hangar/src/routes/(app)/review/tasks/new/+page.{server.ts,svelte}` -- create form (title, description, type, productArea).
- `apps/hangar/src/routes/(app)/review/tasks/[taskId]/edit/+page.{server.ts,svelte}` -- edit + delete.
- Ad-hoc cards on the board: full drag CRUD (no frontmatter side-effect). Already supported by Phase 4 substrate.

Acceptance: each kind opens its custom view and persists outcomes. New ad-hoc task lands on the board.

Reviewers: svelte, ux, a11y, correctness.

### Phase 7 -- Loader admin + bucket admin + nav badge

- `apps/hangar/src/routes/(app)/review/admin/loader/+page.{server.ts,svelte}` -- last scan summary (counts, errors, last run timestamp), Refresh button.
- `apps/hangar/src/routes/(app)/review/admin/buckets/+page.{server.ts,svelte}` -- list buckets: name, kind, filter summary, item count, sort order, Edit / Delete.
- `apps/hangar/src/routes/(app)/review/admin/buckets/new/+page.{server.ts,svelte}` -- form: name, kind dropdown, structured filter editor + Advanced jsonb predicate textarea, sort order, target column.
- `apps/hangar/src/routes/(app)/review/admin/buckets/[id]/edit/+page.{server.ts,svelte}` -- same form pre-filled + Delete.
- BC validation: name unique per board (DB partial index), filter parses as jsonb, kind in `REVIEW_KINDS`. Surfaces inline.
- On bucket delete: items not deleted (fall through). DB `ON DELETE SET NULL` on item.bucketId? Spec says items "fall through to whatever bucket catches them or hide" -- so items are not pinned to buckets at all; buckets are just queries. Confirm via spec re-read; if so, no `bucketId` on item, just filter execution. (This is the design.md `filterCriteria` model.)
- Nav: `Review` entry shows total open-review count badge; sub-nav surfaces per-bucket counts.

Reviewers: svelte, ux, a11y, backend, security (form validation paths).

### Phase 8 -- Tests + e2e + final review + status flip

Polish runs ALONE. No feature work mixed in.

- Playwright e2e suites in `tests/e2e/`:
  - `review-board.spec.ts`: load board, drag a card, verify frontmatter write.
  - `review-walker.spec.ts`: walk a test plan, verify session + steps persisted.
  - `docs-browser.spec.ts`: nested path render + internal-link resolution.
- Visual polish: bucket-expand animation, drag ghost, walker step transitions. Token sweep: confirm no hex literals remain in any new component (greppable).
- `bun run check` 0/0. `bun run test`. `bun run test:e2e`.
- `/ball-review-full` (10 parallel reviewers, read-only). Fix every finding: critical, major, minor, nit.
- Re-verify: `bun run check`, tests, grep for symptoms.
- Update docs:
  - `docs/work-packages/hangar-review-queue/{spec,tasks,test-plan,design,user-stories}.md` -- frontmatter `status: ready-for-review`
  - `docs/work-packages/hangar-review-queue/review.md` -- new, summarising the full review pass with `status: done`, `review_status: pending`
  - `docs/products/hangar/PRD.md` -- add review queue to feature list
  - `docs/products/hangar/TASKS.md` -- mark this WP done
  - `docs/work/NOW.md` -- move `hangar-review-queue` from ACTIVE to RECENTLY-LANDED

Reviewers (Phase 8): full 10x pass.

## Per-phase reviewer matrix

| Phase                                         | Reviewers                                               |
| --------------------------------------------- | ------------------------------------------------------- |
| 1 (constants + schema + BC)                   | schema, backend, correctness                            |
| 2 (frontmatter + parser + loader)             | backend, correctness, patterns                          |
| 3 (`/docs` + FTS)                             | svelte, ux, a11y, perf                                  |
| 4 (board + drag)                              | svelte, ux, a11y, backend, patterns                     |
| 5 (WP spec + walker)                          | svelte, ux, a11y, correctness                           |
| 6 (TOC + knowledge + tasks)                   | svelte, ux, a11y, correctness                           |
| 7 (admin)                                     | svelte, ux, a11y, backend, security                     |
| 8 (e2e + polish + status flip)                | full 10x (ux, svelte, security, perf, architecture, patterns, correctness, a11y, backend, schema) |

## Commit cadence

One commit per phase minimum; separate `fix(...): address phase {N} review findings` commit if reviewers find anything. Stage by name. No `git add -A`. No AI attribution.

## Out of scope (per spec)

- Multi-user assignment UI (schema field exists; no picker)
- Header notification badges
- Multi-select / bulk operations
- Slash-command keyboard shortcuts

These remain spec-listed deferrals; not built, not stubbed.

## Risks

- **Loader scan time on first boot.** ~90 WPs + ~46 knowledge nodes + maybe-many docs files for FTS. Phase 2 acceptance check should sanity-time the scan; if > 5s, defer FTS indexing to a background job.
- **Drag-and-drop without a library.** HTML5 native works but is finicky on touch. v1 desktop-only; touch defer.
- **`db push` workflow vs migrations.** Per `drizzle/README.md` we use `db push`; the 8 new tables land via reset. No hand-written migration.

## Open questions for dispatcher (one-line answers acceptable)

A. Confirm the "spec gaps" resolutions in the table above (or override).
B. Confirm e2e Playwright is the right test boundary for this WP (vs Vitest-only + manual).
C. Any reason to ship `/docs` without FTS in Phase 3 and add FTS as a separate phase?

Default if no response: proceed with the resolutions as written; e2e in Phase 8; FTS in Phase 3.
