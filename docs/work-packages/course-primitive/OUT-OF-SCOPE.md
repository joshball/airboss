---
title: 'Out of Scope: Course Primitive'
product: study
feature: course-primitive
type: out-of-scope
status: unread
---

# Out of Scope: Course Primitive

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope + the "Out of scope" section of [tasks.md](./tasks.md). The deeper rationale lives in [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) (especially "Refinement: Course as a peer primitive (2026-05-08)") and [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 11.

## Summary

| Item                                       | Status   | Trigger to revisit                                                  |
| ------------------------------------------ | -------- | ------------------------------------------------------------------- |
| Course-to-course prerequisites             | Deferred | When a second course needs to declare it requires another course    |
| Parallel-ladder schema (track column)      | Deferred | When two authored courses both need parallel tracks per section     |
| Aux course attachment points               | Deferred | When a course needs to attach optional supplements to a step        |
| Per-node opt-out (goal_node_exclusion)     | Deferred | When a learner asks to skip a specific node inside a goal           |
| Course versioning / mutability semantics   | Deferred | When goals start pinning to a course version, or rollback is needed |
| Personal-course authoring UI               | Deferred | When the learner-as-author use case earns its own WP                |
| course.cert_alignment field                | Rejected | Never -- see detail below                                           |
| Course-step UI surfaces                    | Shipped  | course-reader-and-editor WP Phases 1-9                              |
| Custom course-step kind on course_step row | Rejected | Never -- see detail below                                           |

## Course-to-course prerequisites

Status: Deferred

What was deferred:
A `course_prereq` table peer to `credential_prereq` ([libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts), credential prereq block). Would let a course author declare "complete course X before this one." No table, no constants, no BC helper, no UI surface.

Why:
Per [spec.md](./spec.md) Out section and [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) refinement: the MVP shape was deliberately scoped to three tables (`course`, `course_step`, `goal_course`) plus one column extension (`knowledge_node.kind`) plus one overlay lens. Course-to-course prereqs are a real future concern but no authored course exists yet, so the shape of the constraint can't be designed against real use.

Trigger to revisit:
When a second authored course needs to express "complete course X before this one." Likely scenarios: an Instrument Procedures course that expects the Weather course to be done first; a Multi-Engine course that expects the Complex Endorsement course.

Implementation pattern when triggered:
Mirror the credential prereq shape -- composite PK `(course_id, prereq_id)`, `kind` column for `required` / `recommended`, FK CASCADE on the prereq side. Add a lens-layer rule that surfaces unmet prereqs at course-detail render time without blocking access (the goal stays sovereign per principle 11).

References:

- [spec.md](./spec.md) Scope -> Out
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) Refinement section
- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 7 (sequencing is an opinion, not a constraint)

## Parallel-ladder schema (course_step.track column)

Status: Deferred

What was deferred:
A `track` text column on `course_step` to express parallel ladders within a section ("the visual learner track" + "the math-first track" running side-by-side under one section). Tracks remain an authoring convention only -- a course can group steps into a section by ordinal, but the schema does not surface "track A vs track B."

Why:
Per [spec.md](./spec.md) Out section: parallel ladders are a real pedagogy primitive, but the MVP needed to ship without speculative structure. With zero authored courses today, "what would a parallel ladder even look like in a step listing" is a UI question without input data.

Trigger to revisit:
When a single authored course declares two parallel tracks for the same section AND a learner UI flow has been described for picking a track. Both signals together -- the data shape AND the surface -- before the schema column lands.

Implementation pattern when triggered:
Add `track text NULL` to `course_step`. Update the Zod step schema with an optional `track` field. Update `courseLens` to group leaves by `track` within each section. Update the YAML authoring shape: each step inline gets an optional `track:` field. Backfill is unnecessary -- NULL means "no track" and renders as today.

References:

- [spec.md](./spec.md) Scope -> Out
- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 6 (multiple lenses)

## Aux course attachment points

Status: Deferred

What was deferred:
A `course_aux_link` table that lets a step attach optional supplements (a recommended scenario, an optional reading, a "want more depth?" link). The MVP step has exactly one `knowledge_node_id`; aux content is not modeled.

Why:
Per [spec.md](./spec.md) Out section: an unbounded attachment table is too easy to misuse as a dumping ground. With no authored course showing the pattern, there's no shape to design against. The right MVP is "one step = one node; do anything else through the node body."

