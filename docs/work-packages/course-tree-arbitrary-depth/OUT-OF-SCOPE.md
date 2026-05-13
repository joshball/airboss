---
title: 'Out of Scope: Course Tree -- Arbitrary Depth'
product: platform
feature: course-tree-arbitrary-depth
type: out-of-scope
status: unread
---

# Out of Scope: Course Tree -- Arbitrary Depth

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think a trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope + the "Out of scope" sections of [tasks.md](./tasks.md) and [design.md](./design.md).

## Summary

| Item                                                               | Status       | Trigger to revisit                                                                      |
| ------------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------- |
| Per-row visibility / role gating                                   | Deferred     | When instructor-only or premium-tier sections are needed                                |
| Drag-and-drop tree reordering                                      | Deferred     | When the Hangar course editor WP earns its own slot                                     |
| Multi-course lesson reuse (same lesson in N courses)               | Deferred     | When a real authoring case surfaces (same scenario in PPL + IFR + CFI courses)          |
| Lesson-level cert overlay binding                                  | Rejected     | Never -- see detail below; cert is leaf-only by ADR design                              |
| Collapse / expand UI on the course outline                         | Deferred     | When a single course exceeds ~50 leaves and the outline becomes unwieldy                |
| Per-lesson weight on `course_step` (override `goal_course.weight`) | Deferred     | When real authoring asks for per-lesson emphasis                                        |
| Lesson-as-prerequisite (complete lesson X before Y)                | Deferred     | When sequencing constraints are required (today the order is ordinal-driven, no gating) |
| Hangar UI for authoring lessons                                    | Follow-on WP | When the course-reader-and-editor WP authors a tree editor                              |
| Tree depth > 10                                                    | Rejected     | Never expected -- the cap is defensive; raise if a real pedagogy needs deeper nesting   |

## Per-row visibility / role gating

Status: Deferred

What was deferred:
A `visibility` column on `course_step` (values: `public`, `instructor`, `premium`) that gates which rows render for which learners. A row marked `instructor` only appears for users with the instructor role; everyone else sees the tree with that subtree elided.

Why:
Out of scope for the structural-shape WP. Visibility is a cross-cutting concern that touches identity, auth, and every render surface. Lumping it into a tree-shape WP would expand scope by 5x without serving the unblock requirement.

Trigger to revisit:
When the FIRC content arrives and the instructor-only scenario detail (the "instructor internals" substep is the closest current example) needs to actually be hidden from non-instructor learners. Today the substep is named "instructor internals" but is visible to everyone; the gating is editorial, not platform-enforced.

Owner / next step:
File as a follow-up WP "course-step-visibility-gating" when triggered. Schema, lens, renderer, and route-loader changes all touch.

## Drag-and-drop tree reordering

Status: Deferred

What was deferred:
A Hangar editor UI surface that lets a course author drag lessons + steps between parents, reorder siblings, promote a step to a lesson by adding children, etc. With the underlying schema upsert + content-hash refresh on every drag.

Why:
The Hangar app is scaffolded but the course-reader-and-editor WP is the primary content-editing surface. This WP delivers the data shape; the editor is a separate user-facing feature with its own design + WP.

Trigger to revisit:
When the course-reader-and-editor WP authors a tree editor. At that point the editor needs at minimum: reorder API, parent-move API, level-change API. None exist today; all three are mechanical to add on top of the upsert pipeline.

## Multi-course lesson reuse

Status: Deferred

What was deferred:
A way for the same `lesson` row (or a `lesson_definition` shared row) to appear in multiple courses. E.g., the "Cold Front Passage" scenario lesson appearing in PPL Weather and IFR Procedures courses without duplicate authoring.

Why:
Today every `course_step` row carries `course_id`; a lesson belongs to one course. Reusing the lesson requires either denormalising (duplicate rows under each course; YAML symlink-style) or normalising (a `lesson_definition` table with `course_lesson_link` rows). Both are real shape decisions that need real authoring use-cases to ground the schema.

