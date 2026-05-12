---
title: 'Out of Scope: Promote PFD components to libs/activities/pfd/'
product: sim
feature: extract-sim-instruments
type: out-of-scope
status: unread
---

# Out of Scope: Promote PFD components to `libs/activities/pfd/`

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                              | Status   | Trigger to revisit                                                            |
| ------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Promotion of sim's round-dial instruments         | Deferred | When sim's round-dial instruments get a second consumer in another app or lib |
| Visual redesign of PFD components during the move | Rejected | Never -- see detail below                                                     |
| New PFD features during the move                  | Rejected | Never -- see detail below                                                     |

## Promotion of sim's round-dial instruments

Status: Deferred

What was deferred:
Promoting `apps/sim/src/lib/instruments/`, `apps/sim/src/lib/horizon/`, and
`apps/sim/src/lib/panels/` to a shared lib. These ship round-dial visuals (Altimeter, Asi,
AttitudeIndicator, HeadingIndicator, Tachometer, TurnCoordinator, Vsi, Horizon3D,
AnnunciatorStrip).

Why:
Per spec §Out of scope: "They have one consumer (sim) and a different visual language
(round-dial vs. tape glass). Promoting them is a separate decision with its own trigger."
The "create when needed, not before" rule from MULTI_PRODUCT_ARCHITECTURE.md applies: a
one-consumer lib is just an extra import path with no payoff.

Trigger to revisit:
When sim's round-dial instruments get a second consumer in another app or lib. Concrete
examples: a partial-panel scan trainer in study that reuses the round-dial Altimeter, a
new FIRC-era surface that wants the round-dial visual language, or a "classic six-pack"
study activity.

Implementation pattern when triggered:
Mirror the PFD promotion that shipped 2026-04-29 in PR #328. `git mv` from
`apps/sim/src/lib/instruments/` to `libs/activities/src/instruments/`. Extend the existing
`@ab/activities` package; consumers import direct component paths via
`@ab/activities/instruments/Altimeter.svelte`. Rewire imports in `apps/sim/`. Add the
`@ab/activities` alias to the second consumer's `svelte.config.js`.

References:

- [spec.md §Out of scope](./spec.md)
- [spec.md §Shipped](./spec.md) -- the PFD promotion pattern to mirror
- [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- "create when needed, not before"

## Visual redesign of PFD components during the move

Status: Rejected

What was rejected:
Any visual redesign of the PFD components as part of the promotion to `libs/activities/pfd/`.
Components shipped as-is.

Why:
Per spec §Out of scope: "No redesign. The components ship as-is; visual changes are a
downstream WP if needed." Promotion is a mechanical move (relocate + import-rewrite);
mixing in redesign blurs the WP's purpose, complicates review, and risks breaking the
existing consumer (avionics PFD demo).

References:

- [spec.md §Out of scope](./spec.md)

## New PFD features during the move

Status: Rejected

What was rejected:
Any new PFD features added during the promotion.

Why:
Per spec §Out of scope: "This is move-and-rewire only." Same reasoning as visual redesign:
the WP's contract is mechanical promotion. Feature additions land in follow-up WPs against
the promoted lib.

References:

- [spec.md §Out of scope](./spec.md)
