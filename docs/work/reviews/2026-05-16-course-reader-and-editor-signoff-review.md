---
title: 'Sign-off Review: Course Reader and Editor'
product: study
feature: course-reader-and-editor
type: review
status: unread
review_status: done
created: 2026-05-16
---

# Sign-off Review: Course Reader and Editor

A pre-sign-off review summary for the `course-reader-and-editor` WP, so Joshua can review and act on `human_review_status` quickly.

## WP name and current status

- WP: `course-reader-and-editor` (`docs/work-packages/course-reader-and-editor/`).
- Frontmatter: `status: draft`, `agent_review_status: pending`, `human_review_status: pending`.
- NOW.md lists it "In flight" with the note `/ball-wp-build` dispatches once human review signs off.

## What `/ball-wp-build` would do next

Nothing useful. The headline finding of this review: the WP is already fully built and merged to main. All nine phases shipped on 2026-05-10 as PRs #767 through #776. Running `/ball-wp-build` against this spec would attempt to re-implement code that already exists. The correct next action is a sign-off decision plus a frontmatter and NOW.md correction, not a build.

## What the WP delivers

A dual UI on top of the `course-primitive` data and lens layer. A study-app reader (`/courses` index, `/courses/[slug]` detail, `/courses/[slug]/[stepCode]` step reader) renders instructor-authored courses for learners, with cert-overlay surfacing when the learner's goal holds a syllabus. A hangar-app editor (`/courses` index, `/courses/[slug]` manifest editor, `/courses/[slug]/sections/[code]` section editor) lets the instructor compose courses by editing YAML files and re-running the seed pipeline. A Courses surface is added to `/program/goals/[id]` so instructor courses thread into a goal alongside syllabi and ad-hoc nodes. The reader honors transition-step rendering, the encoded-text Decode/Understand/Triage tab strip, and a chart-stub embed.

## Readiness assessment

- Spec internally consistent: yes. The spec, tasks (9-phase plan with a parallelization plan), test-plan (54 CRE scenarios), design, user-stories, and OUT-OF-SCOPE.md are all present and coherent with one another.
- Consistent with current code: mostly, with the drift noted below. The libs, routes, and BC helpers the spec references are real and on main.
- tasks.md and test-plan.md complete enough to build from: yes, and in fact already built from. The 9 phases in tasks.md map one-to-one to merged PRs #767-#776.

## Shipped vs pending (PR #769 and the full build)

The prompt for this review flagged PR #769 ("Phase 3 - study reader index + detail") as the only merged piece. That is incomplete. Verified against `gh pr list` and the codebase:

- PR #767 -- Phase 1: BC contract + constants + routes. Merged 2026-05-10.
- PR #768 -- Phase 2: extract `KnowledgeNodeBody`. Merged 2026-05-10.
- PR #769 -- Phase 3: study reader index + detail. Merged 2026-05-10.
- PR #770 -- Phase 4: study step reader page. Merged 2026-05-10.
- PR #772 -- Phase 5: goal composer course tab. Merged 2026-05-10.
- PR #774 -- Phase 6: hangar editor index + course manifest. Merged 2026-05-10.
- PR #775 -- Phase 7: hangar section editor. Merged 2026-05-10.
- PR #776 -- Phase 8: chart-stub refinement. Merged 2026-05-10.
- PR #773 -- a single "build phase" PR carrying all of Phases 1-9 -- was CLOSED (not merged); its work was instead landed as the per-phase PRs above. Phase 9 (docs closeout) content was folded into the per-phase PRs.

Files verified on main:

