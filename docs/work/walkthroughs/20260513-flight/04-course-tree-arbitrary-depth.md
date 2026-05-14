# Course Tree -- Arbitrary Depth

A structural refactor of the course model. Courses were fixed 2-level (section -> step); now they're N-level (section -> lesson -> lesson -> ... -> step) up to depth 10.

Status: shipped. Phases A/B/C/D/E in PRs #934, #935, #938, #943, #944. Plus #948 (the unblocked content PR: the six WX scenarios section in the weather-comprehensive course, which couldn't ship until Phase D landed).

Spec: [docs/work-packages/course-tree-arbitrary-depth/](../../../work-packages/course-tree-arbitrary-depth/).

## Why N-deep

From the spec's design walk: "teaching shouldn't be throttled by structure." Some pedagogy wants 3 levels (section -> lesson -> step). Some wants 4 (semester -> unit -> lesson -> step). Some wants more. Fixed 3-level (Option B in design.md) trades simplicity for inflexibility -- first time pedagogy needs 4 levels, the cycle repeats. Dropping the explicit `level` column (Option C, parent-only) loses the vocabulary that makes schema validation and rendering easy.

Chosen: arbitrary depth up to 10 (cap is defensive), explicit `level` vocabulary, zero migration cost (the new schema is a strict superset of the old).

Two semantic moves matter:

- **Leaf-only study selection.** Interior nodes (sections, lessons) don't carry knowledge nodes. They're framing units. A lesson with 4 substeps contributes 4 study items, not 1.
- **Aggregate cert overlay.** Cert binding stays leaf-only. Lessons get cert coverage by rolling up their leaves at render time, never by carrying their own bindings.

## The journey

### Author flow (YAML; no Hangar UI yet -- deferred)

Author writes section files under `course/courses/<slug>/sections/`. Recursive structure:

```yaml
# course/courses/weather-comprehensive/sections/s11-wx-scenarios.yaml
code: s11
ordinal: 11
title: Weather Scenarios
body_md: Six scripted scenarios...
steps:
  - code: s11.1
    ordinal: 1
    level: lesson
    title: 'Scenario 1 -- Cold Front'
    body_md: Intro framing for the scenario...
    steps:
      - code: s11.1.1
        ordinal: 1
        title: Intro step
        knowledge_node_id: wx-scenario-frontal-intro
      - code: s11.1.2
        ordinal: 2
        title: Charts step
        knowledge_node_id: wx-scenario-frontal-charts
```

Validation runs in [scripts/db/seed-courses.ts](../../../../scripts/db/seed-courses.ts):

1. Parse `manifest.yaml` + each `sections/*.yaml`.
2. Recursive YAML schema (`courseTreeNodeSchema` via `z.lazy()`) accepts arbitrary nesting.
3. Depth-first walk via [scripts/db/seed-courses-validator.ts](../../../../scripts/db/seed-courses-validator.ts) `validateCourseTree(...)` enforces:
   - Section: root (NULL parent, no node, not a leaf).
   - Lesson: interior (parent is section or lesson, no node, not a leaf, >= 1 child).
   - Step: leaf (parent is section or lesson, node required, `is_leaf=true`).
   - Code uniqueness per course, ordinal uniqueness per parent.
   - Max depth <= 10 (`COURSE_TREE_MAX_DEPTH`).
   - No cycles (visited-set check).
   - Every non-leaf has reachable leaf descendants.
4. Upsert idempotently via content-hash (unchanged YAML -> zero writes).

### Learner flow

#### Course landing -- /courses/[slug]

[apps/study/src/routes/(app)/courses/[slug]/+page.svelte](../../../../apps/study/src/routes/(app)/courses/%5Bslug%5D/+page.svelte) renders a static nested outline tree: section (h2) -> lesson (h3, indent) -> step (li with link). Each row carries mastery indicators and optional cert badges. Every leaf and non-leaf row is a clickable link.

#### Step reader -- /courses/[slug]/[stepCode]

Loader: [+page.server.ts](../../../../apps/study/src/routes/(app)/courses/%5Bslug%5D/%5BstepCode%5D/+page.server.ts). UI: [+page.svelte](../../../../apps/study/src/routes/(app)/courses/%5Bslug%5D/%5BstepCode%5D/+page.svelte). Sub-components: `Breadcrumbs.svelte`, `PrevNext.svelte` (both new in Phase D).

The loader chain:

- Fetch course + step (by code) + linked knowledge node + all rows for breadcrumb / prev-next.
- Call `courseLens` (or `courseWithCertOverlayLens`) to get tree + leaf list.
- Call `flattenLeavesDepthFirst(tree)` -> flat leaf list.
- Call `computePrevNext(current, rowById, leaves)` -> prev/next leaf neighbors.
- Build breadcrumbs via `buildBreadcrumbs(row, rowById)` (walks parent chain upward).
- For non-leaf rows: extract children + truncated body preview.

