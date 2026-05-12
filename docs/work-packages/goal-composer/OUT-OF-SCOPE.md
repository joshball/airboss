---
title: 'Out of Scope: Goal Composer'
product: study
feature: goal-composer
type: out-of-scope
status: unread
---

# Out of Scope: Goal Composer

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                    | Status       | Trigger to revisit                                               |
| --------------------------------------- | ------------ | ---------------------------------------------------------------- |
| Goal collaboration / sharing            | Deferred     | When multi-user CFI / student pairing is on the roadmap          |
| Goal templates                          | Deferred     | When manual composition proves friction in real use              |
| Multi-tenant ACL / org-level goals      | Rejected     | Never -- see detail below                                        |
| Engine cutover to `getGoalNodeUnion`    | Follow-on WP | When goal-composer ships and the engine still reads `study_plan` |
| Derived-cert visualisation              | Deferred     | After the node picker proves out in real use                     |
| Mobile-specific layouts                 | Rejected     | Never -- see detail below                                        |
| Bulk node operations (multi-select add) | Deferred     | When single-add hits friction in real use                        |

## Goal collaboration / sharing

Status: Deferred

What was deferred:
Read-only share links for goals, multi-user goals (two users co-owning a
single `goal` row), or any cross-user goal access. Maps to user story
US-future-2 in `user-stories.md`.

Why:
Per-user only for v1 per the spec. The goal table has a single
`user_id` FK and ownership gates every read / write. Sharing introduces
ACL surface area, permission UX, and the question of "who can edit
weights" that isn't warranted by the current single-user reality.

Trigger to revisit:
When multi-user CFI / student pairing is on the roadmap. A CFI wanting
to compose a goal "for" a student, or two study partners sharing one
goal, are the concrete signals.

Implementation pattern when triggered:
Add `study.goal_member` join table `(goal_id, user_id, role)` where
`role` is `'owner' | 'editor' | 'viewer'`. Replace single-user
ownership gates in `libs/bc/study/src/goals.ts` with role-aware checks.
Mirror the `study.account_role` pattern shipped by the flight-evidence
WP for the same shape. Audit emits one row per membership change.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" item "Goal collaboration / sharing"
- [user-stories.md](./user-stories.md) "US-future-2 -- Goal collaboration / sharing"

## Goal templates

Status: Deferred

What was deferred:
Starter templates ("PPL prep starter," "IR refresh starter") that
pre-populate a new `goal` with a curated syllabus + ad-hoc node set.
Maps to user story US-future-1.

Why:
Manual composition is the v1 muscle. Templates earn their keep after the
picker UX is proven; shipping templates first would hide the picker's
friction points and bias the design toward the templates' specific
shape rather than the general compose flow.

Trigger to revisit:
When manual compose proves friction in real use -- a returning CFI
spending too long building the same PPL-prep goal three times, a new
user lost in the picker, or a pattern emerging across users that begs
to be canonicalized.

Implementation pattern when triggered:
Add a `study.goal_template` table (or seed JSON file -- TBD at decision
time) with `(title, notes_md, syllabus_refs, node_refs)`. New `/goals/new`
view exposes a "Start from a template" option that materializes the
template into a fresh `goal` row plus the appropriate `goal_syllabus` /
`goal_node` rows. Reuses every BC write already shipped by this WP.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" item "Goal templates"
- [user-stories.md](./user-stories.md) "US-future-1 -- Goal templates"

## Multi-tenant ACL / org-level goals

Status: Rejected

What was rejected:
Organization-level goals (a flight school owning a goal that students
inherit), tenant boundaries beyond `user_id`, any ACL model richer than
"the authenticated user owns their data."

Why:
Spec says "No org-level goals. Owner is always the authenticated user."
airboss is not a multi-tenant SaaS; it's a learning platform for
individual pilots. Org-level concepts (admins, tenants, billing
aggregation) would change the fundamental shape of the auth model, the
schema, and the surfaces -- a different product, not an extension of
this one.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" item "Multi-tenant ACL"

