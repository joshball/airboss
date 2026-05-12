---
title: 'Out of Scope: Engine Goal Cutover'
product: study
feature: engine-goal-cutover
type: out-of-scope
status: unread
---

# Out of Scope: Engine Goal Cutover

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

## Summary

| Item                                         | Status       | Trigger to revisit                                                    |
| -------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| Goal composer page changes                   | Rejected     | Never -- see detail below                                             |
| Cert dashboard changes                       | Rejected     | Never -- see detail below                                             |
| Lens implementations beyond ACS + Domain     | Deferred     | When a third lens (e.g. PTS, syllabus-specific) is specced            |
| Dropping `study_plan` entirely               | Rejected     | Never -- see detail below                                             |
| Multi-goal weighted targeting                | Follow-on WP | When the cert dashboard surfaces per-goal session time as a user need |
| Per-leaf evidence-kind gating                | Follow-on WP | Tracked in the parallel `evidence-kind-gating` WP                     |
| Audit trail of plan-to-goal sync events      | Rejected     | Never -- see detail below                                             |
| Backfill of `cert_goals` from goal post-drop | Rejected     | Never -- see detail below                                             |

## Goal composer page changes

Status: Rejected

What was rejected:
Any changes to the goal composer page UI (`apps/study/src/routes/(app)/goals/...`) as part of this WP.

Why:
PR #324 already shipped primary-goal designation. This WP consumes the goal model; it does not extend or modify the composer UI. Conflating two changes would mix targeting cutover with composer surface work and complicate review.

References:

- [spec.md](./spec.md) Out of Scope item 1
- [Goal Composer spec](../goal-composer/spec.md) (PR #324)

## Cert dashboard changes

Status: Rejected

What was rejected:
Any changes to the cert dashboard (`apps/study/src/routes/(app)/credentials/...`) as part of this WP.

Why:
PR #321 already reads from goals via the cert-syllabus BC. The dashboard's read path is independent of the engine targeting read path; no work is needed here.

References:

- [spec.md](./spec.md) Out of Scope item 2
- [Cert Dashboard spec](../cert-dashboard/spec.md) (PR #321)

## Lens implementations beyond ACS + Domain

Status: Deferred

What was deferred:
Adding new lenses (e.g. PTS lens, syllabus-specific lens) to `libs/bc/study/src/lenses.ts`.

Why:
ACS lens + Domain lens are the only implemented lenses today. The engine cutover does not depend on, and does not introduce, additional lenses. Scope is the targeting helper and its consumers, not the lens taxonomy.

Trigger to revisit:
When a third lens is specced (likely candidates: PTS lens, syllabus-specific lens for FIRC or part 141 syllabi). Each new lens triggers its own WP that includes goal-aware targeting if relevant.

Implementation pattern when triggered:
Mirror `acsLens` and `domainLens` in `libs/bc/study/src/lenses.ts`. New lenses consume `getEngineTargeting()` if they need the same goal-derived filter set.

References:

- [spec.md](./spec.md) Out of Scope item 3
- [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md)

## Dropping `study_plan` entirely

Status: Rejected

What was rejected:
Removing the `study_plan` table.

Why:
`study_plan` is still load-bearing for `session_length`, `default_mode`, `depth_preference`, `focus_domains`, `skip_domains`, `skip_nodes`. Only `cert_goals` is targeted for removal in this WP. The plan continues to model "session shape preferences"; the goal models "what the learner is pursuing." See ADR 016 phase 6 for why the split survives.

A future cleanup may revisit whether `focus_domains` / `skip_domains` / `skip_nodes` should also live on the goal (since they were copied there by this WP's migration), but that would be a separate scoped decision -- not "drop study_plan."

References:

- [spec.md](./spec.md) Out of Scope item 4
- [design.md](./design.md) "Session shape vs learner intent" section
- [ADR 016 phase 6](../../decisions/016-cert-syllabus-goal-model/decision.md)

## Multi-goal weighted targeting

Status: Follow-on WP

What was deferred:
Engine targeting that reads from multiple active goals (rather than only the primary goal) and weights session content across them.

Why:
The engine reads the primary goal only. A learner with two active goals gets the primary; secondary actives have no engine effect this WP. Multi-goal weighting is a separate design problem: how to allocate session time across goals, what disagreement rules apply when two goals' targeting conflicts.

Trigger to revisit:
When the cert dashboard surfaces per-goal session time as a user need, or when more than one user requests "split my session between goal A and goal B."

Implementation pattern when triggered:
The `EngineTargeting` type lives in `libs/bc/study/src/engine-targeting.ts`. Multi-goal becomes a different return shape on the same helper (e.g. `weightedCerts: Array<{ cert: Cert; weight: number }>`). The engine pickers' contract is the resolved cert/domain/node lists; the abstraction holds. Author a new WP via `/ball-wp-spec`.

References:

- [spec.md](./spec.md) Out of Scope item 5
- [spec.md](./spec.md) Risks table -- "Multi-goal future work requires a different targeting shape (weighted union)"

## Per-leaf evidence-kind gating

Status: Follow-on WP

What was deferred:
ADR 016's "S leaves require scenario evidence" rule and the broader per-evidence-kind gating of leaf mastery.

Why:
Evidence-kind gating is a separate engine and rollup improvement, parallel to the targeting cutover. Both touch the goal model but address different consumers (one is "which scenarios appear in the session," the other is "is this leaf mastered").

Trigger to revisit:
Already tracked in the parallel `evidence-kind-gating` WP (PR #361 shipped phase 1; `evidence-kind-data-layer` shipped the substrate; further iterations are tracked in those WPs' own backlogs).

Implementation pattern when triggered:
Follow the WP at [`docs/work-packages/evidence-kind-gating/spec.md`](../evidence-kind-gating/spec.md). Both ship in parallel after sign-off; no coordination needed beyond not stepping on the same `goal` columns.

References:

- [spec.md](./spec.md) Out of Scope item 6
- [evidence-kind-gating spec](../evidence-kind-gating/spec.md)
- [evidence-kind-data-layer spec](../evidence-kind-data-layer/spec.md)

## Audit trail of plan-to-goal sync events

Status: Rejected

What was rejected:
A new `audit_log` event type for plan-to-goal sync writes during the write-through window.

Why:
If Open Question (a) lands as "plan UI writes through to goal," each write creates an `audit_log` entry per existing audit conventions. The audit shape is unchanged from prior plan-edit logging; no new event types are introduced. Adding a bespoke audit event type for sync would be schema churn for transient observability already covered by the dual-read window's structured logger telemetry (Open Question (c)).

References:

- [spec.md](./spec.md) Out of Scope item 7
- [spec.md](./spec.md) Open Question (a) -- write-through resolution
- [spec.md](./spec.md) Open Question (c) -- telemetry mechanism

## Backfill of `cert_goals` from goal post-drop

Status: Rejected

What was rejected:
Any path that re-populates `study_plan.cert_goals` after the column is dropped.

Why:
The migration is one-way. A learner who creates a `study_plan` after the drop never has a `cert_goals` slot to fill; their targeting comes from the goal, full stop. Reintroducing a column-shaped projection would resurrect the duplicated-state problem this WP exists to retire.

References:

- [spec.md](./spec.md) Out of Scope item 8
- [spec.md](./spec.md) Phase 9 -- column drop migration is forward-only