Two render branches in the page:

- **Leaf** (`is_leaf=true`): knowledge-node phases + framing (unchanged from pre-WP).
- **Non-leaf** (`is_leaf=false`): landing page with body framing + list of children (title, level badge, truncated body, link to child URL).

Navigation:

- Breadcrumbs: course -> section -> lesson chain -> current title (all links except current).
- Prev/next: walks the depth-first flattened leaf list. For a leaf, prev/next are adjacent leaves. For a non-leaf, "next" enters its first leaf descendant; "prev" is the leaf before that first descendant.

## Code map

| Concern                                 | Lives at                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema (3-arm consistency CHECK)        | [libs/bc/study/src/schema.ts](../../../../libs/bc/study/src/schema.ts) -- `study.course_step` table lines ~2430-2492                                                                                      |
| Constants                               | [libs/constants/src/credentials.ts](../../../../libs/constants/src/credentials.ts) -- `COURSE_STEP_LEVELS` (`section`, `lesson`, `step`), `COURSE_STEP_LEVEL_LABELS`, `COURSE_TREE_MAX_DEPTH = 10`        |
| Recursive YAML schemas                  | [libs/bc/study/src/course-yaml-schemas.ts](../../../../libs/bc/study/src/course-yaml-schemas.ts) -- `courseTreeNodeSchema` (discriminated union via `z.lazy()`), `courseLessonSchema`, `courseStepSchema` |
| Seed validator (depth-first walk)       | [scripts/db/seed-courses-validator.ts](../../../../scripts/db/seed-courses-validator.ts) -- `validateCourseTree`, `walkChildren`                                                                          |
| Seeder                                  | [scripts/db/seed-courses.ts](../../../../scripts/db/seed-courses.ts) -- upserts in tree-walk order                                                                                                        |
| Course lens (recursive tree + rollup)   | [libs/bc/study/src/lenses-course.ts](../../../../libs/bc/study/src/lenses-course.ts) -- `courseLens` returns `LensResult { tree, leaves, rollup }`; `buildSubtree` recursion                              |
| Tree-walk helpers (browser-safe, no DB) | [libs/bc/study/src/lens-tree-walk.ts](../../../../libs/bc/study/src/lens-tree-walk.ts) -- `flattenLeavesDepthFirst`, `computePrevNextLeaves`, `aggregateCertCoverage`                                     |
| Course landing                          | [apps/study/src/routes/(app)/courses/[slug]/+page.svelte](../../../../apps/study/src/routes/(app)/courses/%5Bslug%5D/+page.svelte) -- recursive `{#snippet treeNode(node, depth)}`                        |
| Step reader loader                      | [apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts](../../../../apps/study/src/routes/(app)/courses/%5Bslug%5D/%5BstepCode%5D/+page.server.ts)                                        |
| Step reader UI                          | [apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte](../../../../apps/study/src/routes/(app)/courses/%5Bslug%5D/%5BstepCode%5D/+page.svelte)                                              |
| Sub-components                          | `Breadcrumbs.svelte`, `PrevNext.svelte` in the same route directory                                                                                                                                       |
| Fixture course (test data)              | [course/courses/_fixtures/three-level-tree-fixture/](../../../../course/courses/_fixtures/) -- minimal 3-level shape (one section, one lesson, two leaves)                                                |

### The 3-arm CHECK on `course_step`

```sql
CHECK (
  ("level" = 'section' AND "parent_id" IS NULL     AND "knowledge_node_id" IS NULL     AND "is_leaf" = false)
  OR
  ("level" = 'lesson'  AND "parent_id" IS NOT NULL AND "knowledge_node_id" IS NULL     AND "is_leaf" = false)
  OR
  ("level" = 'step'    AND "parent_id" IS NOT NULL AND "knowledge_node_id" IS NOT NULL AND "is_leaf" = true)
)
```