Trigger to revisit:
When an authored course needs to surface optional supplements on a step (e.g., "for the math-curious, here's the derivation in PHAK Ch 12") AND the step body markdown is not the right place for it (because it disrupts reading flow or because the supplement is an existing object like a scenario or a card).

Implementation pattern when triggered:
Mirror `syllabus_node_link` -- a join table `(course_step_id, knowledge_node_id, kind)` where `kind` is in a small enum (`required` / `aux` / `transition`). Update `courseLens` to surface aux nodes as a separate field per leaf. Update the YAML step schema with an optional `aux:` array.

References:

- [spec.md](./spec.md) Scope -> Out
- [course-primitive design.md](./design.md) Two-level course tree decision

## Per-node opt-out (goal_node_exclusion)

Status: Deferred

What was deferred:
A `goal_node_exclusion` table that lets a learner say "this node is in my goal's reachable set, but I'm choosing to skip it." The MVP goal is purely additive: nodes come in via syllabus, course, or ad-hoc; nothing comes out except by removing the upstream link.

Why:
Per [spec.md](./spec.md) Out section and [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 4: the goal is the learner's union, but exclusion is a different operation than inclusion. With no authored goals expressing exclusion needs (the user's own goal is monotone -- everything in scope is in scope), there's no shape to design for.

Trigger to revisit:
When a learner explicitly asks "I want to remove node X from my goal's scheduling pool while keeping syllabus / course / ad-hoc link active" AND the use case is not covered by simply removing the upstream link. (Example: "I'm pursuing PPL but I have a current Instrument rating, so I want PPL ACS Area V Task A removed because I already know it.")

Implementation pattern when triggered:
A simple table `goal_node_exclusion (goal_id, knowledge_node_id, reason text NULL)` with composite PK. `getGoalNodeUnion` filters out excluded nodes after the union is built. UI: a "skip this node" affordance from the goal detail page or from a card / rep mid-session.

References:

