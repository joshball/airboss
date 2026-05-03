---
title: Hangar Review Queue -- Design
product: hangar
feature: hangar-review-queue
type: design
status: draft
review_status: pending
---

# Hangar Review Queue -- Design

UI shapes, layout, and per-surface interaction details. Read [spec.md](./spec.md) first.

## Information architecture

```text
hangar
├── /docs                    Docs browser (read-only)
│   └── /docs/[...path]      Render any docs/** file
├── /review                  Review board (default tab)
│   ├── /review/buckets/[id] Bucket detail (item list)
│   ├── /review/items/[id]   Item detail (dispatcher)
│   ├── /review/wp_spec/[id] WP spec view (tabs)
│   ├── /review/wp_test_plan/[id]   Test-plan walker
│   ├── /review/reference_toc/[id]  TOC spot-check
│   ├── /review/knowledge_node/[id] Discovery review
│   └── /review/tasks        Ad-hoc tasks
└── /review/admin/loader     Loader status + manual refresh
```

## Surface 1 -- Docs browser

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ◀ Docs   /  work-packages  /  hangar-review-queue  /  spec.md       │  Breadcrumb
├──────────────┬───────────────────────────────────────────────────────┤
│ ▾ docs/      │  # Hangar Review Queue -- Spec                        │
│   ▾ work-    │                                                       │
│     ▾ wp-    │  A review-centric backlog and kanban board ...        │
│       ▸ ...  │                                                       │
│       ▾ rev- │  ## Problem                                           │
│         spec │  ...                                                  │
│         des- │                                                       │
│         tas- │  ┌─ Frontmatter ─────────┐                            │
│         tes- │  │ status: draft         │   <- right-rail panel      │
│         use- │  │ review_status: pending│      (collapses on mobile) │
│   ▸ platform │  │ type: spec            │                            │
│   ▸ ...      │  └───────────────────────┘                            │
└──────────────┴───────────────────────────────────────────────────────┘
                                                            [Search ⌕]
```

- File tree: collapsible directories. Persist open/closed in `localStorage`.
- Active file highlighted in the tree.
- Right-rail frontmatter panel: collapses on mobile, hidden if no frontmatter.
- Search: top-right input. Debounced. Backed by Postgres FTS (see "Search index" below). Title matches outrank body matches via `setweight`. Snippets are server-rendered with `ts_headline` and the highlight tags styled inline.
- Internal markdown links between docs (e.g., `[ADR 011](docs/decisions/011-...)`) resolve to in-app `/docs/...` paths.

## Surface 2 -- Review board

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Hangar Review        [All ▼] [Reviews] [Tasks]  [+ Ad-hoc]   ⟳    │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│  Backlog (5) │ In Progress  │  Review (2)  │  Done                 │
│              │   (3)        │              │                       │
├──────────────┼──────────────┼──────────────┼───────────────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │                       │
│ │ WP Specs │ │ │ TOC      │ │ │ wp_spec  │ │  ...                  │
│ │ unread   │ │ │ refs     │ │ │ flightbag│ │                       │
│ │   34   ▾ │ │ │   12   ▾ │ │ │ -scaffold│ │                       │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │                       │
│              │              │              │                       │
│ ┌──────────┐ │ ┌──────────┐ │              │                       │
│ │ Knowledge│ │ │ wp_spec  │ │              │                       │
│ │ pending  │ │ │ cert-    │ │              │                       │
│ │   8    ▾ │ │ │ dashboard│ │              │                       │
│ └──────────┘ │ └──────────┘ │              │                       │
└──────────────┴──────────────┴──────────────┴───────────────────────┘
```

### Bucket card vs item card

| Card type | Drag? | Click | Visual                                         |
| --------- | ----- | ----- | ---------------------------------------------- |
| Bucket    | No    | Expand drawer with item list | Bold title + small kind badge + count chip      |
| Item      | Yes   | Open per-kind review view    | Title + status pills + ref subtext             |

Buckets sit in their derived column based on majority/aggregate item state. Items the user has explicitly pinned (dragged) override their derived column.

### Bucket drawer (expanded)

Inline, opens beneath the bucket card on click. Shows the items as compact rows:

```text
┌──────────────────────────────┐
│ WP Specs -- unread       34 ▾│
├──────────────────────────────┤
│ flightbag-scaffold     [→]   │
│ knowledge-graph        [→]   │
│ learning-dashboard     [→]   │
│ ...                          │
│                              │
│ Show 34 in full list  [→]    │
└──────────────────────────────┘
```

`Show in full list` navigates to `/review/buckets/[id]` with the full sortable / filterable list.

### Filter chip bar

`[All] [Reviews] [Tasks]` -- single-select. Defaults to All. Behind, a kind multi-select (badges) and free-text search.

### Drag-and-drop

Reuse the airboss-firc HTML5 drag pattern: `dragstart` / `dragover` / `drop` on cards and columns. On drop, fetch the `move` form action. Server-side: update `columnId` (always) and write back frontmatter (per the rules in spec.md). On frontmatter write failure, return 409 + revert toast.

## Surface 3 -- Review views

### `wp_spec` -- Tabs

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ◀ Review   /   wp_spec   /   flightbag-scaffold                    │
│                                                                     │
│  [Spec] [Tasks] [Test Plan] [Design] [User Stories] [Notes]        │
│                                                                     │
│  ┌──────────────────────────────────────────────────┐  ┌──────────┐│
│  │ # Flightbag Scaffold -- Spec                     │  │ Status   ││
│  │                                                  │  │ ready    ││
│  │ ...                                              │  │ -for-rev ││
│  │ ...                                              │  │          ││
│  │                                                  │  │ Sessions ││
│  └──────────────────────────────────────────────────┘  │  - 1 open││
│                                                        │  - 2 done││
│  [Mark spec read]  [Open test-plan walker]   [Flip ✓] │└──────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

- Tabs render the corresponding markdown file.
- Right-rail: status panel + session history.
- Footer actions: "Mark spec read" (writes `status: done`), "Open test-plan walker" (opens walker for the same WP), "Flip review_status" (gated behind a confirm; writes `review_status: done`).

### `wp_test_plan` -- Walker

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ◀ Review   /   Test Plan   /   flightbag-scaffold                  │
│                                                                     │
│  Session #2 -- started 14:21    [Pause]  [Finish]                   │
│  Progress: 4/12 passed -- 1 blocked -- 7 remaining                  │
│                                                                     │
│  ## 1. First Visit -- Auto-Setup                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1.1  Navigate to /flightbag with empty database              │  │
│  │      Expected: Default board + columns auto-created          │  │
│  │      [Pass ✓] [Fail] [Blocked]   Note: ___________________   │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 1.2  Verify columns                                          │  │
│  │      Expected: Backlog / In Progress / Review / Done         │  │
│  │      [Pass]    [Fail ✗] [Blocked]                            │  │
│  │      Note: "In Progress" reads "InProgress" (no space)       │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ ...                                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

- Renders the markdown headers as section dividers.
- Each table row in test-plan.md becomes a checklist row with three outcome buttons + note textarea.
- Outcomes save on click; notes save on blur.
- `[Pause]` closes the session as in-progress; the item moves to In Progress on the board.
- `[Finish]` prompts: "Mark this test plan complete?" If 100% pass, additional prompt: "Flip review_status: done?"

### Test-plan parser

A small parser converts a test-plan.md file into a list of steps:

- Walks the AST looking for tables.
- Each table row (excluding header) becomes a step with `{ stepIndex, title (column 1), action (column 2), expected (column 3) }`.
- `stepRef` = stable hash of `(file path, h2 heading, row index)` -- so renumbering rows in a test plan invalidates cleanly rather than silently re-mapping.
- Section H2 headings (`## 1. First Visit -- Auto-Setup`) become group labels.

If a future test plan uses checklists instead of tables, the parser extends. v1 = tables only.

