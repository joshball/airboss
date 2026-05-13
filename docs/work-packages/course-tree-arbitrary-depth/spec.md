---
id: course-tree-arbitrary-depth
title: 'Spec: Course Tree -- Arbitrary Depth'
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
  - lens
  - schema
  - structure
  - n-deep
  - infrastructure
legacy_fields:
  feature: course-tree-arbitrary-depth
  type: spec
---

# Spec: Course Tree -- Arbitrary Depth

Generalize the course-primitive tree from a hard-locked 2 levels (section + step) to arbitrary depth so pedagogy is no longer throttled by structure. After this WP a course author can nest `section -> lesson -> step` (3 levels) or `section -> lesson -> sub-lesson -> step` (4 levels) and beyond, with the renderer, lens, seed validator, and DB CHECK all generalising recursively.

## Why this WP exists

Joshua's directive: "teaching shouldn't be throttled by structure. We don't conform to the LMS, the LMS conforms to US."

A parallel content PR -- `feat/wx-scenarios-course-section` -- attempted to author 6 weather-scenario lessons under a new section, each lesson a 4-substep walk (intro / reading-the-charts / analysis / instructor-internals). The YAML codes were `s11.1.1`-style (3-deep). The codes parsed; the platform refused. Every layer below the YAML schema is hard-coded to exactly 2 levels:

| Layer                   | File                                                                            | What's hard-coded                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB CHECK                | `libs/bc/study/src/schema.ts` (`course_step_consistency_check`)                 | `(level='section' AND parent_id IS NULL AND knowledge_node_id IS NULL AND is_leaf=false) OR (level='step' AND parent_id IS NOT NULL AND knowledge_node_id IS NOT NULL AND is_leaf=true)` |
| Level enum              | `libs/constants/src/credentials.ts` (`COURSE_STEP_LEVELS`)                      | Only `section` and `step` exist as values                                                                                                                                                |
| YAML schemas            | `libs/bc/study/src/course-yaml-schemas.ts`                                      | `courseSectionSchema.steps` is flat; `courseStepSchema` has no `steps[]`; both `.strict()`                                                                                               |
| Seed validator          | `scripts/db/seed-courses.ts` (line ~467)                                        | Cycle check assumes 2 levels -- comment "the two-level tree shape guarantees no cycles"; section / step partition is hard-coded                                                          |
| Lens                    | `libs/bc/study/src/lenses-course.ts`                                            | `courseLens` partitions rows into `sectionRows` (parent NULL) + `stepsBySection` (one level under), emits `course -> section -> step` flat                                               |
| Course-landing renderer | `apps/study/src/routes/(app)/courses/[slug]/+page.svelte`                       | Hard-coded `course.sections[].steps[]` 2-level outline                                                                                                                                   |
| Step reader             | `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts` line 89 | `if (step.level !== COURSE_STEP_LEVELS.STEP) throw error(404)` -- any non-leaf row is 404                                                                                                |
| Prev/next navigation    | `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte`            | None today                                                                                                                                                                               |

Fixing one layer without the others is half a fix. This WP plans the full coordinated change so that authoring 3-level content unblocks immediately and the schema is extensible to any future depth without another structural round.

## Scope

### In

