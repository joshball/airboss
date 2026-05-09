---
title: 'Tasks: Course Primitive'
product: study
feature: course-primitive
type: tasks
status: unread
---

# Tasks: Course Primitive

Phased plan for [spec.md](./spec.md). Order is dependency-driven: constants + types first, schema next, BC + validator on top, lens, then YAML pipeline.

Depends on: cert-syllabus-and-goal-composer (shipped; provides `syllabus`, `syllabus_node`, `syllabus_node_link`, `goal`, `goal_syllabus`, `goal_node`, lens framework). Depends on: knowledge-graph (shipped; provides `knowledge_node`).

## Pre-flight

- [ ] Read [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) end-to-end, especially the "Refinement: Course as a peer primitive (2026-05-08)" section.
- [ ] Read [docs/platform/LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md), especially principle 11.
- [ ] Read [docs/work-packages/cert-syllabus-and-goal-composer/spec.md](../cert-syllabus-and-goal-composer/spec.md) -- the syllabus side this parallels. Mirror its YAML authoring layout, idempotent seed pipeline pattern, and BC surface conventions.
- [ ] Read `libs/bc/study/src/schema.ts` lines 1816+ end-to-end. Existing CHECK / index / FK / partial-UNIQUE conventions are the template.
- [ ] Read `libs/bc/study/src/lenses.ts` end-to-end. The `Lens` type signature, `MasteryRollup` math, `LensTreeNode` / `LensLeaf` shapes, and the ACS / Domain lens implementations are the templates for `courseLens` and `courseWithCertOverlayLens`.
- [ ] Read `libs/bc/study/src/goals.ts` (specifically `getGoalNodeUnion`). Course extension follows the same pattern.
- [ ] Read `libs/constants/src/credentials.ts` -- the `SYLLABUS_KINDS` shape is the template for `COURSE_KINDS`.
- [ ] Read `libs/constants/src/routes.ts`. `ROUTES` pattern understood.
- [ ] Read [course/syllabi/ppl-airplane-6c/manifest.yaml](../../../course/syllabi/ppl-airplane-6c/manifest.yaml) and [course/syllabi/ppl-airplane-6c/areas/05-performance-maneuvers.yaml](../../../course/syllabi/ppl-airplane-6c/areas/05-performance-maneuvers.yaml). Course YAML mirrors this shape.
- [ ] Verify DB is running (OrbStack postgres on port 5435).
- [ ] Confirm zero `syllabus.kind IN ('school','personal')` rows exist: `psql -d airboss -c "SELECT COUNT(*) FROM study.syllabus WHERE kind IN ('school','personal');"`.

## Implementation

### Phase 1: Constants + types

Shipped via PR #721.

- [x] Add `COURSE_KINDS`, `COURSE_KIND_VALUES`, `CourseKind`, `COURSE_KIND_LABELS` to `libs/constants/src/credentials.ts` (alongside `SYLLABUS_KINDS`).
- [x] Add `COURSE_STATUSES`, `COURSE_STATUS_VALUES`, `CourseStatus` to `libs/constants/src/credentials.ts`.
- [x] Add `COURSE_STEP_LEVELS`, `COURSE_STEP_LEVEL_VALUES`, `CourseStepLevel` to `libs/constants/src/credentials.ts`.
- [x] Add `KNOWLEDGE_NODE_KINDS`, `KNOWLEDGE_NODE_KIND_VALUES`, `KnowledgeNodeKind`, `KNOWLEDGE_NODE_KIND_LABELS` to `libs/constants/src/study.ts` (next to `NODE_LIFECYCLES`).
- [x] Re-export the new constants from `libs/constants/src/index.ts`.
- [x] Add `ROUTES.COURSES` (static), `ROUTES.COURSE(slug)` (function), `ROUTES.COURSE_STEP(slug, stepCode)` (function) to `libs/constants/src/routes.ts`. Mirror the syllabus / credential function shape.
- [x] Run `bun run check` -- 0 errors. Commit.

### Phase 2: Schema migration

Shipped via PR #728.