## Engine cutover to `getGoalNodeUnion`

Status: Follow-on WP

What was deferred:
Switching the rep engine to read from `getGoalNodeUnion(goalId)` instead
of `study_plan` as the source of "what nodes feed today's reps." Maps
to user story US-future-3.

Why:
The engine still reads `study_plan` to drive rep selection. Routing the
engine through `getGoalNodeUnion` is a substantial cross-BC migration
(touches `libs/bc/study/src/engine.ts`, every rep loader, every
calibration projection) that earned its own phase in the predecessor WP
plan. Ship goal-composer first; cut over once the surface is in real
use and the union shape is proven.

Trigger to revisit:
When goal-composer ships and the engine still reads `study_plan`. The
predecessor WP (cert-syllabus-and-goal-composer) names this as a
follow-on phase in its plan.

Implementation pattern when triggered:
Follow the phase-cut plan in the predecessor WP at
`docs/work-packages/cert-syllabus-and-goal-composer/spec.md`. The engine
reads `getGoalNodeUnion(primaryGoalId)` (already shipped) to compose
its rep candidate set. Calibration projections widen to span the union.
`study_plan` becomes a deprecation candidate at that point.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" item "Engine cutover"
- [user-stories.md](./user-stories.md) "US-future-3 -- Engine cutover"
- [Predecessor WP cert-syllabus-and-goal-composer](../cert-syllabus-and-goal-composer/spec.md)

## Derived-cert visualisation

Status: Deferred

What was deferred:
Rendering "this goal touches X credentials" on the goal detail page --
the inverse projection of `getDerivedCertGoals`. The BC is callable,
the surface is not.

Why:
Deferred until the picker proves out in real use. The forward signal is
"which credentials does this goal advance" -- but until the picker is
in real use, the more important UX question is "is the picker usable
at all." Shipping derived-cert visualisation first would distract design
budget from the picker's actual friction points.

Trigger to revisit:
After the picker proves out in real use. Concrete signal: the user
composing 3+ goals without picker-related complaints, asking "which
certs does this goal advance?"

Implementation pattern when triggered:
Add a "Credentials this advances" panel to `/goals/[id]` that calls
`getDerivedCertGoals(goalId)` on the server, renders the result as a
list of credential badges (reusing the cert-dashboard's badge component).
No new BC functions; the read is already shipped.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" item "Derived-cert visualisation"

## Mobile-specific layouts

Status: Rejected

What was rejected:
Per-route mobile layouts for `/goals`, `/goals/new`, `/goals/[id]`.

Why:
Spec says "Desktop-first per the rest of the study app." The study app
is a desktop-first product (the engine, the calibration surfaces, the
knowledge graph all assume a desktop reading posture). Goal-composer
inherits that posture. Mobile is not "later" -- it's a different product
shape (study-while-commuting, audio-narration drills) handled by the
future `audio/` surface app, not by responsive-styling the goal composer.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" item "Mobile-specific layouts"

## Bulk node operations (multi-select add)

Status: Deferred

What was deferred:
Multi-select add in the node picker -- check N nodes, click "Add 5"
once instead of single-clicking each. Maps to user story US-future-4.

Why:
Single-add per click in v1. Bulk operations add picker complexity
(selection state, partial-failure UX) that earns its keep only when
single-add hits friction. The first build should expose where the
friction actually lives before optimizing speculatively.

Trigger to revisit:
When single-add hits friction in real use. A user adding 10+ nodes per
goal in a row, or repeatedly bouncing between the picker and the detail
view to add nodes one at a time, are the signals.

Implementation pattern when triggered:
Extend the node picker (modal with filter chips + search per Decision
1) to maintain a `selected[]` state. "Add N" button fires
`addGoalNode` per selected node in sequence (or a future
`addGoalNodes` batch BC write). Errors per node surface inline; the
picker stays open so the user can retry. No schema change.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" item "Bulk node operations"
- [user-stories.md](./user-stories.md) "US-future-4 -- Bulk node operations"
