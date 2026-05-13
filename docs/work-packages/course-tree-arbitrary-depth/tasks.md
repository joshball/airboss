---
id: course-tree-arbitrary-depth
title: 'Tasks: Course Tree -- Arbitrary Depth'
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
  - tasks
legacy_fields:
  feature: course-tree-arbitrary-depth
  type: tasks
---

# Tasks: Course Tree -- Arbitrary Depth

Phased deliverables. Each phase is one PR; ships independently; passes `bun run check all` clean. Phases A and B are sequential (B reads the new schema). Phases C and D can ship in either order after B. Phase E is optional and only fires if Phase D surfaces an aggregation gap.

## Phase A -- Schema + constants + YAML schema

PR: `feat(course-tree): N-deep schema + constants + recursive YAML`

| Task                                                                                                                                      | File                                                 | Notes                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Add `LESSON` to `COURSE_STEP_LEVELS` + value array + label                                                                                | `libs/constants/src/credentials.ts`                  | Mirror the existing SECTION / STEP pattern. Add `COURSE_TREE_MAX_DEPTH = 10`                                                                 |
| Rewrite `course_step_consistency_check` to a 3-arm SQL CHECK                                                                              | `libs/bc/study/src/schema.ts` (line ~2475)           | Predicate in [design.md](./design.md). Cover section, lesson, step                                                                           |
| Regenerate `drizzle/0000_initial.sql`                                                                                                     | `drizzle/0000_initial.sql`                           | `bun run db generate`                                                                                                                        |
| Reseed local DB                                                                                                                           | n/a                                                  | `bun run db reseed`; confirm existing weather-comprehensive course re-seeds clean                                                            |
| Rewrite `course-yaml-schemas.ts` for recursion                                                                                            | `libs/bc/study/src/course-yaml-schemas.ts`           | Add `courseLessonSchema`, recursive `courseTreeNodeSchema` via `z.lazy()`. `courseSectionSchema.steps` becomes `Array<courseTreeNodeSchema>` |
| Add fixture `course/courses/_fixtures/three-level-tree-fixture/`                                                                          | `course/courses/_fixtures/three-level-tree-fixture/` | Minimal 3-level shape: one section, one lesson, two leaves. Used in unit + e2e tests                                                         |
| Unit tests for YAML schema: accept 3-level; reject lesson without children; reject step with children; reject unknown keys at every depth | `libs/bc/study/src/course-yaml-schemas.test.ts`      | New file. Vitest                                                                                                                             |
| Unit test for DB schema: insert legal section / lesson / step rows; reject illegal shapes via raw SQL inserts                             | `libs/bc/study/src/schema.test.ts` or new file       | Confirms the 3-arm CHECK fires correctly                                                                                                     |

Acceptance: `bun run check all` clean; `bun run db reseed` clean against existing weather-comprehensive course (zero diff in `course_step` rows); fixture 3-level YAML parses cleanly.

## Phase B -- Seed validator generalisation

PR: `feat(course-tree): generalize seed validator to N-deep walk`

| Task                                                                                                        | File                                     | Notes                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replace the 2-level partition in `validateCourseTree` with a depth-first walk                               | `scripts/db/seed-courses.ts` (line ~440) | Walk every section; recurse into lessons; collect leaves                                                                                                                                |
| Generalise `parent_id` resolution to an iterative stack walk                                                | `scripts/db/seed-courses.ts`             | Stack of `(parent_id, depth)` while descending                                                                                                                                          |
| Rewrite cycle check using visited-set walk (defensive even though YAML walk is intrinsically tree)          | `scripts/db/seed-courses.ts` (line ~467) | Replace "the two-level tree shape guarantees no cycles" comment                                                                                                                         |
| Add level / leaf / node-id consistency enforcement at every depth                                           | `scripts/db/seed-courses.ts`             | `lesson '<code>' must not carry knowledge_node_id`; `step '<code>' must carry knowledge_node_id`; `lesson '<code>' must have at least one child`; `step '<code>' must not have steps[]` |
| Add max-depth check (<= `COURSE_TREE_MAX_DEPTH`)                                                            | `scripts/db/seed-courses.ts`             | `course '<slug>' exceeds max tree depth of 10`                                                                                                                                          |
| Add "every non-leaf must have reachable leaf descendants" post-walk check                                   | `scripts/db/seed-courses.ts`             | Per spec edge cases; cheap traversal                                                                                                                                                    |
| Generalise upsert order: sections first, then per-section depth-first descent (lessons before child leaves) | `scripts/db/seed-courses.ts`             | FK is parent-first; existing pattern already does this for 2 levels                                                                                                                     |
| Re-seed the existing weather-comprehensive course end-to-end                                                | n/a                                      | Zero-diff confirmation                                                                                                                                                                  |
| Re-seed the 3-level fixture                                                                                 | n/a                                      | Confirms full pipeline                                                                                                                                                                  |
| Unit tests for the seed validator at every rejection                                                        | `scripts/db/seed-courses.test.ts`        | Mirror the existing `CourseSeedError` table; one test per row                                                                                                                           |

Acceptance: `bun run check all` clean; both the existing course and the new fixture re-seed clean; every rejection message matches the spec verbatim.

## Phase C -- Lens + recursive tree builder