The cross-row rule (a lesson/step's parent must be a section or lesson, not a step) is enforced by the seed validator, since SQL CHECK can't read other rows. The CHECK is enough to reject invalid single-row states.

## Key decisions

| Decision                                                                 | Why                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-deep (Option A) over fixed 3-level (B) or parent-only (C).             | Pedagogy varies; cap at 10 keeps the model unbounded but defensive. Vocabulary stays explicit. Zero migration cost.                                                                                                                                                             |
| Leaf-only study selection.                                               | Interior nodes don't carry `knowledge_node_id`. Sessions consume leaves; a 4-substep lesson contributes 4 items, not 1.                                                                                                                                                         |
| Cert binding stays leaf-only; aggregation is client-side at render time. | Avoids two sources of truth (lesson's own binding vs leaf rollup). `aggregateCertCoverage(tree, syllabusId)` walks the tree and decorates interior nodes.                                                                                                                       |
| The new schema is a strict superset of the old.                          | Every row shape that satisfied the old 2-arm CHECK satisfies the new 3-arm CHECK. The seed walk treats flat-section/flat-step YAML as the trivial case -- no `lesson` rows. Re-seeding produces byte-identical rows. No data migration script (which CLAUDE.md forbids anyway). |
| 10-level cap as defensive ceiling.                                       | Not expected to be hit. Cap prevents pathological trees from sneaking past the validator.                                                                                                                                                                                       |
| Recursive YAML schema via `z.lazy()`.                                    | Zod's standard recursion pattern. Discriminated union on `level` (defaults to `step` when omitted; lesson is explicit).                                                                                                                                                         |
| Depth-first prev/next nav over flattened leaf list.                      | "Click next on a lesson landing" jumps into its first leaf. Matches how a learner walks a textbook.                                                                                                                                                                             |

For the full decision trail and option analysis: [spec.md](../../../work-packages/course-tree-arbitrary-depth/spec.md) and `design.md`.

## Operator notes

### Seed

```bash
bun run db seed courses                        # all courses
bun run db seed courses weather-comprehensive  # one slug
bun run db seed courses --dry-run              # print, no writes
```

The seed validator runs synchronously before any DB writes. Failure modes (verbatim messages from the validator):

- `cycle in course 'slug' tree`
- `duplicate code 's11.2'`
- `step 's1.1.1' must carry knowledge_node_id`
- `course 'slug' exceeds max depth 10`
- `lesson 's1.1' has no children`

### Run

```bash
bun run dev study
```

Try:

- `/courses/weather-comprehensive` -- the existing 2-level course (proves backward compat).
- `/courses/three-level-tree-fixture` -- the 3-level fixture.
- `/courses/three-level-tree-fixture/s1.1` -- a lesson landing (non-leaf).
- `/courses/three-level-tree-fixture/s1.1.1` -- a leaf step. Click "Next" -> should go to `s1.1.2`.

### Inspect

```bash
# Postgres
psql ... -c "SELECT code, level, parent_id, is_leaf, ordinal FROM study.course_step WHERE course_id = '...' ORDER BY parent_id, ordinal;"

# Recursive walk via CTE
WITH RECURSIVE walk AS (
  SELECT id, code, level, parent_id, is_leaf, ordinal, 0 AS depth
  FROM study.course_step WHERE parent_id IS NULL AND course_id = '...'
  UNION ALL
  SELECT cs.id, cs.code, cs.level, cs.parent_id, cs.is_leaf, cs.ordinal, walk.depth + 1
  FROM study.course_step cs JOIN walk ON cs.parent_id = walk.id
)
SELECT depth, code, level, is_leaf FROM walk ORDER BY depth, ordinal;
```

### Test

```bash
bun test libs/bc/study/src/lens-tree-walk.test.ts
bun test libs/bc/study/src/lenses-course.test.ts
bun test scripts/db/seed-courses-validator.test.ts
bun run check
```

## Deferred / follow-ups

From [docs/work-packages/course-tree-arbitrary-depth/OUT-OF-SCOPE.md](../../../work-packages/course-tree-arbitrary-depth/OUT-OF-SCOPE.md):

| Item                              | Status    | Trigger                                                                  |
| --------------------------------- | --------- | ------------------------------------------------------------------------ |
| Per-row visibility / role gating  | Deferred  | When instructor-only sections needed (FIRC content).                     |
| Drag-and-drop tree reordering     | Deferred  | When the Hangar course-editor WP earns its own slot.                     |
| Multi-course lesson reuse         | Deferred  | When the same lesson is needed in 2+ courses (PPL + IFR scenario reuse). |
| Lesson-level cert overlay binding | Rejected  | Cert is leaf-only by design; aggregation is client-side.                 |
| Collapse / expand UI              | Deferred  | When a single course exceeds ~150 leaves.                                |
| Per-lesson weight override        | Deferred  | When the session engine generalizes to consume per-step weight.          |
| Lesson-as-prerequisite gating     | Deferred  | When hard sequencing constraints are needed (ordinal-only today).        |
| Hangar UI for lesson authoring    | Follow-on | When course-reader-and-editor WP ships the tree editor.                  |
| Tree depth > 10                   | Rejected  | Never expected; cap is defensive only.                                   |

## Related docs

- [docs/work-packages/course-tree-arbitrary-depth/](../../../work-packages/course-tree-arbitrary-depth/) -- spec, design, tasks, test-plan, OUT-OF-SCOPE
- [docs/work-packages/course-reader-and-editor/](../../../work-packages/course-reader-and-editor/) -- the dual UI on top of course primitive
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../../decisions/016-cert-syllabus-goal-model/decision.md) -- where the cert overlay principle is rooted

## Read next

[05 -- wx-engine](05-wx-engine.md). The six WX scenarios that ship as a section of the weather-comprehensive course (PR #948) couldn't ship until Phase D of this WP. The engine is the most architecturally novel piece in the codebase; you wrote it, you'll enjoy re-reading it.