- One new level value (`lesson`) added to `COURSE_STEP_LEVELS` in `libs/constants/src/credentials.ts`
- `study.course_step.knowledge_node_id` becomes nullable (it already is at the column level; the CHECK constraint changes to allow non-leaf rows without a node)
- `course_step_consistency_check` rewritten to permit arbitrary depth: `section` is the root level (NULL parent, no node, not a leaf); `lesson` is a non-leaf interior (parent points at section or lesson, no node, not a leaf); `step` is a leaf (parent points at section or lesson, node required, is a leaf)
- `course-yaml-schemas.ts` rewritten recursively: a section / lesson holds `steps: Array<step | lesson>`. Zod recursion via `z.lazy()`. Strict mode preserved
- Seed validator (`scripts/db/seed-courses.ts`) generalised: depth-first walk of the YAML tree; iterative `parent_id` resolution; cycle check via visited-set walk; level / leaf / `knowledge_node_id` consistency enforced at every depth
- Course lens (`libs/bc/study/src/lenses-course.ts`) rewritten to emit a recursively-nested `LensTreeNode[]` -- each non-leaf carries `children: LensTreeNode[]` and `leaves: LensLeaf[]`. Mastery rollups aggregate up the tree
- New helper `flattenLeavesDepthFirst(tree: LensTreeNode[]): LensLeaf[]` in the same file, used by prev/next nav and overlay leaf-coverage rollup
- Course-landing renderer (`apps/study/src/routes/(app)/courses/[slug]/+page.svelte`) walks the nested tree and renders an outline that visually distinguishes section / lesson / step levels. Static for v1 (no collapse/expand state); deferred to a follow-up if needed
- Step reader (`apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.{server,svelte}`) accepts rows of any level. Non-leaf rows render a landing page composed of: the row's `body_md`, then a list of children with title + truncated body. Leaf rows render as today (knowledge-node + framing)
- Prev/next navigation added to the step reader. Computes by flattening the course's leaves depth-first and finding the current row's neighbours. For a non-leaf row, "prev" is the previous sibling's last-leaf descendant; "next" is the first leaf descendant of this row, falling back to the next sibling's first leaf
- Existing 10 sections + their steps under `course/courses/weather-comprehensive/` migrate cleanly: the new schema is a strict superset of the old (a 2-level tree is the trivial case of an N-level tree with no `lesson` rows). Re-seed runs zero-write on unchanged YAML
- Wired into `bun run check`: `bun run db seed courses --dry-run` continues to gate the seed validator; no new check step needed
- The `course_step.code` column already permits dotted multi-level codes (`s11.1.3`, `s11.1.3.2`); no shape change. The seed handler keeps `(course_id, code)` unique

### Out

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Anchor docs

- [docs/work-packages/course-primitive/spec.md](../course-primitive/spec.md) -- the 2-level primitive this WP generalises
- [docs/work-packages/course-primitive/design.md](../course-primitive/design.md) -- per-layer contracts being extended
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) -- the Course-as-peer-primitive refinement
- [docs/decisions/025-wp-frontmatter-contract/decision.md](../../decisions/025-wp-frontmatter-contract/decision.md) -- WP frontmatter contract
- [libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts) (lines 2430-2483) -- existing `course_step` table + CHECK
- [libs/bc/study/src/course-yaml-schemas.ts](../../../libs/bc/study/src/course-yaml-schemas.ts) -- existing YAML schemas
- [libs/bc/study/src/lenses-course.ts](../../../libs/bc/study/src/lenses-course.ts) -- existing lens
- [scripts/db/seed-courses.ts](../../../scripts/db/seed-courses.ts) -- existing seed validator
- [course/courses/weather-comprehensive/](../../../course/courses/weather-comprehensive/) -- the existing 10-section course that must re-seed unchanged

## Architecture overview

```text
Today (2 levels):

  course
    section (level='section', parent NULL, no node, not leaf)
      step (level='step', parent=section.id, node required, leaf)

After (N levels, Option A):

  course
    section (level='section', parent NULL, no node, not leaf)
      step (level='step', parent IN {section, lesson}, node required, leaf)
      lesson (level='lesson', parent IN {section, lesson}, no node, not leaf)
        step
        lesson
          step
          lesson
            ...

Rules:
  - section is always the root level (NULL parent, no node, not leaf)
  - lesson is always an interior (parent NOT NULL, no node, not leaf, has >= 1 child)
  - step is always a leaf (parent NOT NULL, node required, is_leaf=true, no children)
  - parent of a lesson or step is either a section or a lesson
  - depth is unbounded at the schema layer; the seed validator caps at MAX_TREE_DEPTH=10
    (defensive guard against runaway authoring; raise if real pedagogy needs it)
```

