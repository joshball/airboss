---
feature: course-reader-and-editor
category: schema
date: 2026-05-17
branch: main
issues_found: 0
critical: 0
major: 0
minor: 0
nit: 0
review_status: done
status: unread
---

## Summary

The `course-reader-and-editor` (CRE) feature is **schema-neutral**: it added no
tables, columns, indexes, constraints, or enums, and changed none of the
existing course-primitive schema. All nine phases (PRs #767-776) were verified
against `git log` -- `libs/bc/study/src/schema.ts` was not touched by any CRE
commit. The feature is a read/UI layer over the pre-existing course-primitive
schema (`course`, `course_step`, `goal_course`), and the writes it does perform
go through the existing `goal_course` junction table and the existing course
seed pipeline. The spec's contract claim is accurate. No schema issues found.

## Verification performed

### CRE touched no schema file

`libs/bc/study/src/schema.ts` was last modified by commit `36dddb23` (PR #974,
`plan_item` schema) -- a feature unrelated to CRE. Filtering the full
`git log --all -- libs/bc/study/src/schema.ts` history for `course-reader`
returns nothing. Per-commit `--stat` inspection of all eight CRE phase commits
confirms:

| Phase / PR | Schema-relevant change                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| 1 / #767   | `courses.ts` (8 new read/delete functions), `index.ts`, `server.ts` re-exports, constants, routes -- no schema |
| 2 / #768   | `KnowledgeNodeBody.svelte` extraction + tests -- no schema                                                     |
| 3 / #769   | study reader index + detail `+page.server.ts` -- no schema                                                     |
| 4 / #770   | study step reader `+page.server.ts` -- no schema                                                               |
| 5 / #772   | goal composer course tab `+page.server.ts` + `.svelte` -- no schema                                            |
| 6 / #774   | hangar editor index, `course-seed.ts`, `course-yaml-emit.ts` -- no schema                                      |
| 7 / #775   | hangar section editor `+page.server.ts` -- no schema                                                           |
| 8 / #776   | `CourseStepChart.svelte` refinement -- no schema                                                               |

### BC contract additions are pure reads + deletes over existing tables

Phase 1 added eight functions to `libs/bc/study/src/courses.ts`
(`listCoursesForReader`, `listAllCourses`, `getCourseById`,
`getCourseStepByCode`, `deleteCourseStep`, `deleteCourseRow`,
`pickOverlaySyllabus`, plus the `ListCoursesForReaderOpts` type). Every one
operates against the existing `course`, `course_step`, `goal_syllabus`
Drizzle table objects imported from `./schema`. No `studySchema.table(...)`
call, no `pgEnum`, no `index(...)`/`uniqueIndex(...)`/`check(...)` was added.

### Spec contract claim is accurate

`spec.md:36` states: "Read-only against course data; writes go through the
existing goal composer (extending `goal_course`)." Confirmed against code:

- **Study reader (Phases 3-4)** -- `+page.server.ts` loaders only `select`
  from `course` / `course_step` / `knowledge_node`. No writes.
- **Goal composer (Phase 5)** -- `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts`
  `addCourse` / `removeCourse` / `setCourseWeight` actions `insert` / `delete` /
  `update` rows on the **existing** `goalCourse` table object. They add a
  `goal_course` row, not a new table. "Extending `goal_course`" in the spec
  means "writing rows to it", not "adding columns" -- the table shape is
  unchanged.
- **Hangar editor (Phases 6-7)** -- the section/step editor writes course
  content to YAML files under `course/courses/<slug>/` and re-runs the
  existing course seed pipeline (`runCourseSeed` -> `upsertCourse` /
  `upsertCourseStep`). DB writes flow through the pre-existing idempotent
  upsert BC paths. Orphan cleanup uses the new `deleteCourseStep` /
  `deleteCourseRow` helpers, which `db.delete(...)` from existing tables.

### Existing course-primitive schema (context, not under review)

The schema CRE consumes was authored by the earlier `course-primitive` and
`course-tree-arbitrary-depth` work packages. For completeness, it is sound
against the schema checklist:

- `course`, `course_step`, `goal_course` all live in the `study` namespace
  (`studySchema.table`), matching the BC convention -- no table prefixes.
- IDs use the prefixed-ULID strategy (`crs_` for `course`, `cst_` for
  `course_step`) via `createId('crs')` / `createId('cst')`; `goal_course`
  is a junction with a composite PK `(goal_id, course_id)` -- correct, no
  surrogate ID needed.
- FKs are explicit with deliberate `ON DELETE` semantics:
  `course_step.course_id` CASCADE, `course_step.parent_id` self-CASCADE,
  `course_step.knowledge_node_id` RESTRICT, `goal_course.goal_id` CASCADE,
  `goal_course.course_id` RESTRICT. The RESTRICT on `goal_course.course_id`
  is what makes `deleteCourseRow`'s documented "course in use" failure path
  correct.
- FK columns the CRE loaders query on are indexed: `course_step_tree_idx`
  `(course_id, parent_id, ordinal)` covers `getCourseStepsByCourse` and
  `getCourseStepByCode`; `course_step_node_idx` covers the reverse node
  lookup; `goal_course_by_course_idx` covers `getCoursesByGoal`'s join;
  `course_slug_unique` covers `getCourseBySlug`. `course.title` (used by
  `listCoursesForReader`'s `ORDER BY title ASC`) and `course.updated_at`
  (used by `listAllCourses`' `ORDER BY updated_at DESC`) are not indexed,
  but the `course` table is a small catalog (one row per authored course),
  so a sort over an unindexed column is not a concern at this cardinality.
  This is pre-existing schema, not a CRE change, and is noted only for
  context -- it is not a finding against this feature.
- Status / kind / level are `text` columns guarded by `check(...)`
  constraints that reference the centralized `COURSE_*_VALUES` constant
  arrays, the project's established enum-via-CHECK pattern.
- `created_at` / `updated_at` present via the shared `timestamps()` helper.

## Issues

None. The feature is schema-neutral and the spec's read-only / extends-
`goal_course` contract holds.
