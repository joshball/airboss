---
title: 'Out of Scope: Cert Dashboard'
product: study
feature: cert-dashboard
type: out-of-scope
status: unread
---

# Out of Scope: Cert Dashboard

Deferred items, why they're deferred, and the trigger that should make us
revisit each. Future agents and humans: do not build these without the
documented trigger. If you think the trigger is hit, surface it for a
decision rather than building silently.

## Summary

| Item                                          | Status       | Trigger to revisit                                                              |
| --------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| Goal composition / writing                    | Follow-on WP | Owned by `goal-composer`; this WP only reads `getPrimaryGoal`                   |
| Cross-lens browse                             | Follow-on WP | Owned by `lens-ui`; ships `/lens/...` surfaces                                  |
| Full prereq DAG visualisation                 | Deferred     | When the one-hop snippet feels insufficient for navigation                      |
| Edition diff surface                          | Deferred     | When the FAA publishes a real second ACS edition for an authored credential     |
| ACS / PTS / endorsement authoring             | Follow-on WP | ADR 016 phase 10 transcription work; gated on iterative human content authoring |
| CFI evidence-kind gating UI (chip + filter)   | Deferred     | When the user schedules the follow-on WP; data layer already shipped            |
| Mobile-specific layouts                       | Rejected     | Never -- see detail below                                                       |
| Dedicated task drill page (`/.../tasks/[tc]`) | Deferred     | When one task carries enough content to warrant its own surface                 |

## Goal composition / writing

Status: Follow-on WP

What was deferred:
All goal write paths (create / edit / archive / set-primary). The cert dashboard
reads `getPrimaryGoal(userId)` for default-filtering and never opens a write path
to goals.

Why:
Boundary against the sibling [goal-composer](../goal-composer/spec.md) WP. Cert
dashboard is a read-only consumer of the credential / syllabus / goal data
layer. Mixing goal writes in would entangle two surfaces with different audit
shapes and different validation paths.

Trigger to revisit:
Owned by [goal-composer](../goal-composer/spec.md). That WP launches the
`/goals/...` surface for goal CRUD.

Implementation pattern when triggered:
Follow the boundary table in [design.md](./design.md) "Boundary against sibling
WPs". The goal-composer WP owns all writes; cert dashboard reads only.

References:

- [spec.md "Out of Scope (explicit)"](./spec.md)
- [design.md "Boundary against sibling WPs"](./design.md)
- [docs/work-packages/goal-composer/spec.md](../goal-composer/spec.md)

## Cross-lens browse

Status: Follow-on WP

What was deferred:
The `/lens/...` surfaces -- handbook lens, weakness lens, custom lens, and the
cross-lens browse experience. Cert dashboard is the ACS lens for one credential
only; it does not surface other lenses or cross-lens browsing.

Why:
Per ADR 016, lenses are independent browse surfaces. Cert dashboard renders the
ACS lens scoped to a single credential. The cross-lens browse surface is owned
by a separate WP so each surface keeps a focused composition.

Trigger to revisit:
Owned by [lens-ui](../lens-ui/spec.md). That WP launches `/lens/...`.

Implementation pattern when triggered:
Follow [lens-ui](../lens-ui/spec.md). Cert dashboard already consumes `acsLens`;
the cross-lens surface consumes the other lens projections in the same BC.

References:

- [spec.md "Out of Scope (explicit)"](./spec.md)
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [docs/work-packages/lens-ui/spec.md](../lens-ui/spec.md)

## Full prereq DAG visualisation

Status: Deferred

What was deferred:
A multi-hop DAG visualiser on `/credentials/[slug]`. The detail page shows
immediate prereqs only (one-hop list of `required` + `recommended` kinds with
deep links).

Why:
A one-hop list resolves the immediate "what gates this cert?" question with
minimal UI cost. A full DAG visualiser only earns its keep when the simple list
fails to communicate the structure. Premature graph rendering adds layout
complexity that may never be necessary.

Trigger to revisit:
When the one-hop snippet proves insufficient -- either user testing surfaces
"I can't see the chain" feedback, or a credential's prereq depth grows past two
hops in a way that the one-hop list cannot summarise.

Implementation pattern when triggered:
Build a new component that walks `getCredentialPrereqDag(credentialId)` (already
returns the full structure) and renders it as a graph. Mount on the detail page
behind a disclosure. Keep the one-hop snippet as the default view.

References:

- [spec.md "Out of Scope (explicit)"](./spec.md)
- [design.md "Design principles applied" -- DAG composition row](./design.md)
- [user-stories.md US-future-1](./user-stories.md)

## Edition diff surface

Status: Deferred

What was deferred:
A "what changed between editions" diff viewer. When the FAA publishes a new ACS,
the loader keeps the learner on their pinned edition; there is no in-product
view of the diff between two editions.

Why:
ADR 020 establishes the edition-pin behaviour. A diff surface is only useful
once a real second edition has been authored for at least one credential. At
spec time the seeded slice covers a single edition (PPL ACS Area V), so a diff
viewer has no real data to render.