- Study reader: `apps/study/src/routes/(app)/courses/+page.{server.ts,svelte}`, `.../courses/[slug]/+page.{server.ts,svelte}`, `.../courses/[slug]/[stepCode]/+page.{server.ts,svelte}` plus `PrevNext.svelte` and `Breadcrumbs.svelte`.
- Hangar editor: `apps/hangar/src/routes/(app)/courses/+page.{server.ts,svelte}`, `.../courses/[slug]/+page.{server.ts,svelte}`, `.../courses/[slug]/sections/[code]/+page.{server.ts,svelte}`.
- Components: `CertGapsPanel.svelte`, `CourseStepChart.svelte`, `CourseStepMarkdown.svelte`, `EncodedTextLadderTabs.svelte`, `KnowledgeNodeBody.svelte`, `TransitionStepBody.svelte` (all in `apps/study/src/lib/components/`).
- Constants: `WX_DECODE_PRODUCT_SLUGS` in `libs/constants/src/study.ts:923`, re-exported from `index.ts:888`.
- Goal composer: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts` loads `getCoursesByGoal` + `listCoursesForReader`; `+page.svelte` renders the Courses surface.

Pending: nothing in the code scope. The only genuinely unshipped item is the post-implementation walkthrough (CRE-1 through CRE-54) and the WP closeout housekeeping, both of which are gated on Joshua, not on a build agent.

## Drift found (spec vs code)

1. Goal composer surface is a "block", not a "tab". Spec.md "Goal composer extension" repeatedly describes a "Courses tab next to the existing Syllabi and Ad-hoc nodes tabs" (lines 124-133, and test-plan CRE-11 "Three tabs visible"). The shipped code renders Courses as a `<section class="block">` in `apps/study/src/routes/(app)/program/goals/[id]/+page.svelte:249` (`<h2 id="courses-h">Courses ({courses.length})</h2>`), not a tab. PR #773's body confirms the build deliberately landed a "Courses block". This is a minor UI-shape drift, not a functional gap, but the spec and test-plan CRE-11 wording is now wrong.

2. Spec status frontmatter is stale. `status: draft` and `agent_review_status: pending` no longer reflect reality (the WP is fully built and on main). Per project rules an agent cannot set `status: shipped` (that needs `human_review_status: signed-off` first) and cannot write `human_review_status`. So this drift is expected and is exactly the thing the sign-off resolves: once Joshua walks the test plan and flips `human_review_status`, the `status` transition unblocks.

3. NOW.md is stale. NOW.md line 20 still lists the WP as "In flight" with "Spec status draft pending walkthrough; `/ball-wp-build` dispatches once human review signs off". The build already happened. NOW.md should move this to "Recently shipped" (or a "shipped, awaiting walkthrough" state) once sign-off lands.

4. No `review.md` in the WP directory. tasks.md Phase 9 and PR #773's body both reference a `review.md` / `self-review.md` for the walkthrough. Neither exists in `docs/work-packages/course-reader-and-editor/`. The directory holds only spec, tasks, test-plan, design, user-stories, OUT-OF-SCOPE. The `/ball-review-full` 10-agent pass was explicitly deferred in PR #773's notes ("intentionally deferred -- this build was resumed under a hard worktree-sub-agent constraint"). So the WP shipped without the implementation review tasks.md Phase 9 calls for.

## OUT-OF-SCOPE.md

Already present and complete (`docs/work-packages/course-reader-and-editor/OUT-OF-SCOPE.md`). 14 structured entries with Status (Deferred / Rejected / Follow-on WP) and concrete revisit triggers. No extraction needed. The spec and tasks already point to it with one-line "Out of scope" pointers. Discipline satisfied.

## Open questions the user must resolve before sign-off

1. The code is already on main. Sign-off here is retroactive. Decide: walk the 54-scenario CRE test plan now and then flip `human_review_status`, or accept the shipped state on the strength of `bun run check` + the 17 BC unit tests + 8 hangar unit tests + the e2e specs that PR #773 reported green. The project rule is "nothing merges without a manual test plan" -- it merged without one, so the walkthrough is owed.

2. `/ball-review-full` was deferred during the build. Decide: launch it now against the full course-reader-and-editor surface before sign-off, or accept the build without the 10-agent review. tasks.md Phase 9 and the post-implementation checklist both call for it.

3. Goal composer drift: accept the shipped "Courses block" and correct the spec + test-plan CRE-11 wording, or require the build to be reworked into an actual tab. Recommendation: accept the block (it is a reasonable UI choice and the functional contract is met) and fix the doc wording.

## Recommendation

Sign off after resolving the listed questions. The implementation is complete and on main, `bun run check` is reported clean, and the WP docs are coherent. What is missing is process, not code: the manual walkthrough (CRE-1..54) and the deferred `/ball-review-full` pass. Recommended path: (a) launch `/ball-review-full` on the course-reader surface, fix every finding, (b) walk the CRE test plan, (c) flip `human_review_status`, (d) correct the spec/test-plan goal-composer wording and move the WP out of "In flight" in NOW.md. The spec does not need a structural revision -- only the goal-composer "tab" wording and the stale status fields need correction, and the status fields correct themselves through the normal sign-off transition.
