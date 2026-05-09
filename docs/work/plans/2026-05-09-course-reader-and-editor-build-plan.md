---
title: 'Build Plan: Course Reader and Editor'
feature: course-reader-and-editor
type: build-plan
status: complete
created: 2026-05-09
---

# Build Plan: Course Reader and Editor

Sequential within-this-worktree execution of the 9 phases in
[docs/work-packages/course-reader-and-editor/tasks.md](../../work-packages/course-reader-and-editor/tasks.md).

## Phase summary

### Phase 1: BC contract additions + constants + routes

- Add `WX_DECODE_PRODUCT_SLUGS` to `libs/constants/src/study.ts`.
- Add `ROUTES.HANGAR_COURSES`, `ROUTES.HANGAR_COURSE`, `ROUTES.HANGAR_COURSE_SECTION`.
- Add hangar form-action route constants (10) + goal-composer action route constants (3).
- Add BC helpers in `libs/bc/study/src/courses.ts`: `listCoursesForReader`, `listAllCourses`, `getCourseStepByCode`, `getCourseById`, `deleteCourseStep`, `deleteCourseRow`, `pickOverlaySyllabus`.
- Re-export from `libs/bc/study/src/index.ts` (server entry).
- Unit tests for new BC helpers in `libs/bc/study/src/__tests__/courses.test.ts`.
- Reviewers: schema, backend, correctness.

### Phase 2: Extract KnowledgeNodeBody shared component

- Locate the existing 7-phase node renderer in `apps/study/src/routes/(app)/reference/knowledge/[slug]/+page.svelte`.
- Extract the `phases` rendering (lines 334-346) plus `mastery criteria` and `references` blocks into `apps/study/src/lib/components/KnowledgeNodeBody.svelte`. Props: phase array, optional masteryCriteria, optional references.
- Update the existing knowledge detail page to consume the shared component.
- Vitest test that mounts the component with a fixture and asserts each phase heading appears.
- Reviewers: svelte, ux, patterns.

### Phase 3: Study reader index + detail pages

- `/courses/+page.server.ts` + `/courses/+page.svelte` (index).
- `/courses/[slug]/+page.server.ts` + `/courses/[slug]/+page.svelte` (detail).
- `CertGapsPanel.svelte`.
- e2e specs for index + detail (overlay + non-overlay).
- Reviewers: svelte, ux, a11y.

### Phase 4: Step reader page

- `/courses/[slug]/[stepCode]/+page.server.ts` + `+page.svelte`.
- `CourseStepFraming.svelte`, `CertOverlayChips.svelte`, `EncodedTextLadderTabs.svelte`, `TransitionStepBody.svelte`.
- Wire conditional rendering.
- e2e tests.
- Reviewers: svelte, ux, correctness.

### Phase 5: Goal composer extension

- Extend `/program/goals/[id]/+page.server.ts` with `addCourse`, `removeCourse`, `setCourseWeight` actions; loader pulls course-in-goal + picker data.
- Extend `+page.svelte` with a Courses tab.
- e2e test.
- Reviewers: backend, svelte, ux.

### Phase 6: Hangar courses index + course manifest editor

- `/courses/+page.server.ts` + `+page.svelte` in hangar (index, new-course form, delete action).
- `/courses/[slug]/+page.server.ts` + `+page.svelte` (manifest editor, sections list, add/reorder/delete).
- `apps/hangar/src/lib/server/course-yaml-emit.ts` (canonical emit).
- `apps/hangar/src/lib/server/course-seed.ts` (seedCourses wrapper with revert-on-error).
- Unit test: round-trip parse + emit equals.
- e2e: new-course + edit + delete flow.
- Reviewers: backend, svelte, correctness.

### Phase 7: Hangar section editor + step editor + KnowledgeNodePicker

- `/courses/[slug]/sections/[code]/+page.server.ts` + `+page.svelte`.
- `apps/hangar/src/lib/components/KnowledgeNodePicker.svelte`.
- e2e: section + step CRUD via picker.
- Unit test for revert-on-seed-failure path.
- Reviewers: svelte, ux, backend.

### Phase 8: Chart stub component

- `apps/study/src/lib/components/CourseStepChart.svelte`.
- Mount in step page via `?chart=<slug>` query param.
- Unit test.
- Reviewers: svelte, patterns.

### Phase 9: Documentation + closeout

- Update `docs/work/NOW.md`, `docs/products/study/PRD.md`, `docs/products/hangar/PRD.md`.
- Update `docs/work-packages/course-primitive/OUT-OF-SCOPE.md` resolved entry.
- Closeout PR.

## Final review (Step 5 of skill)

Launch all 10 review agents in parallel (no `isolation: "worktree"`):
ux, svelte, security, perf, architecture, patterns, correctness, a11y, backend, schema.

Write findings to `docs/work/reviews/2026-05-09-course-reader-and-editor-final-{category}.md`.

## Fix pass (Step 6)

Consolidate findings, fix everything (critical -> nit), re-verify.

## review.md (Step 7)

Write `docs/work-packages/course-reader-and-editor/review.md`.

## PR (Step 8)

Push and open PR. Do NOT auto-merge -- user walks the test plan first.