- [x] Create `libs/bc/study/src/schema.ts` additions for `course`, `courseStep`, `goalCourse` tables. Place after `goalNode` (line 2313) so the cert-syllabus block stays contiguous.
- [x] Add `kind` column to `knowledgeNode` table (after `lifecycle`, before `referencesV2Migrated`). Default `'concept'`.
- [x] Add CHECK constraints per spec:
  - `course_kind_check`, `course_status_check`, `course_slug_shape_check`
  - `course_step_level_check`, `course_step_consistency_check` (the combined level/parent_id/knowledge_node_id/is_leaf rule), `course_step_ordinal_check`
  - `knowledge_node_kind_check`
  - `goal_course_weight_check` (reuse `GOAL_SYLLABUS_WEIGHT_MIN`/`MAX`)
- [x] Add indexes per spec: `course_slug_unique`, `course_kind_status_idx`, `course_step_course_code_unique`, `course_step_tree_idx`, `course_step_node_idx`, `goal_course_by_course_idx`.
- [x] Add `CourseRow`, `CourseStepRow`, `GoalCourseRow` type exports at the bottom of `schema.ts`.
- [x] Generate the migration: `bun run db generate`. Verify the SQL diff in `drizzle/00XX_course_primitive.sql`.
- [x] Apply: `bun run db migrate`. Verify tables exist + `knowledge_node.kind` is populated to `'concept'` on every existing row.
- [x] Run `bun run check` -- 0 errors. Commit.

### Phase 3: Course BC

Shipped via PR #730 (with the aggregation-rule clarification doc-fix in PR #731: aggregation is MAX, not SUM).

- [x] Create `libs/bc/study/src/courses.ts` with public functions:
  - `upsertCourse(input)`, `upsertCourseStep(input)` (used by seed pipeline)
  - `getCourseBySlug(slug, db)`, `getCourseStepsByCourse(courseId, db)` (used by lenses + UI)
  - `getCoursesByGoal(goalId, db)` (used by goal composer)
- [x] Extend `getGoalNodeUnion(goalId, db)` in `libs/bc/study/src/goals.ts` to also walk `goal_course -> course_step (level='step') -> knowledge_node_id` and merge into the returned union with `goal_course.weight`. Dedup by knowledge_node_id; keep the MAX weight when a node is reached via multiple sources (matches the existing relevance-cache rule per the 2026-05-09 doc-fix).
- [x] Add unit tests in `libs/bc/study/src/__tests__/courses.test.ts`. Coverage:
  - Upsert idempotency (same content_hash => no write)
  - Tree walk (sections in order, steps in order under each section)
  - `getGoalNodeUnion` with course-only goal
  - `getGoalNodeUnion` with course + syllabus + ad-hoc node (dedup + max-weight)
- [x] Run `bun run check` -- 0 errors, all tests pass. Commit.

### Phase 4: Lens framework extensions + courseLens

Shipped via PR #732.

- [x] Extend `LensLeaf` in `libs/bc/study/src/lenses.ts` with optional `sources?: LensLeafSources` field.
- [x] Extend `LensResult` with optional `certGaps?: CertGap[]` field.
- [x] Extend `LensTreeNode['level']` union to include `'course'` and `'section'`.
- [x] Verify existing `acsLens` and `domainLens` still typecheck and pass tests (the new fields are optional).
- [x] Implement `courseLens` in a new file `libs/bc/study/src/lenses-course.ts` (follows the existing per-lens file pattern that the cert-syllabus WP introduced).
- [x] Re-export `courseLens` from `libs/bc/study/src/lenses.ts`.
- [x] Add unit tests in `libs/bc/study/src/__tests__/lenses-course.test.ts`. Coverage:
  - Empty course (no sections) -> empty tree
  - Course with sections + steps -> two-level tree with correct rollups
  - Goal weight applied to leaf weights
  - Anonymous browse (goal=null) returns tree with empty mastery
- [x] Run `bun run check` -- 0 errors, all tests pass. Commit.

### Phase 5: courseWithCertOverlayLens + getCourseGaps

Shipped via PR #736.

- [x] Implement `courseWithCertOverlayLens` in `libs/bc/study/src/lenses-course.ts`.
- [x] Implement helper `getCourseGaps(goalId, courseId, syllabusId, db)` that returns the `CertGap[]` array independent of the lens (useful for non-tree consumers).
- [x] Re-export both from `libs/bc/study/src/lenses.ts`.
- [x] Add unit tests:
  - Course covers all PPL ACS leaves (gap list is empty)
  - Course covers some PPL ACS leaves (gap list contains the rest)
  - Course covers nodes outside any syllabus (per-step `inCert: false`, no entries in gap list)
  - Step's linked node is also linked from a syllabus_node_link (per-step `inCert: true` with `certCode` populated)
