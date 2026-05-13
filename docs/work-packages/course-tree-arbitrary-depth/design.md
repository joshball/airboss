---
id: course-tree-arbitrary-depth
title: 'Design: Course Tree -- Arbitrary Depth'
product: platform
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-12
owner: agent
depends_on:
  - course-primitive
unblocks:
  - wx-scenarios-course-section
tags:
  - course
  - design
  - schema
legacy_fields:
  feature: course-tree-arbitrary-depth
  type: design
---

# Design: Course Tree -- Arbitrary Depth

Design notes for generalising the 2-level course tree to N levels. Covers the three structural options considered, the schema CHECK predicate, the recursive tree-builder algorithm, the prev/next traversal, the renderer pattern, the migration approach for the existing 10 sections, and cross-WP coordination.

## Three options considered

### Option A: Generalised arbitrary-depth tree (RECOMMENDED)

Add a new level `lesson` between `section` and `step`. The CHECK constraint permits:

- `section`: root level, NULL parent, no node, not a leaf
- `lesson`: interior, parent in {section, lesson}, no node, not a leaf, >= 1 child
- `step`: leaf, parent in {section, lesson}, node required, is a leaf, no children

`knowledge_node_id` becomes optional for non-leaf rows (it is already nullable at the column level; the new CHECK relaxes the existing "step requires node" rule to "leaf requires node").