Trigger to revisit:
When the FAA publishes a second edition for an authored credential (e.g. a new
PPL ACS revision after the seeded edition) and we transcribe it as a peer
syllabus row.

Implementation pattern when triggered:
A new route under `/credentials/[slug]/diff?from=<editionA>&to=<editionB>` that
walks both `getSyllabusTree` projections and renders a tree diff. Citations and
mastery render against the chosen comparison.

References:

- [spec.md "Out of Scope (explicit)"](./spec.md)
- [docs/decisions/020-handbook-edition-and-amendment-policy.md](../../decisions/020-handbook-edition-and-amendment-policy.md)
- [user-stories.md US-future-2](./user-stories.md)

## ACS / PTS / endorsement authoring

Status: Follow-on WP

What was deferred:
Transcription of the remaining credentials' ACS / PTS / endorsement structure
into syllabi rows. The seeded slice covers PPL ACS Area V only. Cert dashboard
renders whatever the BC returns; it does not provide authoring tools and does
not depend on full transcription completing.

Why:
ADR 016 phase 10 names transcription as iterative human content work. Authoring
is its own discipline (consistency, citations, leaf mapping) and is gated on
human content time, not on UI work.

Trigger to revisit:
ADR 016 phase 10 owns this; the follow-on WP launches when authoring of a new
credential's syllabus begins (e.g. the IR ACS or the CFI PTS).

Implementation pattern when triggered:
Follow the existing seeded structure under `course/credentials/` and
`bun run db seed credentials`. The cert dashboard already renders any new
credential whose syllabus rows land.

References:

- [spec.md "Out of Scope (explicit)"](./spec.md)
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md)

## CFI evidence-kind gating UI (chip + filter)

Status: Deferred

What was deferred:
The visible UI for ADR 016 phase 8 evidence-kind gating: a missing-kinds chip
on each leaf row (e.g. "missing S evidence") and an evidence-kind filter on the
area drill. The data layer shipped via
[evidence-kind-gating](../evidence-kind-gating/spec.md) and
`getCredentialMastery` already returns `byEvidenceKind` per area + per
credential; `acsLens` returns `missingKinds` per leaf.

Why:
Per the spec note in "Out of Scope (explicit)": this WP renders the credentials
surface; the evidence-kind gating UI is a follow-on pure-UI addition. Captured
in NOW.md "Up next" to prevent loss.

Trigger to revisit:
When the user schedules the follow-on WP (per the spec note: "spec authoring
when the user schedules it").

Implementation pattern when triggered:
Mount the missing-kinds chip on the leaf row inside the area drill. Add an
evidence-kind filter chip set above the task list, driven by the
`byEvidenceKind` projection already returned by `getCredentialMastery`. Mirror
the filter pattern from the existing mastery-bar render in
[design.md](./design.md).

References:

- [spec.md "Out of Scope (explicit)" -- CFI / instructor-cert evidence-kind gating](./spec.md)
- [docs/work-packages/evidence-kind-gating/spec.md](../evidence-kind-gating/spec.md)
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) (phase 8)

## Mobile-specific layouts

Status: Rejected

What was rejected:
A dedicated mobile layout pass for `/credentials`, `/credentials/[slug]`, and
`/credentials/[slug]/areas/[areaCode]`. Desktop-first per the rest of the study
app.

Why:
Never -- see detail below. The study app is desktop-first as a deliberate
product shape. Cert dashboard inherits that posture; a mobile-specific layout
pass would diverge cert surfaces from the rest of the app and require ongoing
duplicate maintenance. The page composition in [design.md](./design.md) targets
the desktop card grid; mobile responsiveness is implicit in the token system
but not a dedicated design surface.

Trigger to revisit:
Re-decision would require the study app as a whole to shift to mobile-first or
to ship a parallel mobile surface. That is a product-shape change well outside
this WP's scope.

References:

- [spec.md "Out of Scope (explicit)" -- Mobile-specific layouts](./spec.md)
- [design.md "Page composition"](./design.md)

## Dedicated task drill page (`/credentials/[slug]/areas/[areaCode]/tasks/[tc]`)

Status: Deferred

What was deferred:
A dedicated route for a single task within an area. The route constant
`ROUTES.CREDENTIAL_TASK` exists in `libs/constants/src/routes.ts` and is
reserved for a future expansion; the area drill expands tasks inline instead.

Why:
A dedicated task page would only earn its keep when one task carries enough
content to warrant its own surface. At spec time, an inline-expanding task in
the area drill keeps the spine intact and matches the content density that
exists today.

Trigger to revisit:
When a single task accumulates enough authored content (linked nodes,
citations, K/R/S elements, scenarios) that the inline-expanded view becomes
unwieldy on the area drill page.

Implementation pattern when triggered:
The route constant is already reserved. Mirror the area-drill loader pattern
from [tasks.md Phase 3](./tasks.md); narrow the loader from area-level to
task-level and lift the inline-expanded task render onto its own page.

References:

- [design.md "Route shape"](./design.md)
- [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts) (`CREDENTIAL_TASK`)
