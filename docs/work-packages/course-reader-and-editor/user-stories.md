---
title: 'User Stories: Course Reader and Editor'
product: study
feature: course-reader-and-editor
type: user-stories
status: unread
---

# User Stories: Course Reader and Editor

User-perspective narratives covering the dual surface this WP ships. Two primary roles (CFI-as-author and learner) plus a few edge personas (anonymous browse, cert-pursuing learner with overlay).

## Reading a course

- As a learner exploring the platform, I want to see all available courses on `/courses` so I can decide what to pick up.
- As a learner pursuing PPL, I want courses in my goal pinned to the top of the index so I don't have to scroll past the rest.
- As a learner who has never set a goal, I want the index to still show me the courses (without mastery indicators) so the surface is useful even before I commit to a goal.
- As a learner opening a course, I want to see the full section/step tree at a glance so I can plan my reading.
- As a learner mid-course, I want each step to show whether I've mastered it or seen it so I can skip ahead to the unfamiliar parts.

## Reading a step

- As a learner reading a step, I want the instructor's framing prose first, then the underlying knowledge node body, so the pedagogy gets to set up the concept before I read the source content.
- As a learner reading a transition step, I want it to look different (no Discover/Practice/Verify scaffolding) so I can tell it's a bridge, not a new concept.
- As a learner reading a METAR/TAF/PIREP node, I want to see the Decode/Understand/Triage skill ladder above the body so I know which rung I'm on (even if the tabs don't filter content yet).
- As a learner reading a step on a chart-related topic, I want a placeholder where the chart will go so I can see the page shape even before charts render.
- As a learner whose linked knowledge node is unfilled (skeleton), I want to see "content authoring in progress" rather than a broken page.

## Cert overlay (PPL/IR/CPL learner)

- As a learner pursuing PPL via the weather course, I want to see at a glance which steps satisfy PPL ACS leaves so I know I'm covering my checkride.
- As a learner pursuing PPL via the weather course, I want to see what the course leaves uncovered (the gap panel) so I know what other study to schedule.
- As a learner pursuing both PPL and IR concurrently, I want the overlay to pick one cert deterministically (the heaviest one) so I get a stable view, knowing I can re-weight if I want to switch.
- As a learner whose goal does not include a cert, I want the course to render without overlay so the page isn't cluttered with information I don't need.
- As a learner whose goal includes a syllabus that the course doesn't touch, I want the overlay to show that clearly (lots of gap entries, few in-cert chips) rather than failing silently.

## Adding courses to a goal

- As a learner with an active goal, I want to add a course to my goal from `/program/goals/[id]` so the course's nodes flow into my session scheduling.
- As a learner, I want to set a weight on my course-in-goal so I can emphasize one course over my syllabus or my ad-hoc nodes.
- As a learner, I want to remove a course I no longer want to pursue without affecting the rest of my goal.
- As a learner, I want the picker to show only active courses so I can't accidentally pick a draft or archived one.
- As a learner who already added a course to my goal, I want the system to refuse a duplicate add gracefully rather than silently double-counting.

## Authoring a course (CFI-as-author)

- As a CFI starting a new course, I want to create it from the hangar UI without dropping to the terminal so the authoring loop is fast.
- As a CFI editing my course, I want my changes to appear immediately on the study reader so I can see what learners will see.
- As a CFI organizing a course, I want to add, reorder, and delete sections from the UI so I can iterate on structure without rewriting YAML by hand.
- As a CFI building a step, I want to pick from existing knowledge nodes via search/filter so I don't have to memorize node slugs.
- As a CFI building a step, I want to write my framing prose (`body_md`) alongside the node selection so the instructor voice and the underlying content stay together.
- As a CFI authoring against a draft course, I want the course hidden from learners until I publish it so I can iterate without exposing half-done work.

## Authoring failures

- As a CFI making a typo (e.g., bad slug, missing knowledge node), I want the editor to reject my save with a clear error and leave the previous version of my work intact.
- As a CFI accidentally creating a duplicate ordinal, I want the seed pipeline's existing rejection to surface in the UI as a form error so I can fix it without leaving the page.
- As a CFI deleting a section, I want to see exactly what becomes orphan in the DB and whether my YAML deletion already cleaned everything up.
- As a CFI looking at orphan data, I want a labeled action to clean it up rather than the system silently deleting rows.

## Browsing without a goal

- As an anonymous-but-curious user (logged in, no goal), I want every course's index entry and detail page to work so I can explore before committing.
- As an anonymous-but-curious user, I want each step's reader page to render so I can read the content without needing to construct a goal first.

## Discovering the surface

- As a CFI new to the hangar, I want `/courses` to be discoverable from the hangar nav (or dashboard) without searching.
- As a learner new to study, I want `/courses` to be discoverable from the study nav (or home page) so I can find authored content alongside my goal-driven study queue.
- As a learner reading a step, I want a way back to the course detail (breadcrumb) so I can navigate the tree without using the back button.

## Mastery and rollup

- As a learner studying a course, I want the per-section mastery rollup to update as I work through cards on its linked nodes so I can see progress accumulating.
- As a learner who already mastered a node before adding the course to my goal, I want that mastery to surface in the course's rollup automatically (the lens reads node-level evidence, not course-level state).
- As a CFI authoring a course, I want the rollup math to be the same one the cert dashboard uses so the numbers I see are the numbers learners see.

## Out-of-band failures

- As a learner who navigated to a step whose linked node was archived, I want to see a graceful "this content is unavailable" surface rather than a broken page.
- As a CFI who deleted a knowledge node that a course step references, I want the delete to be blocked (RESTRICT FK) with an error pointing me at the dependent step.
- As a hangar editor user whose seed run hits a DB outage, I want my YAML edits reverted and an error surfaced so I can retry once the DB is back.

## Negative stories (out of scope, captured for reference)

These belong in the OUT-OF-SCOPE doc, included here so the reader can see the full shape:

- As a CFI, I want to author a personal course for my own use -- deferred per OUT-OF-SCOPE.
- As a CFI, I want to declare prerequisites between my courses -- deferred per OUT-OF-SCOPE.
- As a learner, I want to compare two courses' coverage of PPL ACS side by side -- deferred per OUT-OF-SCOPE.
- As a CFI authoring with a colleague, I want a lock or conflict warning when two of us edit the same course -- deferred per OUT-OF-SCOPE.
- As a learner, I want to pick which syllabus to overlay against from a UI dropdown -- deferred per OUT-OF-SCOPE.
- As a CFI, I want drag-and-drop reordering of steps -- deferred per OUT-OF-SCOPE.
- As a learner, I want the encoded-text Decode/Understand/Triage tabs to actually filter content -- deferred per OUT-OF-SCOPE.