PR: `feat(course-tree): recursive lens + flattenLeavesDepthFirst helper`

| Task                                                                             | File                                 | Notes                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Rewrite `courseLens` to build a nested tree via `buildSubtree` recursion         | `libs/bc/study/src/lenses-course.ts` | Sketch in spec.md "Lens" section. Group children by parent_id once; recurse |
| Rewrite `courseWithCertOverlayLens` to populate `LensLeafSources` only on leaves | `libs/bc/study/src/lenses-course.ts` | Cert binding is leaf-only; aggregation lives in the renderer                |
| Add `flattenLeavesDepthFirst(tree: LensTreeNode[]): LensLeaf[]` exported helper  | `libs/bc/study/src/lenses-course.ts` | Used by prev/next + overlay aggregation                                     |
| Extend `LensTreeNode.level` enum to include `'lesson'`                           | `libs/bc/study/src/lenses.ts`        | Additive; existing acsLens / domainLens unaffected                          |
| Rewrite `lenses.test.ts` cases for `courseLens` 3-level fixture                  | `libs/bc/study/src/lenses.test.ts`   | Two cases: 2-level (regression) + 3-level (new); assert exact tree shape    |
| Update `getCourseGaps` if it walks the tree directly                             | `libs/bc/study/src/courses.ts`       | Confirm it uses the leaf list, not the tree partition                       |

Acceptance: `bun run check all` clean; lens tests cover both shapes; the existing weather-comprehensive course's lens output is byte-identical to today (regression baseline).

## Phase D -- Renderer + prev/next navigation

PR: `feat(course-tree): renderer accepts N-deep + prev/next nav`

| Task                                                                         | File                                                                             | Notes                                                                                                              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Rewrite course landing to walk nested tree                                   | `apps/study/src/routes/(app)/courses/[slug]/+page.svelte`                        | Recursive component or inline recursion; section as h2, lesson as h3+, step as li                                  |
| Update load function to ship the nested tree from the lens                   | `apps/study/src/routes/(app)/courses/[slug]/+page.server.ts`                     | Drop the 2-level partition; pass tree through                                                                      |
| Step reader: accept non-leaf rows                                            | `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts` line 89  | Replace `step.level !== STEP` 404 with branch: leaf renders today; non-leaf renders landing                        |
| Step reader landing UI for non-leaf rows                                     | `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte`             | Compose: `body_md` + list of children (title, level badge, truncated body, link)                                   |
| Breadcrumb component                                                         | `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/Breadcrumbs.svelte` (new) | Course title -> section -> lesson chain -> current row                                                             |
| Prev/next component                                                          | `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/PrevNext.svelte` (new)    | Renders at page bottom; uses leaf list                                                                             |
| Load-function prev/next computation                                          | `[stepCode]/+page.server.ts`                                                     | Call `flattenLeavesDepthFirst(tree)`; find current row's first-leaf-descendant; ship prev / next leaf ids + titles |
| Playwright e2e: click through the 3-level fixture end-to-end                 | `tests/e2e/course-tree-n-deep.spec.ts` (new)                                     | Navigate course -> section -> lesson -> step; verify prev/next walks every leaf                                    |
| Playwright e2e: weather-comprehensive regression (clicks identical to today) | extension of existing course e2e                                                 | Confirms no regression for 2-level content                                                                         |

Acceptance: `bun run check all` clean; both fixtures click through cleanly in Playwright; the unblocked content PR's lessons render end-to-end without YAML changes.

## Phase E -- Cert overlay aggregation + study-plan integration (only if needed)

PR: `feat(course-tree): aggregate cert overlay up the lesson tree`

Only ships if Phase D's leaf-only overlay surfaces a UX gap. Likely shape:

| Task                                                                                  | File                                                      | Notes                                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| Add `aggregateCertCoverage(tree, syllabusId)` helper                                  | `libs/bc/study/src/lenses-course.ts`                      | Walks the tree, sums leaf coverage per non-leaf     |
| Surface per-lesson / per-section cert coverage in the renderer                        | `apps/study/src/routes/(app)/courses/[slug]/+page.svelte` | "Lesson covers 3 / 4 of PPL ACS leaves"             |
| Update study-plan / session selection to use `is_leaf=true` instead of `level='step'` | `libs/bc/study/src/courses.ts` + call sites               | Equivalent for 2-level content; correct for N-level |
| Unit tests                                                                            | `libs/bc/study/src/lenses.test.ts`                        | Coverage against the 3-level fixture                |

Acceptance: `bun run check all` clean; aggregated coverage matches the per-leaf rollup at every level.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md). Highlights: per-row visibility / role-gating, drag-and-drop reordering, multi-course lesson reuse, lesson-level cert binding (cert is leaf-only by design).

## Cross-WP coordination

| WP                            | Relationship                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `wx-scenarios-course-section` | Blocked by this WP. After Phase D ships the YAML re-runs the seed clean and the lessons render                  |
| `course-markdown-directives`  | Independent at the file level. The directive parser ships in parallel; no overlap with the tree-shape change    |
| Filename disambiguation PR    | Already merged (last week). Independent                                                                         |
| `course-primitive`            | This WP supersedes the 2-level-tree assumption. Update the parent WP's spec / design notes to reference this WP |
