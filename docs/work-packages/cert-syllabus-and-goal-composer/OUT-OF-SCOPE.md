---
title: 'Out of Scope: Cert, Syllabus, and Goal Composer'
product: study
feature: cert-syllabus-and-goal-composer
type: out-of-scope
status: unread
---

# Out of Scope: Cert, Syllabus, and Goal Composer

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of Scope (explicit)" section of [spec.md](./spec.md). The deeper rationale lives in [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) (phase plan) and [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md).

## Summary

| Item                                                    | Status       | Trigger to revisit                                                        |
| ------------------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| Cert dashboard page rendering                           | Follow-on WP | `cert-dashboard` WP picks up the routes + BC functions                    |
| Personal goal composer page rendering                   | Follow-on WP | `goal-composer` WP picks up the routes + BC functions                     |
| Lens framework UI for non-ACS / non-Domain lenses       | Follow-on WP | `lens-ui` WP ships after cert-dashboard proves the lens primitives        |
| Mastery evidence-kind gating (richer UI surface)        | Follow-on WP | A UI WP composes on `evidence-kind-gating`'s shipped data layer + BC      |
| Full ACS / PTS / endorsement transcription beyond pilot | Deferred     | Iterative human content work after merge (ADR 016 phase 10)               |
| ACS edition diff surface                                | Deferred     | When the FAA publishes a real second edition of any seeded ACS            |
| Multi-tenant goal sharing                               | Deferred     | When more than one human user owns goals AND wants to share one           |
| `study_plan` cutover to read from goals                 | Follow-on WP | `engine-goal-cutover` WP migrates the engine to read goal-derived filters |

## Cert dashboard page rendering

Status: Follow-on WP

What was postponed:
The SvelteKit pages at `/credentials`, `/credentials/[slug]`, and `/credentials/[slug]/areas/[area]`. This WP defines the route constants and ships the BC functions (`getCredentialMastery`, the credential DAG walks, the ACS lens) but no `+page.svelte` files.

Why:
Per [spec.md](./spec.md) Out section: this WP is the data substrate. Page rendering is a separate concern with its own scope, design tradeoffs, and review surface. Bundling page work would balloon the WP and conflate "is the data shape right?" with "is the surface right?".

Trigger that fires the follow-on:
The follow-on WP is `cert-dashboard` (currently in `draft` status at [docs/work-packages/cert-dashboard/spec.md](../cert-dashboard/spec.md)). When the user moves it from draft to in-flight, the BC + lens work this WP shipped becomes the substrate.

Implementation pattern when triggered:
The pages compose on `getCredentialMastery` + the ACS lens. The route constants in `libs/constants/src/routes.ts` already exist. Mirror the existing study-app dashboard page structure for the index + detail + area pages.

References:

- [spec.md](./spec.md) Out of Scope (explicit)
- [docs/work-packages/cert-dashboard/spec.md](../cert-dashboard/spec.md) (the follow-on WP)
- [ADR 016 phase 7](../../decisions/016-cert-syllabus-goal-model/decision.md)

## Personal goal composer page rendering

Status: Follow-on WP

What was postponed:
The SvelteKit pages at `/goals`, `/goals/new`, `/goals/[id]`, and `/goals/[id]/edit`. This WP defines the route constants and ships the BC functions (`createGoal`, `addGoalSyllabus`, `getActiveGoal`, weighted-union resolution) but no `+page.svelte` files.

Why:
Same reasoning as the cert dashboard: this WP is the data substrate. Composer UI is its own surface scope.

Trigger that fires the follow-on:
The follow-on WP is `goal-composer` (currently in `draft` status at [docs/work-packages/goal-composer/spec.md](../goal-composer/spec.md)). When the user moves it from draft to in-flight, the BC functions this WP shipped become the substrate.

Implementation pattern when triggered:
The composer pages compose on the goal BC functions. The route constants already exist. The composer is conceptually a "build a learning plan from one or more syllabi + ad-hoc nodes" form; mirror the existing study-app form patterns for `/goals/new` and `/goals/[id]/edit`.

References:

- [spec.md](./spec.md) Out of Scope (explicit)
- [docs/work-packages/goal-composer/spec.md](../goal-composer/spec.md) (the follow-on WP)
- [ADR 016 phase 9](../../decisions/016-cert-syllabus-goal-model/decision.md)

