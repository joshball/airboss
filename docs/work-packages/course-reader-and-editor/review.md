---
title: 'Build Review: Course Reader and Editor'
feature: course-reader-and-editor
type: review
status: unread
review_status: pending
created: 2026-05-09
---

# Build Review: Course Reader and Editor

Self-review across the four phase commits resumed by agent
`a101328e7306539f6` plus the four commits inherited from
`abd5abb942fe3525d`. The full 10-agent parallel review (per the
`/ball-wp-build` skill) is intentionally deferred: this build was
resumed under a hard dispatcher constraint that nested-worktree
sub-agents are unsafe and must not launch from inside this worktree.
Joshua can run `/ball-review-full` post-PR-open if a deeper sweep is
wanted before signing off `human_review_status`.

## Verification

- `bun run check types` (full svelte-check across all 5 apps): clean.
- `bun run check branch`: clean (svelte-check:study + biome + theme-lint
  + browser-globals + edition-cache-write-guard + help-ids + md-format
  + test-lint).
- `bun test libs/bc/study/src/__tests__/courses.test.ts`: 17 pass / 0
  fail / 69 expect() calls.
- `bun run test apps/hangar/src/lib/server/`: 8 pass / 0 fail across 3
  test files (yaml emit round-trip + seed-revert path).

## Spec coverage walk

- Three study-app pages (index / detail / step reader): shipped Phase 3 + 4.
- Three hangar-app pages (index / manifest / section editor): shipped Phase 6 + 7.
- One existing-page extension (Courses block on `/program/goals/[id]` with three actions): shipped Phase 5.
- Stub component `<CourseStepChart slug="..." />`: shipped Phase 8 (read in spec.md, mounts under `?chart=<slug>`).
- BC additions per design.md API surface: `listCoursesForReader`, `listAllCourses`, `getCourseStepByCode`, `getCourseById`, `deleteCourseStep`, `deleteCourseRow`, `pickOverlaySyllabus`, plus the goal-course composition helpers (`addGoalCourse`, `removeGoalCourse`, `setGoalCourseWeight`, `goalHasCourse`) and Phase 5/6 follow-ons (`getGoalCourses`, `getSectionCountsByCourseIds`).
- Constants: `WX_DECODE_PRODUCT_SLUGS`, `COURSE_SLUG_REGEX`, `COURSES_DIR_RELATIVE`, hangar route + form-action constants, goal-composer action constants -- all in `@ab/constants`.
- Encoded-text family rendering hint (Decode/Understand/Triage tab strip when slug matches): shipped Phase 4 via `EncodedTextLadderTabs.svelte`.
- Transition step rendering (bridge styling skipping the 7-phase scaffold): shipped Phase 4 via `TransitionStepBody.svelte`.
- Cert-overlay surfaces (per-step chip strip + course-detail panel): shipped Phase 3-4 via `CertOverlayChips.svelte` + `CertGapsPanel.svelte`.
- Hangar editor save flow (read backup -> emit canonical YAML -> write -> seed; revert YAML on seed failure): implemented in every action path.
- Orphan-row cleanup action: shipped on the manifest editor.
- KnowledgeNodePicker with archived-hidden-by-default + "include archived" toggle: shipped Phase 7.

## Known follow-ons (per spec OOS, not regressions)

- Multi-syllabus overlay picker UI on the course detail page (deferred per OUT-OF-SCOPE).
- Drag-and-drop reorder (number-input ordinals are sufficient at current scale; deferred per OUT-OF-SCOPE).
- Real chart rendering (chart stub ships; the embedding contract is `?chart=<slug>` query param mounting `<CourseStepChart>`).
- Per-tab encoded-text content filtering (tabs are visual hints only this WP).
- Personal-course authoring surface in the study app (deferred per course-primitive OUT-OF-SCOPE).
- Multi-author concurrency / file-locking on the hangar editor (single-user assumption holds).

## Notes for the manual walkthrough

- The seed-smoke fixture (`course/courses/_fixtures/seed-smoke/`) is the canonical course used in e2e specs. Joshua may need to re-seed via `bun run db seed courses --dir course/courses/_fixtures` before walking the test plan.
- The `/courses` index renders the seed-smoke fixture only when the seed has run against the working DB. Anonymous (logged-in-but-no-goal) browse renders the page with empty mastery -- consistent with the spec's "Auth" decision.
- The hangar `/courses` editor's create flow lands on `/courses/[slug]` after a successful seed; if the seed rejects the new manifest, the directory rolls back and the form re-renders with the rejection text.
- Goal composer Courses block links each row to `/courses/[slug]` (study reader). The link uses the course's slug from the loader's `courseSlugById` map.

## Frontmatter

`status` and `agent_review_status` are deferred until Joshua walks the test
plan. Per project rule the agent never sets `human_review_status` or
`status: shipped`. Once Joshua signs off, the WP transitions to
`status: shipped` + `human_review_status: signed-off` from the user side.