Depth is unbounded at the schema layer; the seed validator caps at `COURSE_TREE_MAX_DEPTH = 10` defensively. A 2-level tree (today's content) is the trivial case: no `lesson` rows, every step parents directly to a section.

**Pros**:

- Aligns with Joshua's "LMS conforms to us" directive
- Existing content is a strict subset (zero migration work)
- One generalisation handles 3 levels, 4 levels, 5+ -- no follow-up WP per depth
- The level vocabulary (`section`, `lesson`, `step`) is what aviation training actually uses

**Cons**:

- Slightly more complex seed walk + lens recursion
- Renderer must distinguish 3 row kinds instead of 2

### Option B: Fixed 3-level tree

Same as Option A but the CHECK hard-codes `lesson` as exactly the level between section and step. Depth is exactly 3.

**Pros**:

- Slightly simpler schema CHECK (no recursive parent rule)
- Predictable rendering depth

**Cons**:

- The first time pedagogy wants 4 levels (e.g. a sub-lesson within a lesson for a deeper Socratic walk), we run this WP again
- "Fixed N" thinking is exactly the throttle Joshua named

### Option C: Drop the `level` field entirely

Hierarchy is purely `parent_id`-driven. A row is a "section" if `parent_id IS NULL`; a leaf if no other row points at it. No `level` column, no CHECK on level.

**Pros**:

- Simplest schema
- Maximally flexible

**Cons**:

- Loses the explicit `section / lesson / step` pedagogy semantic at the schema layer
- Renderer must compute depth-classification on the fly (CSS for "this is a section" depends on a query "is this row's parent null?")
- Validator becomes harder to express ("a section must not carry a node" depends on a derived classification, not a column)
- The level vocabulary is a load-bearing concept for authors and learners; making it implicit hurts authoring clarity

### Decision: Option A

Per the directive "we don't conform to the LMS, the LMS conforms to US," Option A keeps the pedagogy vocabulary explicit + unbounded. Option B is the right answer if the WP is allowed to ship a half-fix; Option C is the right answer if the explicit level semantic isn't load-bearing. Neither tradeoff is the right one for this codebase: Option A is the answer.

## Schema CHECK predicate (Option A)

```sql
CHECK (
  -- section: root, no parent, no node, not a leaf
  ("level" = 'section'
    AND "parent_id" IS NULL
    AND "knowledge_node_id" IS NULL
    AND "is_leaf" = false)
  OR
  -- lesson: interior, has a parent, no node, not a leaf
  ("level" = 'lesson'
    AND "parent_id" IS NOT NULL
    AND "knowledge_node_id" IS NULL
    AND "is_leaf" = false)
  OR
  -- step: leaf, has a parent, has a node, is a leaf
  ("level" = 'step'
    AND "parent_id" IS NOT NULL
    AND "knowledge_node_id" IS NOT NULL
    AND "is_leaf" = true)
)
```

Constraint name stays `course_step_consistency_check`. Three-arm OR. The parent-of-a-lesson is not constrained to be in `{section, lesson}` at the DB layer (CHECK can't reach across rows); the seed validator enforces it.

## Recursive tree-builder algorithm

The lens reads every `course_step` row for the course once (already happens today via `getCourseStepsByCourse`), groups by `parent_id`, then recursively builds the nested tree:

```typescript
const childrenByParent = groupByParentId(rows);  // Map<string | null, CourseStepRow[]>
for (const list of childrenByParent.values()) list.sort((a, b) => a.ordinal - b.ordinal);

function buildSubtree(row: CourseStepRow): LensTreeNode | LensLeaf {
  if (row.isLeaf) return buildLeaf(row);
  const kids = childrenByParent.get(row.id) ?? [];
  const childNodes: LensTreeNode[] = [];
  const leafNodes: LensLeaf[] = [];
  for (const kid of kids) {
    const built = buildSubtree(kid);
    if ('children' in built) childNodes.push(built);
    else leafNodes.push(built);
  }
  return {
    id: row.id,
    level: row.level,                  // 'section' | 'lesson'
    title: row.title,
    rollup: computeRollupFor(childNodes, leafNodes),
    children: childNodes,
    leaves: leafNodes,
  };
}

const sectionRows = childrenByParent.get(null) ?? [];
const tree = sectionRows.map(buildSubtree);
```

Complexity: O(N) where N is the row count for the course (each row visited exactly once). Mastery rollup aggregates leaf mastery via `computeMasteryRollup`, mirroring the existing 2-level lens behaviour at every interior. The recursion is depth-bounded by `COURSE_TREE_MAX_DEPTH` (10); plenty of stack headroom in JS.

Alternative considered: iterative tree build via a single pass that constructs `id -> node` map then wires children. Marginal performance gain at the cost of readability. Recursion wins on clarity; tree sizes are tiny (tens of rows, not thousands).

## Prev/next traversal algorithm

The leaf list for the course is the document-order flatten:

```typescript
export function flattenLeavesDepthFirst(tree: LensTreeNode[]): LensLeaf[] {
  const out: LensLeaf[] = [];
  function walk(node: LensTreeNode): void {
    for (const leaf of node.leaves ?? []) out.push(leaf);
    for (const child of node.children ?? []) walk(child);
  }
  for (const node of tree) walk(node);
  return out;
}
```

The walk visits a node's direct leaves before recursing into its child interiors. This matches the natural authoring order: a section with `body_md` framing, then leaf steps under the section, then deeper lesson groupings of leaves later. If an author wants leaves interleaved with lessons in ordinal order, that's representable today: every child of a section / lesson has its own `ordinal`, and the children list is sorted by ordinal regardless of level. The walk respects the sorted order.

Prev/next from a leaf:

```typescript
const leaves = flattenLeavesDepthFirst(tree);
const i = leaves.findIndex((l) => l.id === currentStep.id);
const prev = i > 0 ? leaves[i - 1] : null;
const next = i < leaves.length - 1 ? leaves[i + 1] : null;
```

Prev/next from a non-leaf:

- "current position" is the first leaf descendant of the non-leaf
- `prev` is the leaf immediately before that position (i.e., the last leaf of the previous sibling, or the last leaf of the previous section if at the start of a section's children)
- `next` is the first leaf descendant itself (so clicking next on a lesson landing enters the lesson)

Both cases reduce to the same `findIndex` lookup once "current position" is computed.

## Renderer pattern

### Course landing

Static recursive render. A Svelte snippet (`{#snippet treeNode(node)}`) calls itself for every child. Section -> h2; lesson -> h3 (or h4 at deeper depth, by walking the depth and capping at h6); leaf -> li with link.

No JS-driven collapse / expand for v1. The outline is static. If at content scale (a course with hundreds of leaves) the page becomes unwieldy, a collapse pass is a follow-up. Today's weather-comprehensive course has 10 sections and ~50 steps -- no collapse needed. The 3-level WX scenarios section adds 6 lessons * 4 substeps = 24 leaves under one section, well within static-render bounds.

### Step reader

Two branches:

- **Leaf (`is_leaf=true`)**: renders the knowledge-node phases and framing exactly as today. No change to the existing render path
- **Non-leaf (`is_leaf=false`)**: renders a landing page with:
  - Breadcrumbs at the top (course -> section -> lesson chain -> current title)
  - The row's `body_md` (intro framing for the section / lesson)
  - A child list: each child entry is a card with title, level badge (`section` / `lesson` / `step`), `body_md` truncated to ~200 chars, link to the child's `[stepCode]` URL
  - Prev/next at the bottom (using the first-leaf-descendant semantic)

The shared `[stepCode]/+page.svelte` switches on `is_leaf` and delegates to one of two snippet bodies.

### Breadcrumb

Computed in the load function by walking up the parent chain (every `course_step` row carries `parent_id`). The chain is bounded by `COURSE_TREE_MAX_DEPTH` so it's cheap. Each breadcrumb segment is a link to that parent's landing page.

## Migration approach for existing 10 sections

No data migration. The new schema is a strict superset of the old: every shape the old CHECK accepted, the new CHECK also accepts. Concretely:

- Old `level='section'` row: `parent_id=NULL`, `knowledge_node_id=NULL`, `is_leaf=false` -- still satisfies arm 1 of the new CHECK
- Old `level='step'` row: `parent_id NOT NULL`, `knowledge_node_id NOT NULL`, `is_leaf=true` -- still satisfies arm 3 of the new CHECK

The proof is the T3.1 round-trip case in [test-plan.md](./test-plan.md): dump rows before the schema change, reseed after, hash-compare the row set; expect zero diff.

The seed pipeline's depth-first walk treats the existing flat-section / flat-step YAML as the trivial case: every step is a leaf parenting directly to a section; there are no `lesson` rows. The validator runs the same general algorithm; the same content emerges.

Per CLAUDE.md "There are no Drizzle migrations": this is a single greenfield schema regen, not a phased migration. The Phase A PR:

1. Edits `libs/bc/study/src/schema.ts`
2. Runs `bun run db generate` to regenerate `drizzle/0000_initial.sql`
3. Drops + reseeds the local dev DB
4. Confirms `course/courses/weather-comprehensive/` re-seeds with zero diff

No deprecation window, no phased column drops, no parallel-shape period.

## Why `knowledge_node_id` becomes nullable in the CHECK only

The column itself was already nullable (the existing 2-level CHECK enforced "NULL on section rows, NOT NULL on step rows"). After this WP it's still nullable; the CHECK enforces "NULL on section / lesson rows, NOT NULL on step rows." No column-shape change; only the CHECK predicate evolves.

This avoids any Drizzle column-type churn. `text('knowledge_node_id').references(...)` stays exactly as today.

## Coordination with the parallel directive-parser PR

`feat/course-markdown-directives` (in-flight in a separate worktree) adds markdown directive parsing for course-step `body_md`. It touches:

- `libs/bc/study/src/course-markdown-directives.ts` (new)
- `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte` (directive consumer)

This WP touches `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.{server,svelte}` to add the non-leaf landing branch and the prev/next component.

Risk: file-level overlap on `[stepCode]/+page.svelte`. Mitigation: the directive PR ships first (it's smaller; mechanical add of a directive parser at the body render site). This WP's Phase D rebases against it. If the directive PR ships after Phase D, the rebase happens the other direction. Either way the change is mechanical (the directive consumer runs at the body-md render step; this WP's landing branch wraps the body-md render). No semantic collision.

## Coordination with the filename disambiguation PR

Already merged last week. The course YAML loader paths have not changed; this WP reads them exactly as today.

## Defensive guards

- `COURSE_TREE_MAX_DEPTH = 10` in `libs/constants/src/credentials.ts`. The seed validator enforces. Real pedagogy bottoms out at 4-5 levels at the deepest (a scenario WP with 4 substeps would be 3 levels; a degree-program syllabus with semester / unit / lesson / step would be 4). 10 is well clear of realistic authoring
- Every non-leaf must have at least one leaf descendant (caught at the post-walk pass in the seed validator). A subtree with no leaves contributes zero learning units and is almost certainly authoring intent gone wrong
- Code uniqueness within a course (already enforced). Two rows with the same code in different lessons would shadow each other in the URL
- `(course_id, parent_id, ordinal)` unique within each parent (new; replaces the implicit "ordinal unique per section" rule)

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md). Highlights: per-row visibility / role gating, drag-and-drop tree editing, multi-course lesson reuse, lesson-level cert binding (cert is leaf-only by design), collapse / expand UI on the outline (deferred until content scale demands it).
