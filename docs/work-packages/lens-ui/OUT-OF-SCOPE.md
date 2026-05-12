---
title: 'Out of Scope: Lens UI'
product: study
feature: lens-ui
type: out-of-scope
status: unread
---

# Out of Scope: Lens UI

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                    | Status       | Trigger to revisit                                                          |
| ------------------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| ACS lens UI                                             | Follow-on WP | Already in flight in `wp/cert-dashboard`                                    |
| Domain lens UI                                          | Deferred     | When cert-dashboard or lens-ui shows the domain rollup is missing somewhere |
| Bloom / phase-of-flight / custom lenses                 | Deferred     | When ADR 016 phase 9 (or later) prioritizes one of these                    |
| Weakness BC additions beyond `getWeakNodes`             | Rejected     | Never -- see detail below                                                   |
| Goal-driven filters on either lens                      | Follow-on WP | When `goal-composer` ships AND both surfaces are live                       |
| Cross-lens deep-linking (handbook -> ACS for same node) | Deferred     | When both surfaces are live and the user reports jump-pattern needs         |
| In-page edition diff (PHAK 25B vs 25C)                  | Deferred     | When edition rollover produces an actual diff use case                      |

## ACS lens UI

Status: Follow-on WP

What was deferred:
The ACS lens page-level surface at `/credentials/[slug]/...` -- the
ACS lens scoped to one credential.

Why:
Sibling-WP boundary. `wp/cert-dashboard` owns `/credentials/...`; this
WP owns `/lens/...` only. The lens framework's `acsLens` BC function
already exists and is consumed by cert-dashboard, not here.

Trigger to revisit:
Already in flight: see `wp/cert-dashboard`.

Implementation pattern when triggered:
See `docs/work-packages/cert-dashboard/` (sibling WP). The lens
framework data layer is shared (PR #254); the picker UI built here
links into `/credentials` for the ACS-kind entry.

References:

- [spec.md](./spec.md) "In Scope" #6 -- lens picker links into `/credentials`
- [ADR 016 -- Cert, Syllabus, Goal, Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md) phase 8

## Domain lens UI

Status: Deferred

What was deferred:
A page-level surface for the domain lens (rolling up nodes by domain
through the lens framework primitives).

Why:
The `domainLens` BC already exists (PR #254). Building the UI now
without evidence that users hit the gap is speculative. Either
cert-dashboard or lens-ui will surface whether the domain rollup is
missing from a flow users actually land in.

Trigger to revisit:
Cert-dashboard or this WP demonstrates the domain rollup is missing
from somewhere users actually land (e.g., user asks "where is the
domain view of my progress?").

Implementation pattern when triggered:
Mirror the handbook / weakness lens routes in this WP:
`/lens/domain[/<domain>]` consuming `domainLens` + `computeMasteryRollup`.
Add `ROUTES.LENS_DOMAIN` + `ROUTES.LENS_DOMAIN_BUCKET(domain)`.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" -- original deferral note
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) phase 8 row
- `libs/bc/study/src/lenses.ts` -- existing `domainLens` BC

## Bloom / phase-of-flight / custom lenses

Status: Deferred

What was deferred:
UI surfaces for the Bloom-level lens, phase-of-flight lens, and any
user-defined / custom lenses.

Why:
ADR 016 phase 8 types these but does not implement them. Building a UI
ahead of the BC implementation produces nothing renderable; building
the BC ahead of a clear use case wastes design budget.

Trigger to revisit:
ADR 016 phase 9 (or later) prioritizes one of these lens kinds for
implementation.

Implementation pattern when triggered:
First land the BC implementation (mirror `acsLens` /
`handbookLens` shape in `libs/bc/study/src/lenses.ts`). Then add
routes `/lens/bloom`, `/lens/phase`, etc. The LensPicker already
reads from `LENS_KINDS` and will surface them automatically once the
constant lists them.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" -- original deferral note
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) phase 8 -- "typed but unimplemented"

## Weakness BC additions beyond `getWeakNodes`

Status: Rejected

What was rejected:
Any calibration-math changes, new weakness score formulas, or new
persistence tables beyond the `getWeakNodes` function this WP adds.

Why:
ADR 016 phase 8's mandate is "render the existing weakness signal
through a new lens UI." Adding new math or new persistence in the same
WP conflates the surface decision with a modeling decision, and the
existing rep / card / calibration signals already supply the four
reason kinds the weakness lens needs.

Trigger to revisit:
Never within this WP. A separate WP could revisit the weakness model
itself (new signals, new persistence, new scoring) if the four-signal
formula proves insufficient.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" -- original deferral note
- [spec.md](./spec.md) "BC functions to add" -- the explicit scope (only `getWeakNodes`)

## Goal-driven filters on either lens

Status: Follow-on WP

What was deferred:
A filter like "show me weak nodes only inside my active goal" on the
weakness lens, or "highlight handbook sections inside my active goal"
on the handbook lens.

Why:
Belongs to the `goal-composer` WP. Goal-driven filters need an active
goal model, which goal-composer owns. Wiring filters before the goal
model is shipped would either inline a fake goal concept or stub the
filter UI.

Trigger to revisit:
`goal-composer` has shipped (`/goals/...` surface live) AND both lens
surfaces (this WP + cert-dashboard) are live.

Implementation pattern when triggered:
A `?goal=<slug>` query string on each lens route. The BC functions
gain a `goalId?` parameter that scopes the candidate set; the URL
state is preserved by the LensPicker per its picker-preserves-query
behavior.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" -- original deferral note
- `wp/goal-composer` (sibling branch, not yet on main)

## Cross-lens deep-linking

Status: Deferred

What was deferred:
Deep links between lenses for the same underlying node (e.g., from a
handbook lens chapter view, jump directly to the ACS lens for the
node that cites this section).

Why:
Speculative without evidence of the actual jump patterns. Adding deep
links before both surfaces are live produces guesses about which
edges are common; adding them later from real usage produces correct
edges.

Trigger to revisit:
Both surfaces are live AND the user reports a specific jump pattern
("when I see X here, I always want to go to Y over there").

Implementation pattern when triggered:
Add the cross-link button on the source surface; the target surface's
route already accepts the node ID. The LensPicker query-state
preservation is the mechanical primitive.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" -- original deferral note

## In-page edition diff (PHAK 25B vs 25C)

Status: Deferred

What was deferred:
A view that compares two editions of the same handbook section side
by side ("what changed between PHAK 25B and 25C in Chapter 12").

Why:
This is ADR 020 territory (handbook edition + amendment policy), not
lens-ui. The edition pinning banner this WP renders is the surface
ADR 020 needs from the lens; the diff view itself is a separate
feature.

Trigger to revisit:
A handbook edition rolls over AND the user wants to see the diff
between editions in-product (rather than via external tooling).

Implementation pattern when triggered:
A dedicated `/handbook/<doc>/diff?from=<edition>&to=<edition>` route
under the handbook reader, not under `/lens/`. ADR 020 supplies the
section alias model that makes the diff possible.

References:

- [spec.md](./spec.md) "Out of Scope (explicit)" -- original deferral note
- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md)