- [spec.md](./spec.md) Scope -> Out
- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 4 (goal is the learner's union)
- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 10 (the system is the learner's)

## Course versioning / mutability semantics

Status: Deferred

What was deferred:
Course versioning fields (`version`, `superseded_by_id`, `mutable`) on `course`. Goals do not pin to a specific course version; every edit to a course is in-place, visible immediately to every learner who holds a `goal_course` row.

Why:
Per [spec.md](./spec.md) Out section and [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) refinement: courses are mutable by design, in contrast to syllabi which are edition-locked. The deferral is the absence of a versioning surface, not a refusal to model mutability. With one user (Joshua) authoring against his own learner state, version-pinning is theoretical.

Trigger to revisit:
When a second author edits a course AND a learner mid-flight needs the pre-edit version preserved. Also: when a course-level editorial change (renaming a section, removing a step) breaks an in-flight learner's experience badly enough that we want a fix.

Implementation pattern when triggered:
Mirror the syllabus edition pattern -- a new `course` row per published version, `superseded_by_id` linking older to newer, goals optionally pin via a nullable `course_version_id` field on `goal_course`. The seed pipeline gains a "publish" semantic (today every edit is a re-seed = re-write).

References:

- [spec.md](./spec.md) Scope -> Out
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) Refinement section ("Course is instructor-authored, mutable")

## Personal-course authoring UI

Status: Deferred

What was deferred:
The UI surface that lets a learner author their own personal course. `COURSE_KINDS.PERSONAL` is reserved as a constant value, but the seed pipeline rejects manifests with `kind: personal` and there is no UI surface to author one. Today, only `COURSE_KINDS.INSTRUCTOR` is authorable.

Why:
Per [spec.md](./spec.md) Out section and [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 11: the chef and the diner are different people. The instructor authors courses; the learner authors goals. A personal course is a learner-authored *thing*-that-looks-like-a-course, which crosses the principle. The reserved value preserves the option to revisit; the deferral is the surface.

Trigger to revisit:
When the user (Joshua, or another learner) explicitly asks for "a course I author for myself" AND we've decided the goal + ad-hoc nodes primitive is not enough to express what they want. The likely shape: a learner curates a sequence of nodes for personal review (e.g., "my checkride prep walking order"), wants the course-shaped UI (sections + steps + body framing), and does not want to publish it as an instructor course.

Implementation pattern when triggered:
Lift the seed-pipeline rejection on `kind: personal`. Add a hangar-style authoring surface inside the study app (NOT the hangar app -- this is learner-authored content) under `/courses/personal/[slug]`. Personal courses are `user_id`-scoped (a column add); the seed pipeline does not touch them; reads / writes go through the BC directly (this would be the first content where the YAML-as-source-of-truth rule does not apply).

References:

- [spec.md](./spec.md) Scope -> Out
- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 11 (the chef and the diner are different people)
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) Refinement section

## course.cert_alignment field

Status: Rejected

What was rejected:
A field (column or join table) on `course` that lets the author declare "this course is aligned to PPL ACS" or "this course teaches CFII PTS Area III." A course author cannot record cert intent on the course row.

Why:
Per [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 11: alignment is the *learner's* goal, not the course author's declaration. The course is a citable artifact; cert overlay is a render-time computation against the learner's `goal_syllabus` rows. Storing alignment on the course pulls the LMS-conflation pattern back in -- "this course is for PPL students" -- which is exactly what the refinement of ADR 016 was designed to reject.

A re-decision would have to clear a high bar: a use case where the course-side declaration produces information that the learner-goal-driven overlay cannot. None has surfaced in spec discussion.

References:

- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 11
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) Refinement section ("Author intent (cert-alignment) is *not* recorded on the course")
- [course-primitive design.md](./design.md) Goal composes course + syllabus + ad-hoc as peers

## Course-step UI surfaces

Status: Shipped (course-reader-and-editor WP, Phases 1-9)

What was postponed:
The actual study-app reader pages (`/courses`, `/courses/[slug]`, `/courses/[slug]/[stepCode]`) and the hangar-app editor pages (`/courses`, `/courses/[slug]`, `/courses/[slug]/sections/[code]`) that sit on top of the BC + lens. The course-primitive WP shipped data, BC helpers, lenses, the YAML pipeline, and the route constants -- but no SvelteKit pages.

Why:
Per [spec.md](./spec.md) Out section: read-only lens output is sufficient for content authoring (the next WP authors weather content directly into YAML). UI is its own concern with its own scope, design tradeoffs, and review surface.

Resolution:
Built by the [course-reader-and-editor](../course-reader-and-editor/spec.md) WP. The follow-on shipped Phases 1-9: study reader (index + detail + step reader with cert-overlay surfaces, encoded-text ladder hints, transition rendering), hangar editor (index + manifest + section + step CRUD with the YAML-as-source-of-truth seed-pipeline integration), Courses block on the goal composer, and a chart stub component. This entry resolves.

References:

- [spec.md](./spec.md) Scope -> Out
- [tasks.md](./tasks.md) Out of scope section
- [course-reader-and-editor/spec.md](../course-reader-and-editor/spec.md) (the follow-on, shipped)

## Custom course-step kind on course_step row

Status: Rejected

What was rejected:
A `kind` text column on `course_step` (separate from `knowledge_node.kind`) that lets one course label a node as "transition" while another course labels it as "concept." The semantic kind is sourced from the linked `knowledge_node.kind` exclusively.

Why:
Per [course-primitive design.md](./design.md) "knowledge_node.kind extension lives on the node, not the step": a node's semantic kind is global. A "transition" node is conceptually a transition regardless of which course references it. Step-level kind would let courses disagree about the same node, which is authoring drift dressed up as flexibility.

A re-decision would have to clear: a use case where the same knowledge node legitimately needs different framing in two different courses, AND the node body markdown + the step body_md framing are insufficient to express the difference. Step-level free-form `framing` text (not an enum) is the lighter response and is itself deferred to "if real authoring surfaces a need."

References:

- [course-primitive design.md](./design.md) Key Decisions table
- [spec.md](./spec.md) Scope -> Out

## Note on `syllabus.kind='school'/'personal'` rows

Not a deferred item, but worth recording: research during the course-primitive WP confirmed zero such rows existed in the seeded data ([SMOKE-RESULTS.md](./SMOKE-RESULTS.md) CRS-20). The diagnostic script `bun run db diagnose:school-personal-syllabi` ships as a guard and remains in the codebase. If non-zero rows surface in the future, the human decides per-row; no automatic migration runs.