### `reference_toc` -- TOC spot-check

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ◀ Review   /   TOC Review   /   AFH-2024                           │
├─────────────────────────────┬───────────────────────────────────────┤
│  Table of Contents          │ # Chapter 1: Introduction to Flying   │
│                             │                                       │
│  [✓] Ch 1: Introduction     │ ...rendered chapter body...           │
│  [✗] Ch 2: Aerodynamics  ◀  │                                       │
│  [ ] Ch 3: Flight Inst...   │                                       │
│  [ ] Ch 4: Energy Mgmt      │                                       │
│  ...                        │                                       │
│                             │                                       │
│  k = pass  j = fail  b = block                                      │
└─────────────────────────────┴───────────────────────────────────────┘
```

- Left list = TOC entries. Click an entry, content loads on right.
- Keyboard: `j` / `k` / `b` mark current entry, advance.
- Each entry is a step in the active session.

### `knowledge_node` -- Discovery review

Renders the node markdown + its hooks. Reviewer confirms WHY-first ordering (per ADR 011) with a single Pass/Fail per node + note. No multi-step walker -- it's a single-decision review.

### `ad_hoc` -- Generic task

The airboss-firc task card form. Title / description / type / productArea. No steps.

## Per-kind dispatch

Sketched in pseudocode:

```typescript
const KIND_VIEWS = {
  wp_spec: '/review/wp_spec/[itemId]',
  wp_test_plan: '/review/wp_test_plan/[itemId]',
  reference_toc: '/review/reference_toc/[itemId]',
  knowledge_node: '/review/knowledge_node/[itemId]',
  ad_hoc: '/review/tasks/[itemId]',
} satisfies Record<ReviewKind, string>;
```

`/review/items/[itemId]/+page.server.ts` looks up the item, redirects to the right per-kind route. Direct deep links (`/review/wp_spec/flightbag-scaffold`) are also supported.

## Search index

`hangar.docs_search_index` shape:

```sql
CREATE TABLE hangar.docs_search_index (
  path        text PRIMARY KEY,
  title       text NOT NULL,
  body        text NOT NULL,
  frontmatter jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  tsv         tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')),  'B')
  ) STORED
);
CREATE INDEX docs_search_idx ON hangar.docs_search_index USING gin (tsv);
```

The loader walks `DOCS_SEARCH_ROOTS` (`docs`, `course`, `handbooks`, `regulations`) and upserts each file's title (frontmatter > first H1 > path) and body. Drizzle expresses the generated column via `sql` literal; migration via `db push`.

Query shape (in `searchDocs`):

```sql
SELECT path, title,
       ts_headline('english', body, q,
         'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MinWords=5, MaxWords=20'
       ) AS snippet,
       ts_rank(tsv, q) AS rank
