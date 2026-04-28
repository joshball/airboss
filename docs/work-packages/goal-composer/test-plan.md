---
title: 'Test Plan: Goal Composer'
product: study
feature: goal-composer
type: test-plan
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 9
---

# Test Plan: Goal Composer

Manual walkthrough -- the user runs every step before flipping `status: done`. Per CLAUDE.md "nothing merges without a manual test plan."

## Setup

| Step | Action                                                                                              | Pass criteria                                  |
| ---- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 0.1  | Sign in as Abby (`abby@airboss.test`).                                                              | Dashboard shows Abby's name                    |
| 0.2  | Confirm `bun run db:seed` has run; Abby has at least one seeded primary goal.                        | `getPrimaryGoal(abby.id)` returns a goal       |
| 0.3  | Confirm seeded knowledge nodes cover at least three domains (PPL ACS Area V slice satisfies this).   | `listNodesWithFacets({})` returns >= 50 rows  |

## Index page (`/goals`)

| Step | Action                                                                                                                  | Pass criteria                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1.1  | Navigate to `/goals`.                                                                                                   | Page loads; primary goal pinned at top with a star badge                                     |
| 1.2  | Confirm groupings: Active, Paused, Completed, Abandoned. Counts visible.                                                 | Counts match the DB                                                                          |
| 1.3  | Click the star on a non-primary active goal.                                                                            | Page reloads; star moves to the clicked goal; previous primary unstars                       |
| 1.4  | Click "New goal" CTA.                                                                                                   | Lands on `/goals/new`                                                                        |
| 1.5  | (Empty-state pre-check) Archive every goal Abby owns, refresh `/goals`.                                                  | Hero "Create your first goal" copy renders; all groups collapsed at 0                         |
| 1.6  | Restore Abby's seeded goals.                                                                                            | Groupings and counts return                                                                  |

## Create page (`/goals/new`)

| Step | Action                                                                                              | Pass criteria                                                                                |
| ---- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2.1  | Submit the form with an empty title.                                                                | Inline error: "Title is required" (Zod min(1))                                              |
| 2.2  | Submit with title length 201 chars.                                                                  | Inline error: max length 200                                                                  |
| 2.3  | Submit with a malformed `targetDate` (e.g. `2026-13-01`).                                            | Inline error: calendar-date format                                                            |
| 2.4  | Submit valid: title "PPL Refresh", notes "Reset stick-and-rudder", target `2026-09-01`, primary off. | Redirect to `/goals/<newId>`; goal appears in Active group on `/goals`                        |
| 2.5  | Click Cancel.                                                                                       | Returns to `/goals` with no goal created                                                     |

## Detail read mode (`/goals/[id]`)

| Step | Action                                                                                              | Pass criteria                                                                                |
| ---- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 3.1  | Open the goal created in 2.4.                                                                       | Header renders title, status pill (Active), target date; notes rendered as markdown           |
| 3.2  | Confirm syllabus list and node list both render empty with "Add via Edit" copy.                     | No 0/0 rendering jank                                                                        |
| 3.3  | Click "Make primary".                                                                               | Primary star appears; previous primary unstars                                                |
| 3.4  | Click "Make primary" again on the same goal.                                                        | Inline 400: "This goal is already your primary"                                              |
| 3.5  | Click "Pause".                                                                                      | Status pill reads Paused; goal moves to Paused group on `/goals`                              |
| 3.6  | Click "Resume".                                                                                     | Status pill reads Active                                                                     |
| 3.7  | Click "Archive". Confirm the dialog.                                                                | Goal disappears from list (status moves to Abandoned, hidden by default), redirect to `/goals` |
| 3.8  | Visit `/goals/goal_DOESNOTEXIST`.                                                                   | 404 page                                                                                     |
| 3.9  | Sign in as a second seeded user; visit Abby's goal id directly.                                     | 404 page (ownership leakage prevented)                                                       |

## Detail edit mode (`/goals/[id]?edit=1`)

| Step | Action                                                                                                          | Pass criteria                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 4.1  | Open a goal; click "Edit". URL gains `?edit=1`.                                                                  | Form fields editable; status select visible                                                   |
| 4.2  | Change title; click Save.                                                                                       | URL drops `?edit=1`; new title rendered                                                       |
| 4.3  | Click "Add syllabus"; modal opens with the user's reachable syllabi grouped by credential.                       | Modal lists at least one credential's syllabi                                                 |
| 4.4  | Add a syllabus.                                                                                                 | Row appears in syllabus list with weight 1.0 slider                                          |
| 4.5  | Drag the weight slider to 5.0 and blur.                                                                          | Row weight persists across page refresh                                                       |
| 4.6  | Set the weight to 11.0 via the form (above max). Save.                                                          | Action returns 400; row weight unchanged                                                      |
| 4.7  | Click "Remove" on the syllabus row.                                                                              | Row vanishes; revisiting page confirms removal                                                 |
| 4.8  | Click Cancel from edit mode after editing title.                                                                | Edits discarded; URL drops `?edit=1`                                                          |

## Node picker

| Step | Action                                                                                                          | Pass criteria                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 5.1  | In edit mode, click "Add node". Modal opens.                                                                     | Empty filter chips, empty search box, default result list (debounced)                         |
| 5.2  | Apply a domain filter (e.g. weather).                                                                            | List narrows; result count shown                                                              |
| 5.3  | Apply a cert filter (e.g. PPL).                                                                                  | List narrows further (intersection)                                                           |
| 5.4  | Apply a lifecycle filter (`complete`).                                                                           | Only complete nodes render                                                                    |
| 5.5  | Type "vfr" in search.                                                                                            | List filters by title match (debounced 200 ms)                                                |
| 5.6  | Click "Add" on a node row.                                                                                      | Row flips to disabled (greyed out); node appears in goal's node list under the modal          |
| 5.7  | Try to add the same node again.                                                                                 | Disabled row; no double-insert in DB                                                          |
| 5.8  | Set restrictive filters that match nothing.                                                                     | Empty state copy: "No nodes match these filters"                                              |
| 5.9  | Close the modal; confirm node-list weight slider for the added row.                                              | Slider works identically to syllabus weight slider                                            |

## Help page

| Step | Action                                                            | Pass criteria                                  |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------- |
| 6.1  | Open the help drawer on `/goals`.                                 | "Goals" help page loads; sections visible      |
| 6.2  | Open it on `/goals/new` and `/goals/[id]`.                         | Same help page; section anchors resolve        |
| 6.3  | `bun run check` -- help-id validator passes.                       | "help-id validator: OK"                        |

## Regressions

| Step | Action                                                                                | Pass criteria                                  |
| ---- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 7.1  | Walk `/dashboard`, `/memory`, `/reps`, `/knowledge`, `/credentials`, `/plans`.        | No regressions; styles intact                  |
| 7.2  | Run `bun run check`.                                                                  | 0 errors, 0 warnings                           |
| 7.3  | Run Playwright e2e: `bunx playwright test goal-composer`.                             | All goal-composer tests pass                   |
| 7.4  | Run Vitest BC tests: `bun test goals.test`.                                           | No regressions                                 |

## Sign-off

User sign-off date: ____________
