---
title: 'Out of Scope: Post-#284 follow-up'
product: platform
feature: post-284-followup
type: out-of-scope
status: unread
---

# Out of Scope: Post-#284 follow-up

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                         | Status       | Trigger to revisit                                              |
| ------------------------------------------------------------ | ------------ | --------------------------------------------------------------- |
| Reviving deferred WPs `extract-sim-instruments`              | Deferred     | The gating trigger documented in that WP fires                  |
| Reviving deferred WP `sim-scenario-table`                    | Deferred     | The gating trigger documented in that WP fires                  |
| New e2e coverage for product surfaces beyond the closed gaps | Follow-on WP | When a new product surface ships and needs its own e2e coverage |

## Reviving `extract-sim-instruments`

Status: Deferred

What was deferred:
Reviving the `extract-sim-instruments` work package as part of this WP.
That WP lives at `docs/work-packages/extract-sim-instruments/` and was
parked with its own gating trigger.

Why:
This WP exists to close the post-consolidation cleanup from PRs
#284 / #285 / #286 / #287 (e2e flakes + verification gaps for the
#279 / #280 / #282 consolidation). It is a focused cleanup pass, not a
re-opening of the deferred sim-extraction backlog. Reviving
`extract-sim-instruments` here would expand scope and miss the trigger
the original WP captured.

Trigger to revisit:
Follow the gating trigger documented inside
`docs/work-packages/extract-sim-instruments/spec.md`. Do not pull this
work back in from this WP's side.

Implementation pattern when triggered:
Reopen the WP at `docs/work-packages/extract-sim-instruments/` and use
its own spec / tasks / test-plan. This WP does not own that pattern.

References:

- `docs/work-packages/extract-sim-instruments/`
- [spec.md](./spec.md) "Out of scope" line about deferred WPs

## Reviving `sim-scenario-table`

Status: Deferred

What was deferred:
Reviving the `sim-scenario-table` work package as part of this WP.
That WP lives at `docs/work-packages/sim-scenario-table/` and was
parked with its own gating trigger.

Why:
Same scope discipline as the `extract-sim-instruments` deferral above.
This WP is the cleanup pass for the closed consolidation PRs; pulling
in a deferred sim-side WP would expand the cleanup into new feature
work.

Trigger to revisit:
Follow the gating trigger documented inside
`docs/work-packages/sim-scenario-table/spec.md`. Do not pull this work
back in from this WP's side.

Implementation pattern when triggered:
Reopen the WP at `docs/work-packages/sim-scenario-table/` and use its
own spec / tasks / test-plan. This WP does not own that pattern.

References:

- `docs/work-packages/sim-scenario-table/`
- [spec.md](./spec.md) "Out of scope" line about deferred WPs

## New e2e coverage for product surfaces beyond the closed gaps

Status: Follow-on WP

What was deferred:
Adding e2e tests for new product surfaces (anything that isn't one of
the four red specs this WP brings green: `theme-fouc.spec.ts`,
`knowledge-learn.spec.ts`, `handbook-reader.spec.ts`).

Why:
This WP is closing existing coverage gaps that were noted but not
executed during the #284 consolidation. Adding new e2e coverage for
new surfaces is a different shape of work (per-surface authoring
exercise, not a flake / regression pass). It belongs in the WP that
ships that surface, or in a focused follow-on WP if a coverage gap is
discovered after the surface ships.

Trigger to revisit:
When a new product surface ships and the WP for that surface either
(a) does not include e2e coverage and the surface is user-visible, or
(b) ships e2e coverage that turns out to be insufficient after live use.

Implementation pattern when triggered:
Author the e2e suite alongside the feature WP that introduces the
surface, mirroring the existing per-surface suites under `tests/e2e/`.
For a focused post-hoc gap-closing pass on an already-shipped surface,
mirror the shape of this WP (a small WP with a short item table, one
PR per gap).

References:

- [spec.md](./spec.md) "Out of scope" line about new product surface
  e2e tests
- `tests/e2e/` (existing per-surface suites)