FROM hangar.docs_search_index, plainto_tsquery('english', $1) q
WHERE tsv @@ q
ORDER BY rank DESC
LIMIT $2;
```

The frontend renders `snippet` as HTML (the `<mark>` tags are part of the search response; sanitize anything outside the markers).

## Bucket admin

`/review/admin/buckets` -- table view:

| Name                       | Kind         | Filter summary                              | Items | Sort | Actions     |
| -------------------------- | ------------ | ------------------------------------------- | ----- | ---- | ----------- |
| WP Specs -- unread         | wp_spec      | frontmatterStatus = unread                  | 34    | 0    | Edit Delete |
| WP Test Plans -- pending   | wp_test_plan | parent.reviewStatus = pending               | 21    | 1    | Edit Delete |
| ...                        | ...          | ...                                         | ...   | ...  | ...         |

Form (new + edit):

```text
┌──────────────────────────────────────────────┐
│ Name             [_______________________]   │
│ Kind             [wp_spec ▼]                 │
│                                              │
│ Filter -- structured                         │
│   frontmatterStatus  [is ▼] [unread ▼]       │
│   reviewStatus       [any ▼]                 │
│   [+ Add filter]                             │
│                                              │
│ Filter -- advanced (jsonb predicate)         │
│   [_______________________________________]  │
│                                              │
│ Sort order       [0]                         │
│ Target column    [Backlog ▼]                 │
│                                              │
│            [Cancel]   [Save]                 │
└──────────────────────────────────────────────┘
```

The structured form serializes to a `filterCriteria` jsonb. The Advanced textarea appends additional predicates (validated server-side; errors surface inline). Power-users get the textarea, the common case stays a few dropdowns.

Bucket delete is a confirm dialog. Items in the deleted bucket are not deleted; they fall through to whatever bucket catches them next, or are hidden until a new bucket is created.

## Loader

Discovery rules per kind, expressed as data:

```typescript
const DISCOVERY_RULES: Record<ReviewKind, DiscoveryRule> = {
  wp_spec: {
    glob: 'docs/work-packages/*/spec.md',
    extract: (file) => ({ ref: dirname(file), title: frontmatter.title, ...frontmatterCache }),
  },
  wp_test_plan: {
    glob: 'docs/work-packages/*/test-plan.md',
    extract: (file) => ({ ref: dirname(file) + '#test-plan', title: ..., parentRef: dirname(file) }),
  },
  reference_toc: {
    source: 'db',
    query: 'SELECT id, name FROM reference WHERE NOT EXISTS (SELECT 1 FROM review_session WHERE itemId = reference.id AND outcome = "pass")',
  },
  // ...
};
```

The loader runs each rule, upserts items into `review_item`, prunes items whose source artifact is gone (with a soft-delete window so resurrected items keep their session history).

## Frontmatter writer

A small utility in `libs/utils` (or inlined into the hangar BC if not reusable):

```typescript
async function setFrontmatterField(filePath: string, field: string, value: string): Promise<void>;
```

Implementation: read file, parse frontmatter block (the `---` ... `---` at the top), update or insert the field, write back. Touches only the frontmatter block; body is byte-stable. Failed writes throw with file context for the caller to surface.

## Constants

```typescript
// libs/constants/src/review.ts
export const REVIEW_KINDS = ['wp_spec', 'wp_test_plan', 'reference_toc', 'knowledge_node', 'ad_hoc'] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const REVIEW_OUTCOMES = ['pass', 'fail', 'blocked'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const SESSION_OUTCOMES = ['pass', 'fail', 'abandoned'] as const;
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

export const FRONTMATTER_STATUSES = ['unread', 'reading', 'done'] as const;
export const FRONTMATTER_REVIEW_STATUSES = ['pending', 'done'] as const;

export const REVIEW_BOARD_DEFAULT_COLUMNS = ['Backlog', 'In Progress', 'Review', 'Done'] as const;

export const DOCS_SEARCH_ROOTS = ['docs', 'course', 'handbooks', 'regulations'] as const;
```

```typescript
// libs/constants/src/routes.ts (additions)
DOCS: '/docs',
DOCS_PATH: (path: string) => `/docs/${path}`,
REVIEW: '/review',
REVIEW_BUCKET: (id: string) => `/review/buckets/${id}`,
REVIEW_ITEM: (id: string) => `/review/items/${id}`,
REVIEW_KIND: (kind: ReviewKind, id: string) => `/review/${kind}/${id}`,
REVIEW_WALKER: (kind: ReviewKind, id: string) => `/review/${kind}/${id}/walker`,
REVIEW_TASK_NEW: '/review/tasks/new',
REVIEW_ADMIN_LOADER: '/review/admin/loader',
REVIEW_ADMIN_BUCKETS: '/review/admin/buckets',
REVIEW_ADMIN_BUCKET_NEW: '/review/admin/buckets/new',
REVIEW_ADMIN_BUCKET_EDIT: (id: string) => `/review/admin/buckets/${id}/edit`,
```

## Theming

Reuse existing tokens. Outcome colors:

- `--outcome-pass` -- semantic success
- `--outcome-fail` -- semantic danger
- `--outcome-blocked` -- semantic warning

Add to `libs/themes` if not already present. No hex literals in components.

## Component map

| Component                  | Lib                       | Reuse?                          |
| -------------------------- | ------------------------- | ------------------------------- |
| Markdown renderer          | `libs/library`            | Yes, RenderedSection            |
| File tree                  | new in `libs/ui`          | New (or borrow from sources UI) |
| Board / columns / cards    | new in `libs/ui`          | New, port shape from firc       |
| Walker step row            | new in `libs/ui`          | New                             |
| TOC spot-check pane        | new in `libs/ui`          | New                             |
| ConfirmDialog              | `libs/ui`                 | Existing                        |
| StatusPill                 | `libs/ui`                 | Existing or trivial new         |