## Lens framework UI for non-ACS / non-Domain lenses

Status: Follow-on WP

What was postponed:
UI implementations for lenses beyond the two this WP ships (ACS lens, Domain lens). The remaining lens type signatures (handbook, weakness, bloom, phase-of-flight, custom) land in `libs/bc/study/src/lenses.ts` as types only -- no implementations, no UI surfaces.

Why:
Per [spec.md](./spec.md) Out section: lens primitives need to be proven by the cert-dashboard page work before more lens variants are committed to. Building all five non-ACS lenses now would risk building against an unproven lens contract.

Trigger that fires the follow-on:
The follow-on WP is `lens-ui` (currently in `draft` status at [docs/work-packages/lens-ui/spec.md](../lens-ui/spec.md)). It ships after `cert-dashboard` validates the lens primitives in real use.

Implementation pattern when triggered:
Mirror the ACS lens / Domain lens pattern in `libs/bc/study/src/lenses.ts`. Each new lens implements the `Lens` type signature, supplies a render function, and gets exposed via the lens framework UI. UI shape: a lens picker on the cert dashboard or goal detail page that swaps the projection.

References:

- [spec.md](./spec.md) Out of Scope (explicit)
- [docs/work-packages/lens-ui/spec.md](../lens-ui/spec.md) (the follow-on WP)
- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md) principle 6 (multiple lenses)

## Mastery evidence-kind gating (richer UI surface)

Status: Follow-on WP

What was postponed:
Cert-dashboard / goal-composer UI surfaces that consume the per-kind evidence decomposition shipped by `evidence-kind-gating`. The data layer (per-cert triad mapping, `requires_teaching` flag, `isLeafMastered` BC primitive, per-kind decomposition through `getCredentialMastery` / `acsLens` / `domainLens`) lands via the [evidence-kind-gating WP](../evidence-kind-gating/spec.md). The richer UI that displays "you need scenario evidence on this S leaf" is a follow-on UI WP.

Why:
Per [spec.md](./spec.md) Out section: the data shape (`triad`, `assessment_methods`) ships here so the rule can be enforced. The UI that surfaces the gating to the learner is a separate scope -- it depends on cert-dashboard and goal-composer being live so there's a place to show the per-kind state.

Trigger that fires the follow-on:
`cert-dashboard` and `goal-composer` ship, AND the user reports that "all green" rollups hide leaves that are missing scenario evidence (or some equivalent gap-blindness in the UI).

Implementation pattern when triggered:
The UI WP composes on `isLeafMastered` and the per-kind decomposition that `getCredentialMastery` already returns. Surface as a per-leaf badge ("needs scenario evidence") on the cert-dashboard areas page and on the goal-composer leaf list.

References:

- [spec.md](./spec.md) Out of Scope (explicit)
- [docs/work-packages/evidence-kind-gating/spec.md](../evidence-kind-gating/spec.md)
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) (S-leaf-needs-scenario semantics)

## Full ACS / PTS / endorsement transcription beyond the Area V pilot

Status: Deferred

What was deferred:
Transcription of every ACS / PTS / endorsement beyond the PPL ACS Area V pilot (Steep Turns / Steep Spirals / Chandelles, ~24 K/R/S element leaves). This WP ships the YAML schema, validator, seed pipeline, and one Area's worth of authored content as the model-validation pilot. Full PPL / IR / CPL / CFI / CFII / MEI / MEII content authoring is iterative human work after merge.

Why:
Per [spec.md](./spec.md) Out section and ADR 016 phase 10: full transcription is human content work measured in weeks per cert, not engineering work. The WP's job is to prove the schema can hold real content (the pilot does this) and ship the pipeline; bulk authoring follows incrementally.

Trigger to revisit:
Iterative human work, kicked off whenever the user (or another author) commits to transcribing the next cert. There is no software-side trigger -- the engineer's job is done; the author's job continues. The first signal that "the pipeline is wrong" would be if a real PPL transcription run hits a schema constraint that doesn't fit the FAA's structure.