- [x] Run `bun run check` -- 0 errors, all tests pass. Commit.

### Phase 6: YAML authoring pipeline + seed handler

Shipped via PR #734 (with the CRS-16/17 spec-message fix in PR #739: validator now emits the exact spec-defined messages instead of Zod defaults).

- [x] Add YAML loader at `scripts/db/seed-courses.ts`. Walk `course/courses/<slug>/` directories. Mirror `scripts/db/seed-syllabi.ts` shape (or wherever the syllabus seed lives -- check the repo for the canonical file path).
- [x] Add Zod schemas for course manifest + section + step in `libs/bc/study/src/course-yaml-schemas.ts`. Strict; reject unknown keys.
- [x] Implement validator: every spec rejection in the "Seed validator rejections" table fires with the exact message string for log-grepping.
- [x] Wire up `bun run db seed courses` command in `scripts/db.ts` (or wherever the db CLI dispatcher lives).
- [x] Add a smoke test fixture: `course/courses/_fixtures/seed-smoke/` with one section + two steps + one transition step. Used by Phase 7 acceptance.
- [x] Run `bun run check` -- 0 errors. Commit.

### Phase 7: Diagnostic + smoke acceptance

Shipped via PR #737.

- [x] Add `bun run db diagnose:school-personal-syllabi` command. Reads `study.syllabus` and prints any rows with `kind IN ('school','personal')`. Exit 0 with row count.
- [x] Run the diagnostic on the dev DB. Confirm zero rows. Commit the script.
- [x] Run `bun run db seed courses` against the smoke fixture. Verify:
  - One `course` row with slug `seed-smoke`
  - One `course_step` row with `level='section'`
  - Two `course_step` rows with `level='step'`, both with valid `knowledge_node_id`
  - The transition step's linked knowledge node has `kind='transition'`
- [x] Re-run the seed; verify zero writes (idempotency).
- [x] Modify one fixture step's `body_md`; re-run seed; verify exactly one update on that step (content_hash changed).
- [x] Commit.

### Phase 8: Documentation + WP closeout

Closeout PR (this phase).

- [x] Update `docs/work/NOW.md` with this WP's shipped status.
- [x] Add an entry to `docs/log/` per the project's per-PR log convention -- one entry per merged PR (713, 721, 728, 730, 731, 732, 734, 736, 737, 739) emitted via `bun run track log <number>`.
- [x] Update `docs/decisions/016-cert-syllabus-goal-model/decision.md` Migration Plan table with a new row for course-primitive (Phase 11; status: shipped; PR list).
- [x] Run `bun run check all` -- 0 errors, 0 warnings.
- [x] Open the closeout PR. Title: `chore(course-primitive): Phase 8 - closeout`. (Phase implementation shipped under per-phase PR titles `feat(course-primitive): Phase N - ...`.)

## Post-implementation

- [ ] Full manual test per [test-plan.md](./test-plan.md).
- [ ] Request implementation review (`/ball-review-full`).
- [ ] Address every finding (per CLAUDE.md "ALWAYS FIX EVERYTHING from a review").
- [ ] Commit doc updates.
- [ ] Mark WP `human_review_status: signed-off` after Joshua's walkthrough.

## Out of scope (do NOT do in this WP)

These are explicitly deferred per [spec.md](./spec.md). Do not add them to satisfy a reviewer or to "tidy up":

- `course_prereq` table or any course-to-course prerequisite logic
- `course_step.track` column (parallel ladders are an authoring convention only)
- `course_aux_link` table or aux course attachment
- `goal_node_exclusion` or any per-node opt-out primitive
- Course versioning fields (`version`, `superseded_by_id`, `mutable`)
- Personal course authoring UI (`COURSE_KINDS.PERSONAL` is reserved as a value but unauthored in this WP)
- `course.cert_alignment` field (overlay is goal-driven, not course-declared)
- Course step UI pages (the lens output is consumed by the next WP; this WP ships data + lens, not UI)

If a reviewer flags one of these, point at this section and the spec's Out-of-scope list. Land the deferred work in a follow-on WP only when the weather-course authoring (next WP) shows it's needed.