A 2-level tree (today's content) is the trivial case of the N-level rule: no `lesson` rows, every step parents directly to a section. The seed validator + lens + renderer all handle this case as a special-case-free instance of the general algorithm.

## Behavior

### Authoring (course YAML)

A course author writes the section files as today and additionally nests `lesson` blocks where the pedagogy wants them. A `lesson` block is recognised by carrying a `level: lesson` field; absent the field, the entry is a `step` (preserves the existing 2-level YAML shape verbatim).

`sections/s11-wx-scenarios.yaml`:

```yaml
code: s11
title: Weather Scenarios -- Decision Reps
ordinal: 11
body_md: |
  Six scripted scenarios drawn from the truth-aware weather engine. Each
  lesson walks four substeps: intro framing, reading the charts,
  pattern analysis, instructor internals.
steps:
  - code: s11.1
    ordinal: 1
    level: lesson
    title: 'Scenario 1 -- Cold front passage, Midwest XC'
    body_md: |
      A KSTL -> KORD XC the morning of a sharp cold-front passage.
      The warm sector is benign and the post-frontal side is wind, vis,
      lake-effect risk. Your reroute decision is the substance of the lesson.
    steps:
      - code: s11.1.1
        ordinal: 1
        title: Intro -- the route + the truth
        body_md: ...
        knowledge_node_id: wx-scenario-frontal-xc-intro
      - code: s11.1.2
        ordinal: 2
        title: Reading the charts
        body_md: ...
        knowledge_node_id: wx-scenario-frontal-xc-charts
      - code: s11.1.3
        ordinal: 3
        title: Pattern analysis
        body_md: ...
        knowledge_node_id: wx-scenario-frontal-xc-analysis
      - code: s11.1.4
        ordinal: 4
        title: Instructor internals
        body_md: ...
        knowledge_node_id: wx-scenario-frontal-xc-internals
  - code: s11.2
    ordinal: 2
    level: lesson
    title: 'Scenario 2 -- Summer pop-up convection, Texas'
    body_md: ...
    steps:
      # ... four substeps
```

The YAML schemas accept arbitrary nesting depth. A `lesson` whose only children are `step`s is the common shape. A `lesson` may also contain a nested `lesson` (sub-lesson) when the pedagogy warrants it.

### Seed pipeline

1. Parse `manifest.yaml` (unchanged)
2. Parse each `sections/*.yaml` -- new recursive schema accepts any depth
3. Walk every section depth-first; for each node:
   - Compute `is_leaf` from whether the node carries a `steps[]` array OR a `knowledge_node_id` (a leaf carries a node and no children; a non-leaf carries children and no node)
   - Resolve `parent_id` from the walk stack
   - Resolve `level`: explicit `level: lesson` (interior, parent IN {section, lesson}); otherwise `level: section` for root nodes, `level: step` for leaves
4. Run cross-row consistency:
   - Every code unique within the course
   - Every ordinal unique within `(course_id, parent_id)`
   - Every leaf carries a non-empty `knowledge_node_id` that FK-resolves
   - Every non-leaf has at least one child
   - No node has a `knowledge_node_id` AND children (would be both interior and leaf)
   - Walk depth-first; visited-set cycle check (defensive against author-authored parent cycles even though the YAML walk is intrinsically a tree)
   - Max depth <= `MAX_TREE_DEPTH` (10; rejects pathological authoring without limiting realistic pedagogy)
5. Upsert rows in the order: sections first, then per-section depth-first descent (lessons before their children, steps last); content-hash idempotent

### Lens

```typescript
// libs/bc/study/src/lenses-course.ts (rewritten)

export const courseLens: Lens<CourseLensFilters> = async (db, userId, input) => {
  // ... goal resolution unchanged ...
  const steps = await getCourseStepsByCourse(courseId, db);
  // Group rows by parent_id once.
  const childrenByParent = new Map<string | null, CourseStepRow[]>();
  for (const row of steps) {
    const key = row.parentId;
    const list = childrenByParent.get(key) ?? [];
    list.push(row);
    childrenByParent.set(key, list);
  }
  // Sort children of every parent by ordinal.
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.ordinal - b.ordinal);
  }

  // Recursive tree builder. Walk every section (children of NULL parent),
  // recurse into lessons + steps. Leaves carry mastery; interiors carry a
  // computed rollup.
  function buildSubtree(row: CourseStepRow): LensTreeNode | LensLeaf {
    if (row.isLeaf) {
      // step (leaf) -- knowledgeNodeId is non-null per the CHECK
      const evidence = evidenceByNode.get(row.knowledgeNodeId ?? '');
      const mastery = computeStepLeafMastery(evidence);
      return { id: row.id, knowledgeNodeId: row.knowledgeNodeId!, title: row.title, requiredBloom: null, mastery };
    }
    // section or lesson (interior)
    const kids = childrenByParent.get(row.id) ?? [];
    const childNodes: LensTreeNode[] = [];
    const leafNodes: LensLeaf[] = [];
    const rollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];
    for (const kid of kids) {
      const built = buildSubtree(kid);
      if ('children' in built) {
        childNodes.push(built);
        rollupBuckets.push(...built.rollup.buckets);  // aggregate via rollup helper
      } else {
        leafNodes.push(built);
        rollupBuckets.push({ mastery: built.mastery, weight: goalWeight });
      }
    }
    return {
      id: row.id,
      level: row.level === 'section' ? 'section' : 'lesson',
      title: row.title,
      rollup: computeMasteryRollup(rollupBuckets),
      children: childNodes,
      leaves: leafNodes,
    };
  }

  const sectionRows = childrenByParent.get(null) ?? [];
  const sectionTreeNodes = sectionRows.map((s) => buildSubtree(s) as LensTreeNode);
  // ... course-root LensTreeNode wraps sectionTreeNodes ...
};

/** Depth-first flatten of every leaf in the tree, document order. */
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

The function shape (sketch above) is normative; the design doc carries the final algorithm.

`LensTreeNode.level` enum extended to include `'lesson'` (additive). `courseWithCertOverlayLens` follows the same recursive pattern and continues to populate `LensLeaf.sources` on the leaves only.

### Renderer

#### Course landing (`/courses/[slug]`)

Walks the nested tree. Each non-leaf is a heading + body preview. Each leaf is a clickable link. Indent depth reflects level. Sections are rendered as h2; lessons as h3 (or h4 at deeper nesting); leaves as li with the step title. Static for v1 (no JS-driven collapse / expand). If the outline length exceeds a render budget at a future content scale, a collapse/expand pass is a follow-up.

#### Step reader (`/courses/[slug]/[stepCode]`)

Today: 404s on any non-leaf row. After this WP:

- **Leaf row** (step, `is_leaf=true`): renders the knowledge-node phases + framing exactly as today
- **Non-leaf row** (section or lesson): renders a landing page composed of the row's `body_md` (intro framing for the section / lesson) + a list of children. Each child entry: title, level badge (section / lesson / step), `body_md` truncated to ~200 chars, link to the child's `[stepCode]` URL
- Breadcrumb at the top of every page: course title -> section -> lesson chain -> current row's title

The renderer reads the lens output and the row's own data; it does not re-fetch the children separately.

### Prev/next navigation

A new component (`apps/study/src/routes/(app)/courses/[slug]/[stepCode]/PrevNext.svelte`) renders at the bottom of every step page. The page loader computes prev / next from the flattened leaf list:

- Flatten every leaf in the course tree depth-first (via `flattenLeavesDepthFirst`)
- Find the current row's index in the leaf list. For a leaf row, this is a direct index. For a non-leaf row, the "current" leaf is the first leaf descendant
- `prev` = leaf at index - 1 (or null at the start of the course)
- `next` = leaf at index + 1 (or null at the end of the course)

The "first leaf descendant of a non-leaf" semantic gives the natural reading flow: clicking "next" on a lesson landing takes you into the lesson's first substep; clicking "prev" on a lesson landing takes you to the last leaf of the previous sibling.

The prev / next links carry the leaf's title + section / lesson context ("Next: <Section title> / <Lesson title> / <Step title>") so the learner can see where they're going.

### Cert overlay aggregation

`courseWithCertOverlayLens` continues to populate `LensLeaf.sources` on the leaves. Lessons + sections do not carry a cert binding directly; the cert overlay UI aggregates leaf coverage up the tree (a lesson is "n / m steps covered by cert" computed by walking the lesson's leaves). The aggregation lives in the renderer; the lens only ships the per-leaf flags.

### Study-plan / session selection

Today the session engine pulls from `goal_course -> course_step (level='step') -> knowledge_node_id`. After this WP the join becomes `goal_course -> course_step (is_leaf=true) -> knowledge_node_id`. The `is_leaf` predicate is the canonical "is this a study-able row" filter; `level='step'` is a subset of that and the new query expresses the intent more clearly. No double-counting: every node is reachable exactly once through the course tree because each course step has at most one `knowledge_node_id`.

## Data model

### Schema delta on `study.course_step`

| Field               | Before                                            | After                                                                                  |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `level`             | CHECK in `('section', 'step')`                    | CHECK in `('section', 'lesson', 'step')`                                               |
| `knowledge_node_id` | Nullable column; CHECK requires non-NULL on steps | Nullable column unchanged; new CHECK requires non-NULL on leaves (`is_leaf=true`) only |
| Consistency CHECK   | 2-arm CHECK on section / step                     | 3-arm CHECK on section / lesson / step (full predicate in design.md)                   |

Per CLAUDE.md "There are no Drizzle migrations": the schema change lands by editing `libs/bc/study/src/schema.ts`, regenerating `drizzle/0000_initial.sql`, and reseeding from YAML. One step, no phases.

### Constants delta on `libs/constants/src/credentials.ts`

```typescript
export const COURSE_STEP_LEVELS = {
  SECTION: 'section',
  LESSON: 'lesson',  // NEW
  STEP: 'step',
} as const;

export const COURSE_STEP_LEVEL_LABELS: Record<CourseStepLevel, string> = {
  [COURSE_STEP_LEVELS.SECTION]: 'Section',
  [COURSE_STEP_LEVELS.LESSON]: 'Lesson',  // NEW
  [COURSE_STEP_LEVELS.STEP]: 'Step',
};

/** Defensive guard against runaway authoring depth. */
export const COURSE_TREE_MAX_DEPTH = 10;
```

### YAML schema delta on `libs/bc/study/src/course-yaml-schemas.ts`

```typescript
// Recursive union: a tree node is either a step (leaf) or a lesson (interior).
// Sections at the top level are typed by `courseSectionSchema`; lessons +
// steps below them share `courseTreeNodeSchema`.

export const courseTreeNodeSchema: z.ZodType<CourseTreeNode> = z.lazy(() =>
  z.discriminatedUnion('level', [
    courseStepSchema,    // level: 'step' (default when omitted) -- leaf
    courseLessonSchema,  // level: 'lesson' -- interior
  ]),
);

export const courseLessonSchema = z
  .object({
    code: z.string().min(1),
    ordinal: z.number().int().nonnegative(),
    level: z.literal('lesson'),
    title: z.string().min(1),
    body_md: z.string().optional().default(''),
    steps: z.array(courseTreeNodeSchema).min(1),
  })
  .strict();
```

The `level: step` case is the default when the field is omitted in YAML so existing content authored without the field continues to parse without edits. The seed handler's friendlier rejections cover the `step-must-carry-knowledge_node_id` and `non-leaf-must-not-carry-knowledge_node_id` cases at every depth.

## Validation

| Field / rule                    | Rule                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `course_step.level`             | One of `COURSE_STEP_LEVEL_VALUES` (`section`, `lesson`, `step`)                                    |
| `course_step.parent_id`         | NULL iff `level='section'`; NOT NULL iff `level IN ('lesson', 'step')`                             |
| `course_step.knowledge_node_id` | NOT NULL iff `is_leaf=true`; NULL iff `is_leaf=false`                                              |
| `course_step.is_leaf`           | true iff `level='step'`; false iff `level IN ('section', 'lesson')`                                |
| Parent-level rule               | A `lesson` or `step` parents to a `section` or `lesson` (CHECK can't enforce; seed validator does) |
| Tree depth                      | <= `COURSE_TREE_MAX_DEPTH` (10) measured from section root to deepest leaf                         |
| Cycle check                     | Visited-set walk; reject any back-edge                                                             |
| Non-leaf without children       | Reject; `lesson` / `section` rows must have >= 1 child                                             |
| Code uniqueness                 | `(course_id, code)` unique (unchanged from course-primitive WP)                                    |
| Ordinal uniqueness              | `(course_id, parent_id, ordinal)` unique within each parent                                        |

## Edge cases

- **Lesson with zero children**: rejected by the seed validator. A lesson with no children would be indistinguishable from a step at the schema layer but would lack a node binding -- an unrenderable shape. The author either promotes the body content into the parent section's `body_md` or adds at least one child step
- **Step nested directly under a lesson without an intermediate section**: legal. The schema permits any `lesson` or `section` as the parent of a step. The seed validator confirms the parent exists and is non-leaf
- **A lesson whose children are all other lessons (no leaves below)**: rejected. Every interior must have at least one reachable leaf descendant (otherwise the subtree contributes zero learning units to the course). Caught by post-walk validation: for every non-leaf, `flattenLeavesDepthFirst(subtree).length > 0`
- **Existing weather-comprehensive course (10 sections, ~50 steps)**: re-seeds unchanged. The new schema accepts the existing flat-section / flat-step shape as the trivial N-level case. Round-trip: dump rows, re-seed, hash-compare row set
- **Knowledge-node binding on a lesson row**: seed validator rejects with `lesson '<code>' must not carry knowledge_node_id`. Mirrors the existing `section '<code>' must not carry knowledge_node_id` rejection
- **Code prefix mismatch (lesson `s11.2` whose child is coded `s11.3.1`)**: not enforced. The code field is free-form authoring sugar; the seed handler uses `parent_id`, not the dotted prefix. Authors are encouraged to keep prefixes consistent for readability but the seed does not require it
- **Renderer crashes on a brand-new depth (5+)**: defensive cap at `COURSE_TREE_MAX_DEPTH=10`. Beyond 10 levels the seed validator rejects; the renderer never sees deeper trees
- **Prev/next at the start of the course on a leaf**: prev is null; the component renders only the next link. Symmetric at the end of the course
- **Prev/next on a non-leaf row (section / lesson landing)**: the lens supplies the row's `firstLeafDescendant` and `lastLeafDescendant` ids; the renderer uses these as the "current position" for the prev/next computation. Clicking "next" on a section landing enters its first leaf; clicking "prev" goes to the last leaf of the previous section
- **Two siblings carry the same code prefix but differ in level**: legal (`s11.1` is a lesson, `s11.2` is a step). Seed validator enforces uniqueness of full `code` only
- **Author renames a step from a leaf to a lesson (adds children)**: requires also updating the `level` field, removing `knowledge_node_id`, adding `steps`. Round-trip-seed surfaces every consistency violation
- **Cert overlay on a course with lessons**: every leaf still carries `LensLeafSources` as today. The renderer aggregates by walking up. No new lens output field is required
- **Study-plan session selection picks up only leaves**: the canonical filter is `is_leaf=true` (replaces the old `level='step'` filter -- equivalent for content that has no lessons; correctly excludes lesson landings for content that does)

## Acceptance

V1 ships when:

- `bun run check all` passes 0 errors, 0 warnings on every Phase PR
- `drizzle/0000_initial.sql` regenerates from the new `schema.ts` and the local DB reseeds cleanly via `bun run db reseed`
- `course/courses/weather-comprehensive/` re-seeds with zero diff: the `course_step` row set after the migration is byte-identical to the row set before (proves Option A is backwards-compatible)
- A new 3-level fixture (`course/courses/_fixtures/3-level-tree.yaml` or equivalent) parses, seeds, and renders end-to-end through the course landing + step reader
- The unblocked content PR (`feat/wx-scenarios-course-section`) re-runs the seed cleanly and renders 6 lessons * 4 substeps without changes to its YAML
- Prev/next traverses leaves depth-first as specified; verified by Playwright e2e against the 3-level fixture
- Cert overlay aggregation rolls leaf coverage up the lesson + section breadcrumb correctly; verified by unit test against a fixture
- Study-plan session selection ignores lesson + section rows; verified by unit test
- All six WP files (`spec.md`, `tasks.md`, `test-plan.md`, `design.md`, `user-stories.md`, `OUT-OF-SCOPE.md`) carry `agent_review_status: done` after Phase E ships and a clean `/ball-review-full` pass