Implementation pattern when triggered:
Use the YAML schema and validator shipped here. Author one Area at a time per cert. The validator catches level-hierarchy violations, dangling links, duplicate codes, parent-child cycles, and `airboss-ref` parse failures.

References:

- [spec.md](./spec.md) Out of Scope (explicit)
- [ADR 016 phase 10](../../decisions/016-cert-syllabus-goal-model/decision.md)
- `course/syllabi/` (the YAML authoring tree this WP creates)

## ACS edition diff surface

Status: Deferred

What was deferred:
A UI / report that shows what changed when the FAA publishes a new edition of an ACS (added leaves, removed leaves, renamed leaves). The data model already supports it (a new `syllabus` row per edition; `goal_syllabus` rows can pin a specific edition or follow the latest), but no diff viewer is built.

Why:
Per [spec.md](./spec.md) Out section: with no real second edition published yet, the diff viewer would be designed against synthetic deltas. The shape of "what authors care about seeing" is unknown until a real edition lands.

Trigger to revisit:
The FAA publishes a real second edition of any seeded ACS publication (PPL, IR, CPL, CFI, CFII, MEI, MEII), AND the user (or another author) needs to migrate transcribed content to the new edition.

Implementation pattern when triggered:
A diff viewer that walks both syllabus trees, matches leaves by `airboss_ref` or `code`, and surfaces added / removed / renamed / re-coded leaves. Surface as a hangar-app page when the new-edition seed runs, or as a one-shot CLI report. The transcription author decides per-leaf whether the goal-pinning rolls forward or stays on the old edition.

References:

- [spec.md](./spec.md) Out of Scope (explicit)
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) (new edition = new `syllabus` row)
- [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md) (edition vs errata semantics)

## Multi-tenant goal sharing

Status: Deferred

What was deferred:
Sharing of goals between users. Goals are per-user; there is no `goal_share` table, no ACL, no "give Bob read access to my IR goal" surface.

Why:
Per [spec.md](./spec.md) Out section: sharing requires auth + ACL design that doesn't exist yet (the platform is single-user / Joshua-only today). Adding sharing primitives now is speculative -- there's no second user to share with.

Trigger to revisit:
At least one of: (a) the platform onboards a second human user with their own goals AND wants to share one with Joshua (or vice versa), or (b) a CFI use case surfaces where the instructor needs to see the student's goal alongside the student's progress.

Implementation pattern when triggered:
A `goal_share` table mapping `(goal_id, shared_with_user_id, role)` where `role` is `viewer | editor | owner`. Auth middleware enforces the share at every BC entry point that takes a `goal_id`. UI: a "share" affordance on the goal detail page.

References:

- [spec.md](./spec.md) Out of Scope (explicit)

## `study_plan` cutover to read from goals

Status: Follow-on WP

What was postponed:
Migration of the session engine to read goal-derived filters and removal of the `study_plan.cert_goals` column. This WP keeps `study_plan.cert_goals` for backwards compatibility; the engine continues to read it. A one-shot script populates `goal` + `goal_syllabus` rows from the existing `cert_goals` arrays so no learner state is lost.

Why:
Per [spec.md](./spec.md) Out section: cutting the engine over in the same WP as the data layer would risk regressing live engine behavior (Joshua's daily reps) on the same PR that introduces a new data model. Splitting the cutover lets the data layer ship first, run alongside the existing engine targeting, and prove correct before the engine reads from it.

Trigger that fires the follow-on:
The follow-on WP is `engine-goal-cutover` (currently `in-flight` at [docs/work-packages/engine-goal-cutover/spec.md](../engine-goal-cutover/spec.md)). It migrates the engine to read goal-derived filters and removes the `cert_goals` column.

Implementation pattern when triggered:
The engine reads the active goal (`getActiveGoal(userId)`) and resolves the union of `goal_syllabus` + `goal_node` rows into the same shape `cert_goals` produced (a flat node set with priorities). After the cutover lands and runs cleanly for a session-engine cycle, drop the `cert_goals` column.

References:

- [spec.md](./spec.md) Out of Scope (explicit)
- [docs/work-packages/engine-goal-cutover/spec.md](../engine-goal-cutover/spec.md) (the follow-on WP)
- [ADR 016 phase 6](../../decisions/016-cert-syllabus-goal-model/decision.md)
