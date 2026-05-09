---
title: 'Tasks: Course Reader and Editor'
product: study
feature: course-reader-and-editor
type: tasks
status: unread
---

# Tasks: Course Reader and Editor

Phased plan for [spec.md](./spec.md). Order is dependency-driven: BC contract additions first, then the shared node-body component, then study reader (in parallel with hangar editor once the BC contract is in), then goal composer extension, then encoded-text + transition rendering hints, then chart stub.

Depends on: [course-primitive](../course-primitive/) (shipped via PRs #713-#737, doc fixes #739, #757).

## Pre-flight

- [ ] Read [spec.md](./spec.md), [design.md](./design.md), [test-plan.md](./test-plan.md), [user-stories.md](./user-stories.md), [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) end-to-end.
- [ ] Read [docs/work-packages/course-primitive/spec.md](../course-primitive/spec.md), [design.md](../course-primitive/design.md), and [OUT-OF-SCOPE.md](../course-primitive/OUT-OF-SCOPE.md) end-to-end. The data model + lens contract this WP consumes is final.
- [ ] Read [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md), especially the "Refinement: Course as a peer primitive (2026-05-08)" section.
- [ ] Read [docs/platform/LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md), especially principle 11.
- [ ] Read `libs/bc/study/src/courses.ts` end-to-end. Understand `upsertCourse`, `upsertCourseStep`, `getCourseBySlug`, `getCourseStepsByCourse`, `getCoursesByGoal`, `getCourseGaps`. New helpers in this WP follow the same patterns.
- [ ] Read `libs/bc/study/src/lenses-course.ts` end-to-end. The shape of `LensResult` (with `tree`, `rollup`, `leaves`, optional `certGaps`) is what the reader consumes.
- [ ] Read `libs/bc/study/src/lenses.ts` for the type definitions: `Lens`, `LensTreeNode`, `LensLeaf`, `LensLeafSources`, `CertGap`, `MasteryRollup`, `LensLeafMastery`.
- [ ] Read `scripts/db/seed-courses.ts` end-to-end. The hangar editor's save action invokes `seedCourses()` from this file.
- [ ] Read `libs/bc/study/src/course-yaml-schemas.ts` for the Zod shapes the editor must produce.
- [ ] Read `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts` and `+page.svelte` end-to-end. The goal composer extension mirrors the existing actions and tab pattern.
- [ ] Read `apps/study/src/routes/(app)/reference/knowledge/[id]/+page.svelte` (or wherever the knowledge node detail page lives) -- this is the source of the 7-phase node renderer that gets extracted.
- [ ] Read `apps/hangar/src/routes/(app)/glossary/+page.svelte` and `+page.server.ts`. The hangar editor pattern (form-action-driven CRUD, table layout, modal forms) is the template.
- [ ] Read `libs/constants/src/routes.ts` lines containing `COURSES`, `COURSE`, `COURSE_STEP`. Routes for the study reader are already shipped. Hangar courses routes are added in Phase 1.
- [ ] Read `libs/constants/src/study.ts` -- find the right place to add `WX_DECODE_PRODUCT_SLUGS` next to existing weather-product constants.
- [ ] Run `bun run check` -- 0 errors before starting (clean slate).
- [ ] Verify the seed-smoke fixture loads: `bun run db seed courses --dir course/courses/_fixtures`. Should report 1 course / 3 step rows.

## Implementation

### Phase 1: BC contract additions + constants + routes

Small, foundational. Lands before any UI code.

- [ ] Add `WX_DECODE_PRODUCT_SLUGS` to `libs/constants/src/study.ts` -- a `const` tuple of three slugs (`wx-reading-metars-tafs`, `wx-product-pireps`, `wx-product-airmets-sigmets`). Re-export from `libs/constants/src/index.ts`.
- [ ] Add `ROUTES.HANGAR_COURSES`, `ROUTES.HANGAR_COURSE(slug)`, `ROUTES.HANGAR_COURSE_SECTION(slug, code)` to `libs/constants/src/routes.ts`. Mirror the `HANGAR_GLOSSARY*` shape.
- [ ] Add the form-action-route constants: `HANGAR_COURSE_UPDATE_MANIFEST_ACTION`, `HANGAR_COURSE_DELETE_ACTION`, `HANGAR_COURSE_ADD_SECTION_ACTION`, `HANGAR_COURSE_UPDATE_SECTION_ACTION`, `HANGAR_COURSE_DELETE_SECTION_ACTION`, `HANGAR_COURSE_REORDER_SECTIONS_ACTION`, `HANGAR_COURSE_ADD_STEP_ACTION`, `HANGAR_COURSE_UPDATE_STEP_ACTION`, `HANGAR_COURSE_DELETE_STEP_ACTION`, `HANGAR_COURSE_REORDER_STEPS_ACTION`, `HANGAR_COURSE_CLEANUP_ORPHANS_ACTION`. Mirror the `HANGAR_GLOSSARY_SAVE_ACTION` / `HANGAR_GLOSSARY_DELETE_ACTION` shape.
- [ ] Add three goal-composer action route constants: `STUDY_GOAL_ADD_COURSE_ACTION`, `STUDY_GOAL_REMOVE_COURSE_ACTION`, `STUDY_GOAL_SET_COURSE_WEIGHT_ACTION`. Mirror the existing `STUDY_GOAL_*_SYLLABUS_ACTION` set if it exists; otherwise mirror the inline `?/addSyllabus` strings the existing form uses.
- [ ] Add to `libs/bc/study/src/courses.ts`: `listCoursesForReader(db, opts)`, `listAllCourses(db)`, `getCourseStepByCode(courseId, code, db)`, `getCourseById(id, db)`, `deleteCourseStep(id, db)`, `deleteCourseRow(id, db)`, `pickOverlaySyllabus(goal, db)`. Each is a small read or single-row write; follow the existing JSDoc and error-handling patterns.
- [ ] Re-export the new BC functions from `libs/bc/study/src/index.ts` (server-only entries -- they touch `@ab/db/connection`).
- [ ] Add unit tests in `libs/bc/study/src/__tests__/courses.test.ts` for each new helper. Coverage:
  - `listCoursesForReader` filters by status correctly
  - `pickOverlaySyllabus` returns highest-weight goal_syllabus, ties broken by id
  - `pickOverlaySyllabus` returns null for goal-with-no-syllabi and null-goal
  - `getCourseStepByCode` returns the step row or null
  - `deleteCourseRow` cascades to course_step (verified via FK behavior)
- [ ] Run `bun run check` -- 0 errors. Run `bun test libs/bc/study` -- all pass. Commit.

### Phase 2: Extract KnowledgeNodeBody shared component

Small refactor. Lands before any new pages so the existing knowledge detail page consumes the shared component too.

- [ ] Locate the existing 7-phase node renderer (likely in `apps/study/src/routes/(app)/reference/knowledge/[id]/+page.svelte` or a peer file). Read end-to-end.
- [ ] Extract to `apps/study/src/lib/components/KnowledgeNodeBody.svelte`. Props: the node row (or a typed `NodeBodyProps` shape carrying body_md, frontmatter, references). Output identical to the inlined version.
- [ ] Update the existing knowledge detail page to import + render the shared component. Verify the page still renders identically.
- [ ] Add a small `__tests__/KnowledgeNodeBody.test.ts` (Vitest) that mounts the component with a fixture node and asserts each phase heading appears in the DOM. Use real assertions (`.toBeInTheDocument()` or `.toMatch(...)`) -- never `.toBeTruthy()` per project rules.
- [ ] Run `bun run check` -- 0 errors. Commit.

### Phase 3: Study reader index + detail pages (parallel-eligible with Phase 4)

These two phases (3 and 4) share Phase 1 + 2 outputs but touch different apps; they parallelize cleanly after Phase 2 lands.

- [ ] Create `apps/study/src/routes/(app)/courses/+page.server.ts`. Loader calls `listCoursesForReader({ statusIn: ['active', 'archived'] })` + `getCoursesByGoal(primaryGoal.id)` if a primary goal exists.
- [ ] Create `apps/study/src/routes/(app)/courses/+page.svelte`. List layout per the design doc. Status badge, mastery bar, "open" link, "in goal" pin.
- [ ] Create `apps/study/src/routes/(app)/courses/[slug]/+page.server.ts`. Loader picks lens based on `pickOverlaySyllabus`. 404s on missing slug or `status='draft'`.
- [ ] Create `apps/study/src/routes/(app)/courses/[slug]/+page.svelte`. Renders course header + sections + step leaves + cert-gaps panel (when overlay active).
- [ ] Create `apps/study/src/lib/components/CertGapsPanel.svelte` -- consumes a `certGaps` array prop, renders sortable list with code + title + bloom badge + linked-node count.
- [ ] Add a Playwright e2e test `tests/e2e/courses-reader-anonymous.spec.ts` that visits `/courses` and `/courses/seed-smoke` (using the smoke fixture) as an unauthenticated user, asserts the page renders without error and shows expected content. (Anonymous access decision: routes redirect to login per the existing layout guard. The test runs as a logged-in dev user via the project's existing auth helpers.)
- [ ] Add a Playwright e2e test `tests/e2e/courses-reader-overlay.spec.ts` that plants a goal with PPL ACS Area I.C as a goal_syllabus + the seed-smoke course as a goal_course, visits the detail page, asserts the cert-gaps panel renders and the right chips appear on at least one step.
- [ ] Run `bun run check` -- 0 errors, all tests pass. Commit.

### Phase 4: Step reader page (parallel-eligible with Phase 3)

- [ ] Create `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.server.ts`. Loader fetches course + step + linked node + lens (when overlay applies). 404s on missing slug, missing stepCode, or step with `level !== 'step'`.
- [ ] Create `apps/study/src/routes/(app)/courses/[slug]/[stepCode]/+page.svelte`. Three vertical sections per spec.md "Step reader" -- step framing, KnowledgeNodeBody, cert-overlay surface.
- [ ] Create `apps/study/src/lib/components/CourseStepFraming.svelte` -- renders breadcrumb + step title + step body_md.
- [ ] Create `apps/study/src/lib/components/CertOverlayChips.svelte` -- consumes a `LensLeafSources` prop + matching cert leaf metadata, renders the chip strip.
- [ ] Create `apps/study/src/lib/components/EncodedTextLadderTabs.svelte` -- renders the Decode/Understand/Triage tab strip (visual hints only this WP, deferred per OUT-OF-SCOPE for actual filtering).
- [ ] Create `apps/study/src/lib/components/TransitionStepBody.svelte` -- the bridge-styled body renderer.
- [ ] Wire conditional rendering: `isEncodedText` -> show ladder tabs above body; `isTransition` -> use TransitionStepBody instead of KnowledgeNodeBody.
- [ ] Add Playwright e2e tests in `tests/e2e/courses-reader-step.spec.ts`:
  - Step reader renders for the smoke fixture's `s1.1` step
  - Transition step renders with bridge framing (use the smoke fixture's `s1.2` step which links the icing node; toggle that node's `kind='transition'` for the test, revert after)
  - Encoded-text step renders ladder tabs (planted: a fixture step linking `wx-reading-metars-tafs`)
- [ ] Run `bun run check` -- 0 errors, all tests pass. Commit.

### Phase 5: Goal composer extension

Touches the existing `/program/goals/[id]` page. Sequenced after Phases 3-4 so the courses index/detail exist for the picker to link to.

- [ ] Update `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts`:
  - Loader: also call `getCoursesByGoal(goalId)` and `listCoursesForReader({ statusIn: ['active'] })` for the picker.
  - Add three actions: `addCourse`, `removeCourse`, `setCourseWeight`. Each follows the existing addSyllabus/removeSyllabus/setSyllabusWeight shape line-for-line.
- [ ] Update `+page.svelte`:
  - Add a Courses tab next to Syllabi and Ad-hoc nodes.
  - Tab content: courses-in-goal list (weight input + remove button per row) + add-course picker (datalist or select from `listCoursesForReader` filtered to "not currently in goal").
- [ ] Add a Playwright e2e test `tests/e2e/goal-composer-courses.spec.ts`:
  - Plant a goal; navigate to `/program/goals/[id]`; switch to Courses tab; add the smoke-fixture course; assert it appears in the list.
  - Update its weight; assert the new weight is reflected after reload.
  - Remove it; assert it disappears.
- [ ] Run `bun run check` -- 0 errors, all tests pass. Commit.

### Phase 6: Hangar editor index + course manifest editor (parallel-eligible with Phase 7)

Touches the hangar app. Phase 6 and Phase 7 share Phase 1 outputs but touch different routes; they parallelize after Phase 1 lands.

- [ ] Create `apps/hangar/src/routes/(app)/courses/+page.server.ts`. Loader calls `listAllCourses(db)`. Filter via `?status=...` query param.
- [ ] Create `apps/hangar/src/routes/(app)/courses/+page.svelte`. Table layout: slug / title / status / kind / section count / updated-at / edit-link / delete-action.
- [ ] Create `apps/hangar/src/routes/(app)/courses/+page.server.ts` actions: `delete` (deletes the entire course directory + re-runs seed + cleans the orphan course row). Confirmation modal in the svelte page.
- [ ] Create the new-course form (button + modal): action creates `course/courses/<slug>/manifest.yaml` with the form fields, runs seed, redirects to `/courses/[slug]`.
- [ ] Create `apps/hangar/src/routes/(app)/courses/[slug]/+page.server.ts`. Loader: course + section list. Actions: `updateManifest`, `addSection`, `deleteSection`, `reorderSections`, `cleanupOrphans`.
- [ ] Create `apps/hangar/src/routes/(app)/courses/[slug]/+page.svelte`. Two-pane layout: manifest form on top, section list below with drag-handle (manual ordinal entry per OUT-OF-SCOPE deferral), add-section form at the bottom.
- [ ] Create the canonical YAML emit helper at `apps/hangar/src/lib/server/course-yaml-emit.ts` -- functions `emitManifest(manifest)`, `emitSection(section)`. Per design.md.
- [ ] Create the seed-pipeline integration helper at `apps/hangar/src/lib/server/course-seed.ts` -- function `runCourseSeed(slug)` wraps `seedCourses({ slug })` from `scripts/db/seed-courses.ts`, surfaces the summary or throws on `CourseSeedError` with the message preserved.
- [ ] Add unit tests for `emitManifest` / `emitSection` in `apps/hangar/src/lib/server/__tests__/course-yaml-emit.test.ts` -- round-trip a fixture (parse -> emit -> parse) and assert deep-equal.
- [ ] Add a Playwright e2e test `tests/e2e/hangar-course-editor-manifest.spec.ts`:
  - Visit hangar `/courses`; create a new course; verify the directory was created on disk.
  - Edit the manifest; save; verify the YAML on disk reflects the change AND the DB row was updated.
  - Delete the course; verify the directory and DB row are gone.
- [ ] Run `bun run check` -- 0 errors, all tests pass. Commit.

### Phase 7: Hangar editor section editor + step editor + KnowledgeNodePicker (parallel-eligible with Phase 6)

- [ ] Create `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.server.ts`. Loader: section + step list. Actions: `updateSection`, `addStep`, `updateStep`, `deleteStep`, `reorderSteps`.
- [ ] Create `apps/hangar/src/routes/(app)/courses/[slug]/sections/[code]/+page.svelte`. Layout: section form on top, step list with inline edit/delete + add-step form below.
- [ ] Create `apps/hangar/src/lib/components/KnowledgeNodePicker.svelte` -- combobox with live filter against the existing knowledge browse data. Surfaces slug, title, domain, kind. Emits the selected node id.
- [ ] BC additions in `libs/bc/study/src/courses.ts` if needed: a paginated `listKnowledgeNodesForPicker(query, opts)` if the existing browse query isn't reusable. Otherwise consume the existing one.
- [ ] Add a Playwright e2e test `tests/e2e/hangar-course-editor-section.spec.ts`:
  - Create a section; verify the YAML file was created.
  - Add a step (use the picker to select an existing weather node); verify the YAML reflects + DB row exists.
  - Edit the step's body_md; verify the YAML and DB are in sync.
  - Reorder two steps; verify ordinals updated.
  - Delete a step; verify orphan-cleanup surface appears.
- [ ] Add a unit test for the seed-revert path (Phase 6's `runCourseSeed` helper) -- inject a YAML write that the validator rejects, assert the file is reverted.
- [ ] Run `bun run check` -- 0 errors, all tests pass. Commit.

### Phase 8: Chart stub component

- [ ] Create `apps/study/src/lib/components/CourseStepChart.svelte` -- prop `slug: string`. Body: a bordered container, with `slug` text rendered in development mode and an empty wrapper in production. CSS uses theme tokens; no hex.
- [ ] Decide on the embedding mechanism: either (a) a custom markdown directive parser is added now (out of scope per OUT-OF-SCOPE), or (b) the component is mounted directly in step body_md by an explicit Svelte snippet override on specific steps.
- [ ] For this WP, ship option (b): the step page accepts a `chartSlug` query param (`?chart=<slug>`) and mounts `<CourseStepChart slug={chartSlug} />` in a fixed slot below the node body. This is sufficient to demo the embedding contract and lets a real chart WP wire the directive parser.
- [ ] Add a unit test that mounts the component with a fixture slug and asserts the placeholder renders.
- [ ] Run `bun run check` -- 0 errors. Commit.

### Phase 9: Documentation + WP closeout

- [ ] Update `docs/work/NOW.md` with this WP's shipped status.
- [ ] Update [docs/products/study/PRD.md](../../products/study/PRD.md) "Shipped" or "In flight" section with `/courses` reader entry.
- [ ] Update [docs/products/hangar/PRD.md](../../products/hangar/PRD.md) "Shipped" table with `/courses` editor entry.
- [ ] Update [docs/work-packages/course-primitive/OUT-OF-SCOPE.md](../course-primitive/OUT-OF-SCOPE.md) -- the "Course-step UI surfaces" item resolves; mark it shipped or move to a "Resolved" section.
- [ ] Add per-PR log entries via `bun run track log <number>` for each merged PR in this WP.
- [ ] Run `bun run check all` -- 0 errors, 0 warnings.
- [ ] Open the closeout PR. Title: `chore(course-reader-and-editor): closeout`.

## Post-implementation

- [ ] Full manual test per [test-plan.md](./test-plan.md). Joshua walks through every CRE-NN scenario.
- [ ] Author the first real instructor course (likely weather-comprehensive) using the new editor. This is OUT OF SCOPE for this WP per the OOS doc; mention it here as the natural follow-on.
- [ ] Request implementation review (`/ball-review-full`).
- [ ] Address every finding (per CLAUDE.md "ALWAYS FIX EVERYTHING from a review").
- [ ] Mark WP `human_review_status: signed-off` after Joshua's walkthrough.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Parallelization plan

Phases 3-4 and 6-7 each form an independent two-phase pair that runs after Phases 1-2 land. Recommended dispatch:

- Wave 1 (sequential): Phase 1 (BC/constants/routes) -> Phase 2 (extract KnowledgeNodeBody)
- Wave 2 (parallel): Phase 3 (study index + detail) || Phase 4 (study step reader) || Phase 6 (hangar index + course editor) || Phase 7 (hangar section editor)
- Wave 3 (sequential): Phase 5 (goal composer extension -- depends on the courses index existing) -> Phase 8 (chart stub) -> Phase 9 (closeout)

Phases 3 and 4 split the study app's three pages (index/detail + step reader). Phases 6 and 7 split the hangar app's three pages (index + course editor + section editor). The split is by file, not by concern, per project memory `feedback_parallel_agents_scope_by_file.md`.
