---
title: 'Test Plan: Course Reader and Editor'
product: study
feature: course-reader-and-editor
type: test-plan
status: unread
---

# Test Plan: Course Reader and Editor

Manual walkthrough scenarios that define "done" for [spec.md](./spec.md). Per project rules, nothing merges until Joshua walks every scenario.

Prefix: `CRE` (Course Reader and Editor).

## Setup

- Per-worktree dev DB seeded fresh (the `airboss_wt_<id>` DB).
- The smoke fixture course `seed-smoke` already loaded via `bun run db seed courses --dir course/courses/_fixtures`.
- Abby (`abby@airboss.test`) has at least one active goal and is the dev-seed test user (per project memory `project_abby_dev_seed_user.md`).
- For overlay scenarios: PPL ACS Area I.C is fully linked (course/syllabi/ppl-airplane-acs-6c/areas/01-preflight-preparation.yaml).
- For hangar scenarios: dev login as a user with `AUTHOR` or `OPERATOR` role.

---

## CRE-1: Anonymous (logged-in but no goal) study reader -- index renders

1. Sign in as a fresh dev user with no goals.
2. Navigate to `/courses`.
3. **Expected:** Page renders. The smoke-fixture course appears as a row with title "Seed-Smoke Course Fixture", status "active". Mastery indicator collapses to "no goal" or empty. No errors in the browser console.

## CRE-2: Logged-in user with goal -- index shows mastery

1. As Abby (active goal exists), add the smoke-fixture course to her goal via `/program/goals/[id]` (Courses tab, addCourse action).
2. Navigate to `/courses`.
3. **Expected:** The smoke-fixture course row shows a mastery indicator (e.g. `0 of 2 mastered` for an unstudied course, or matching numbers if she has cards). The course pins to the top of the list because it's in her goal.

## CRE-3: Course detail page -- non-overlay path

1. As Abby, ensure her goal holds the smoke-fixture course but no syllabi (remove syllabi if any).
2. Navigate to `/courses/seed-smoke`.
3. **Expected:** Page renders the course header (title, description, mastery rollup at course level). One section (`Airmass Character (smoke fixture)`) is shown with two leaf steps. No "Cert gaps" panel appears. Each step leaf shows mastery indicator (`unseen` for fresh user). Browser console is clean.

## CRE-4: Course detail page -- overlay path

1. As Abby, add PPL ACS as a goal_syllabus to her goal.
2. Add the smoke-fixture course to her goal.
3. Navigate to `/courses/seed-smoke`.
4. **Expected:** Same tree as CRE-3, plus a "Cert gaps under PPL ACS" panel below the tree showing the PPL ACS leaves not covered by the smoke course. Per-step leaves show a chip strip when the step's linked node is in PPL ACS (the smoke fixture's two steps both link weather nodes that are in PPL ACS Area I.C, so chips like `PPL ACS I.C.K3: Meteorology...` should appear).

## CRE-5: Step reader -- standard step

1. Continuing from CRE-4, click the first step ("Thunderstorm hazards") in the tree.
2. **Expected:** Navigates to `/courses/seed-smoke/s1.1`. Page renders three sections: (a) step framing with breadcrumb "Seed-Smoke Course Fixture / Airmass Character (smoke fixture) / Thunderstorm hazards" and the step body_md; (b) the linked knowledge node body in 7-phase form; (c) cert-overlay chip strip showing the matching PPL ACS leaves.

## CRE-6: Step reader -- transition step rendering