Trigger to revisit:
When two courses both want the same scenario lesson and the user-zero authoring experience says "I'd rather not maintain two copies." Today there is one course (weather-comprehensive); the question is moot.

## Lesson-level cert overlay binding

Status: Rejected

What was rejected:
A `lesson.cert_node_id` field that pins a lesson directly to a `syllabus_node` (cert leaf). The overlay UI would then show "this lesson satisfies PPL ACS Area V Task B" without aggregating from the lesson's leaves.

Why rejected:
Per [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) principle 11: cert-vs-course overlay is a render-time lens computation, not authored data. The cert binding lives on `knowledge_node` (via `syllabus_node_link.knowledge_node_id`); a course step inherits cert coverage by linking a node that's covered by the cert. A lesson links no node; its cert coverage is the rollup of its leaves' coverage. Making the lesson independently cert-bound would create two sources of truth (the lesson's own binding vs the rollup of its leaves); the two could disagree, and resolving the disagreement at render time is exactly the engineering trap ADR 016 prevented.

Trigger to revisit:
Never expected. The aggregation-from-leaves model is the load-bearing semantic.

## Collapse / expand UI on the course outline

Status: Deferred

What was deferred:
Per-section + per-lesson collapse / expand state on the course landing. Outline initial state is "all expanded"; user clicks a section to collapse / expand. State persists in URL hash or localStorage.

Why:
Today's weather-comprehensive course is 10 sections * ~5 steps = 50 leaves. The WX Scenarios section adds 6 lessons * 4 substeps = 24 leaves. A 74-leaf course outline is well within static-render bounds (no scroll-jank, every leaf visible). Collapse / expand UI adds complexity (state management, keyboard navigation, A11y) for no current benefit.

Trigger to revisit:
When a single course exceeds ~150 leaves AND user testing surfaces "I lose my place in the outline." Until then static is fine.

## Per-lesson weight on `course_step`

Status: Deferred

What was deferred:
A `weight` column on `course_step` that lets the author declare "this lesson is 2x more important than the rest of the section." The lens would multiply leaf weights through the lesson's weight at the rollup step.

Why:
Today the effective weight is `goal_course.weight * 1.0` (per-course, not per-step). The course-primitive WP already deferred this for steps; nothing has changed for lessons. The session engine + relevance cache do not consume per-step weight yet.

Trigger to revisit:
When the session engine's relevance cache layer is generalised to consume per-step weight AND real authoring asks for the override.

## Lesson-as-prerequisite

Status: Deferred

What was deferred:
A `course_step_prereq` table (or columns on `course_step`) that gate "you must complete lesson X before lesson Y appears." The renderer + study-plan layer would skip locked lessons.

Why:
Today there's no gating in the course primitive. Order is ordinal-driven (a soft suggestion), not gated. Adding prerequisites is a real product feature with its own UX questions (what does a locked lesson look like? can the learner peek? how does the cert overlay treat locked content?).

Trigger to revisit:
When pedagogy + product agree that a course needs hard sequencing, not just suggested order.

## Hangar UI for authoring lessons

Status: Follow-on WP

What was deferred:
A Hangar app route for visually authoring a lesson tree. Drag-and-drop, level-change, body_md inline edit, content-hash live preview.

Why:
The course-reader-and-editor WP owns this surface. This WP is structural-shape only; the data shape is what unblocks the next content PRs.

Trigger to revisit:
When the course-reader-and-editor WP authors the editor. Its dependency includes this WP's lens + renderer changes.

## Tree depth > 10

Status: Rejected (defensive only)

What was rejected:
Removing the `COURSE_TREE_MAX_DEPTH = 10` cap or raising it.

Why rejected:
Realistic pedagogy bottoms out around 4-5 levels. A 10-level cap is well clear of any reasonable structure and catches runaway authoring (e.g. an accidental copy-paste bug that produces 50-deep nesting). The cap is a sanity guard, not a constraint on real authoring.

Trigger to revisit:
When a real pedagogy honestly needs 11+ levels. Vanishingly unlikely; if it surfaces, raise the cap, don't remove it.