1. As a setup mutation: `UPDATE study.knowledge_node SET kind='transition' WHERE id='wx-icing-types-and-avoidance';` (this is the linked node for the smoke fixture's `s1.2` step).
2. Navigate to `/courses/seed-smoke/s1.2`.
3. **Expected:** Step page renders the step framing as usual, then renders the node body with a "bridge" treatment (visual rule on the left margin, no Discover/Practice/Verify scaffolding). The 7-phase headings are NOT shown.
4. Cleanup: `UPDATE study.knowledge_node SET kind='concept' WHERE id='wx-icing-types-and-avoidance';`.

## CRE-7: Step reader -- encoded-text family rendering

1. Setup: plant a temporary fixture course with one step linking `wx-reading-metars-tafs`. (Or use a real authored course once the weather course is authored.) Re-seed.
2. Navigate to that step.
3. **Expected:** Above the linked-node body, a tab strip with three labels (`Decode`, `Understand`, `Triage`) is shown. Tabs are visual hints; clicking does not change content (deferred per OUT-OF-SCOPE).
4. Cleanup: remove the fixture course.

## CRE-8: Step reader -- empty step body

1. Setup: edit the smoke fixture's `s1.1` step to have `body_md: ''`. Re-seed.
2. Navigate to `/courses/seed-smoke/s1.1`.
3. **Expected:** Step framing block is omitted (no step body_md to render). The knowledge node body still renders as section 2.
4. Cleanup: revert the smoke fixture YAML.

## CRE-9: Step reader -- skeleton linked node

1. Setup: ensure the linked node `wx-thunderstorm-hazards` is at `lifecycle='skeleton'` (or use a fresh skeleton fixture node if the real one is filled in).
2. Navigate to `/courses/seed-smoke/s1.1`.
3. **Expected:** Step framing renders. Below it, a "content authoring in progress" placeholder appears in place of the node body.

## CRE-10: 404 paths -- missing course / step / draft course

1. Navigate to `/courses/does-not-exist`.
2. **Expected:** 404 page renders (or the project's standard not-found surface).
3. Navigate to `/courses/seed-smoke/does-not-exist`.
4. **Expected:** 404.
5. Setup: create a course via hangar editor with `status: draft`. Try to access `/courses/<draft-slug>` as Abby.
6. **Expected:** 404 (drafts hidden from study reader).
7. Cleanup: delete the draft course.

---

## CRE-11: Goal composer -- Courses tab renders

1. As Abby, navigate to `/program/goals/[id]` for her active goal.
2. **Expected:** Three tabs visible: Syllabi, Ad-hoc nodes, Courses. Click Courses.
3. **Expected:** Tab content shows: "courses in goal" list (empty initially or showing previously-added courses); "add course" picker.

## CRE-12: Goal composer -- addCourse

1. From the Courses tab, in the picker, find and select "Seed-Smoke Course Fixture". Submit (default weight = 1.0).
2. **Expected:** Banner: "Course added to goal." Page reloads showing the course in the courses-in-goal list with weight 1.0.

## CRE-13: Goal composer -- addCourse rejects already-in-goal

1. Continuing from CRE-12, try to add the same course again.
2. **Expected:** Banner: error "Course already in goal." No duplicate row.

## CRE-14: Goal composer -- setCourseWeight

1. Continuing from CRE-12, change the course's weight from 1.0 to 2.5 in the input. Submit.
2. **Expected:** Banner: "Weight updated." The list reflects 2.5.

## CRE-15: Goal composer -- setCourseWeight rejects out-of-range

1. Try setting weight to 999.
2. **Expected:** Banner: error "Weight out of range." Server-side validation; the value reverts to the previous valid weight (or stays at 2.5).

## CRE-16: Goal composer -- removeCourse

1. Click "Remove" on the course row.
2. **Expected:** Banner: "Course removed from goal." Course disappears from the courses-in-goal list. Picker shows it again as available.

## CRE-17: Goal composer -- picker filters out drafts

1. Setup: create a course via hangar editor with `status: draft`.
2. As Abby, navigate to the Courses tab on her goal.
3. **Expected:** The draft course does NOT appear in the picker.
4. Cleanup: delete the draft course.

---

## CRE-20: Hangar courses index renders

1. Sign in to hangar as a user with `AUTHOR` role (or higher).
2. Navigate to `/courses` in hangar.
3. **Expected:** Page renders. Smoke-fixture course appears in the table with slug `seed-smoke`, title, status `active`, kind `instructor`, section count `1`, last-updated timestamp, edit + delete actions.

## CRE-21: Hangar new-course flow

1. From `/courses`, click "New course".
2. Fill: slug = `test-hangar-new`, kind = `instructor`, title = `Test Hangar New Course`, description = `Manual test fixture.`, status = `draft`.
3. Submit.
4. **Expected:** Redirects to `/courses/test-hangar-new`. The directory `course/courses/test-hangar-new/manifest.yaml` exists on disk with the form fields. The DB has a matching course row.
5. Cleanup: delete the course (CRE-29).

## CRE-22: Hangar new-course rejects bad slug

1. Try slug `Test_Bad_Slug` (uppercase + underscores).
2. **Expected:** Inline form error: "Slug must match ..."  Server-side rejection if client passes through.
3. Try slug `seed-smoke` (collides with existing).
4. **Expected:** Form error: "Slug already exists."

## CRE-23: Hangar manifest editor -- update

1. From `/courses/test-hangar-new` (created in CRE-21), change title to `Test Hangar Updated`, status to `active`. Save.
2. **Expected:** Banner: "Manifest updated." On disk, `manifest.yaml` reflects the change. DB row reflects the change.

## CRE-24: Hangar manifest editor -- seed reverts on rejection

1. From `/courses/test-hangar-new`, change kind to `personal` via curl/devtools (the form may not expose it; bypass the UI for this test).
2. Submit.
3. **Expected:** Save fails with "course kind 'personal' is reserved; authoring deferred". The YAML on disk is reverted to the pre-save state. DB unchanged.

## CRE-25: Hangar section editor -- addSection

1. From `/courses/test-hangar-new`, click "add section". Fill: code = `s1`, title = `Test Section`, ordinal = `1`. Save.
2. **Expected:** Banner: "Section added." Section appears in the list. On disk, `course/courses/test-hangar-new/sections/s1-test-section.yaml` exists. DB has the section row.

## CRE-26: Hangar step editor -- addStep with knowledge-node picker

1. Navigate to `/courses/test-hangar-new/sections/s1`.
2. Click "add step". In the step form, fill code = `s1.1`, title = `Test Step`, body_md = `Test step body.`, ordinal = `1`. In the knowledge-node picker, type "thunder" -- expect `wx-thunderstorm-hazards` to surface. Select it.
3. Save.
4. **Expected:** Banner: "Step added." Step appears under section s1. YAML reflects + DB has the step row.

## CRE-27: Hangar step editor -- updateStep

1. From the same section editor, click "edit" on s1.1. Change body_md to `Updated body.`. Save.
2. **Expected:** YAML and DB reflect.

## CRE-28: Hangar step editor -- deleteStep

1. Delete s1.1.
2. **Expected:** Banner: "Step deleted." Step disappears from section list. The YAML file is rewritten without s1.1's entry. DB row gone.

## CRE-29: Hangar course delete

1. From `/courses/test-hangar-new` page, click "delete course". Confirm modal.
2. **Expected:** Redirects to `/courses` (hangar index). The directory `course/courses/test-hangar-new/` is gone from disk. The course row is gone from DB.

## CRE-30: Hangar editor -- save reverts on FK violation

1. From `/courses/test-hangar-new` (recreate via CRE-21 if cleaned up), add section + step. Now in the step's YAML on disk (bypass UI), change `knowledge_node_id` to a non-existent id. Trigger a save via the hangar UI (e.g., re-save the section).
2. **Expected:** Save fails with "course step 'X.s1.Y' references missing knowledge_node ...". YAML reverts. DB unchanged.
3. Cleanup: delete the test course.

## CRE-31: Hangar editor -- orphan cleanup surface

1. Plant: a course exists in DB but its YAML is missing (manually delete the section file from disk via terminal). Re-seed via the seed CLI; observe orphan output.
2. Navigate to the course's hangar editor page.
3. **Expected:** Orphan section listed in the "orphans" panel. Click "remove orphans" -> the orphan section row is deleted.

---

## CRE-40: CourseStepChart renders a real chart (component test)

Reconciliation note (2026-05-17): the `<CourseStepChart>` component shipped as a real
SVG renderer, not the originally-scoped placeholder stub, and is not mounted by any
content render path yet (the `:::chart` directive parser is deferred -- see
OUT-OF-SCOPE.md). There is no `?chart=` query param. The component is exercised by its
own unit test.

1. Run the component test: `bun test apps/study/src/lib/components/CourseStepChart.svelte.test.ts`.
2. **Expected:** The test passes. The component renders an `<img>` whose `src` is
   `ROUTES.API_CHART(slug)` (`/api/charts/<slug>/chart.svg`) and a `<figcaption>` showing
   the slug in development mode only.

## CRE-41: Chart endpoint serves SVG bytes

1. With the study app running, request `/api/charts/<a-real-chart-slug>/chart.svg`
   directly (a slug for which `data/charts/wx/<slug>/...` exists on disk).
2. **Expected:** The endpoint returns the SVG bytes with an `image/svg+xml` content type.
   A slug with no chart on disk returns a 404.

---

## CRE-50: bun run check passes

1. Run `bun run check all`.
2. **Expected:** 0 errors, 0 warnings. svelte-check passes for both apps. All Vitest unit tests pass. All Playwright e2e specs pass.

## CRE-51: bun run db seed courses still idempotent after editor edits

1. After CRE-23 / CRE-25 / CRE-26 / CRE-27 saves, run `bun run db seed courses --slug test-hangar-new` from the terminal directly.
2. **Expected:** Output: `seed-courses: 1 scanned (0 written, 1 unchanged), N step rows scanned (0 written, N unchanged)`. The hangar editor's saves produced canonical YAML that matches the seed pipeline's expectation -- no spurious diffs.

## CRE-52: Knowledge node body shared component -- existing knowledge page still works

1. Navigate to `/reference/knowledge/wx-thunderstorm-hazards` (or the equivalent existing knowledge node detail URL).
2. **Expected:** Page renders identically to before this WP's Phase 2 refactor. All 7 phase headings appear. No console errors.

## CRE-53: Cert overlay -- syllabus picker behavior (auto-pick highest weight)

1. Setup: as Abby, plant 2 goal_syllabus rows -- PPL ACS at weight 1.0 and IR ACS at weight 2.0. Plant the smoke-fixture course as goal_course.
2. Navigate to `/courses/seed-smoke`.
3. **Expected:** Cert-gaps panel renders against IR ACS (the higher-weight syllabus), not PPL ACS.
4. Update the weights so PPL is heavier. Reload.
5. **Expected:** Cert-gaps panel switches to PPL ACS.

## CRE-54: Anonymous browse -- detail page renders without overlay

1. As a fresh dev user with no goal, navigate to `/courses/seed-smoke`.
2. **Expected:** Tree renders. Every leaf's mastery is "unseen". No cert-gaps panel.
