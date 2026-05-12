---
title: 'Out of Scope: Promote CockpitPanel to libs/activities/cockpit-panel/'
product: sim
feature: extract-sim-cockpit-panel
type: out-of-scope
status: unread
---

# Out of Scope: Promote `CockpitPanel` to `libs/activities/cockpit-panel/`

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                              | Status       | Trigger to revisit                                                                                       |
| ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| Visual redesign of the cockpit panel              | Rejected     | Never -- see detail below                                                                                |
| Activities lib barrel export                      | Rejected     | Never -- see detail below                                                                                |
| Move of the cockpit-page surround panels          | Deferred     | When any non-sim surface (avionics, instructor station, replay theatre) needs one of the surround panels |
| `ControlInput.svelte` promotion                   | Follow-on WP | When an off-sim surface needs keyboard input bound to FDM-style `inputs`                                 |
| Move of `Horizon3D.svelte` / `ScenarioSurfaceNav` | Deferred     | When a second visual consumer of the 3D horizon or scenario surface nav appears                          |
| Engine / scoring / FDM-worker changes             | Rejected     | Never -- see detail below                                                                                |
| `panel-tick.svelte.ts` easing layer (mirror PFD)  | Deferred     | When a consumer asks for eased gauge motion on the round-dial panel                                      |
| Move `_dev/instruments` gallery into the lib      | Rejected     | Never -- see detail below                                                                                |
| Restructure for hypothetical avionics consumers   | Rejected     | Never -- see detail below                                                                                |
| Round-dial vs. tape style consolidation           | Deferred     | When a future avionics MFD or partial-panel drill surface forces a choice between the two styles         |

## Visual redesign of the cockpit panel

Status: Rejected

What was rejected:
Any visual change to `CockpitPanel.svelte`, the six-pack, the engine cluster, or the annunciator strip during this WP.

Why:
The WP is scoped as a mechanical extraction (relocate + import rewrite), not a redesign. The panel was authored to ADR 015's pure-prop contract; the move preserves byte-for-byte rendering. Mixing a redesign into the extraction would invalidate the "visual diff at every consumer is empty" acceptance criterion and break the `git log --follow` history check.

References:

- [spec.md "Non-goals"](./spec.md)
- [docs/decisions/015-sim-surface-loose-coupling.md](../../decisions/015-sim-surface-loose-coupling.md)

## Activities lib barrel export

Status: Rejected

What was rejected:
A barrel file at `libs/activities/src/index.ts` (or per-package `index.ts` under `cockpit-panel/`) that re-exports the panel and its instruments.

Why:
Match the PFD precedent from PR #328: activities are heavyweight `.svelte` components and consumers import direct subpaths (`@ab/activities/cockpit-panel/CockpitPanel.svelte`). A barrel would force every consumer's bundle to evaluate every component in the package even when only one is needed. The existing `libs/activities/src/index.ts` is prose-only and stays that way.

References:

- [spec.md "Non-goals"](./spec.md)
- [design.md "Import strategy"](./design.md)
- [docs/work-packages/extract-sim-instruments/spec.md](../extract-sim-instruments/spec.md) -- PFD precedent

## Move of the cockpit-page surround panels

Status: Deferred

What was deferred:
Moving `ScenarioStepBanner`, `WxPanel`, `VSpeeds`, `AudioCaptions`, `CockpitNarration`, `KeybindingsHelp`, `KeyboardCheatsheet`, `ResetConfirm`, and the HUD-readout `ControlInputs.svelte` from `apps/sim/src/lib/panels/` to `libs/activities/`.

Why:
These are cockpit-page chrome that wraps the panel; they aren't part of the panel itself. They have only one consumer today (the sim cockpit page). Pulling them along would make the lib a "sim-cockpit-page-in-a-lib," not a reusable panel.

Trigger to revisit:
When a non-sim consumer (avionics, instructor station, replay theatre, partial-panel drill, off-sim debrief) wants one or more of the surround panels. Evaluate per-component at that point.

Implementation pattern when triggered:
Mirror this WP's extraction shape -- direct subpath imports, no barrel, intra-lib relative paths, `git mv` to preserve history. The PFD WP and this WP are the two templates.

References:

- [spec.md "Non-goals"](./spec.md)
- [design.md "Why the cockpit-page surround stays in apps/sim/"](./design.md)

## `ControlInput.svelte` promotion

Status: Follow-on WP

What was deferred:
Promotion of `apps/sim/src/lib/cockpit/ControlInput.svelte` (the keyboard-input host) plus its supporting modules (`control-handler.ts`, `control-ramp.ts`, `tape-store.ts`) to a new package `libs/activities/src/cockpit-controls/`.

Why:
`ControlInput.svelte` already meets ADR 015's loose-coupling contract and has the same three sim consumers as `CockpitPanel`. It is a strong candidate -- but on a different axis (input behaviour vs visual render) with separate boundary questions about which supporting modules travel with it. A separate WP keeps both extractions mechanical and scoped.

Trigger to revisit:
When an off-sim surface (avionics, instructor station, replay theatre) needs keyboard input bound to FDM-style `inputs`. Spawn a follow-on WP at that point.

Implementation pattern when triggered:
Author a new WP at `docs/work-packages/extract-sim-cockpit-controls/` mirroring the shape of this WP. Use `libs/activities/src/cockpit-controls/` as the destination package directory (separate from `cockpit-panel/` so the visual panel and the input host remain independently importable).

References:

- [spec.md "Future work"](./spec.md)
- [design.md "Why ControlInput.svelte stays (for now)"](./design.md)
- [docs/decisions/015-sim-surface-loose-coupling.md](../../decisions/015-sim-surface-loose-coupling.md)

## Move of `Horizon3D.svelte` / `ScenarioSurfaceNav.svelte`

Status: Deferred

What was deferred:
Moving `Horizon3D.svelte` and `ScenarioSurfaceNav.svelte` out of `apps/sim/`.

Why:
Both components have a single visual definition and a single consumer today. The "domain-coupled visual component with multiple monorepo consumers" criterion that justifies `libs/activities/` is not met. No second surface forces the boundary question yet.

Trigger to revisit:
When a second surface (avionics MFD, instructor station, replay theatre, mission planner) wants to render the 3D horizon or the scenario surface nav.

Implementation pattern when triggered:
Mirror this WP and the PFD WP. Evaluate whether `Horizon3D` brings its FDM-truth subscription or stays pure-prop; the answer will dictate whether the move is mechanical (like this WP) or requires a contract refactor first.

References:

- [spec.md "Non-goals"](./spec.md)

## Engine / scoring / FDM-worker changes

Status: Rejected

What was rejected:
Any change to the scenario engine, scoring rubric, or FDM worker during this WP.

Why:
The WP is a pure visual-component extraction. Pages still own the worker; the panel only renders the SNAPSHOT. Touching the worker would expand scope beyond mechanical movement and violate the "zero behaviour change" acceptance criterion.

References:

- [spec.md "Non-goals"](./spec.md)

## `panel-tick.svelte.ts` easing layer

Status: Deferred

What was deferred:
A `panel-tick.svelte.ts` rAF easing layer for the round-dial panel that mirrors `pfd-tick.svelte.ts`.

Why:
The cockpit panel today reads gauges straight off the worker SNAPSHOT with no tick easing. Adding easing is a behaviour change, not an extraction. The WP is scoped zero-behaviour-change, so easing gets its own WP.

Trigger to revisit:
When a consumer (cockpit page, dual, window, future avionics, future partial-panel drill) asks for eased gauge motion on the round dials.

Implementation pattern when triggered:
Mirror `libs/activities/src/pfd/pfd-tick.svelte.ts`. Land in a follow-on WP scoped to "add easing to the cockpit panel," not bundled into a different change.

References:

- [spec.md "Decisions (ratified 2026-04-30)" item 5](./spec.md)
- [design.md cut C](./design.md)

## Move `_dev/instruments` gallery into the lib

Status: Rejected

What was rejected:
Relocating `apps/sim/src/routes/_dev/instruments/+page.svelte` (the dev gallery that renders the round-dial instruments individually) into `libs/activities/`.

Why:
The gallery is a *consumer* of the lib (a developer tool), not part of the lib. Moving dev tooling into a lib confuses the lib's purpose. The gallery stays in `apps/sim/` and rewires its imports to consume from the lib.

References:

- [spec.md "Decisions (ratified 2026-04-30)" item 2](./spec.md)

## Restructure for hypothetical avionics consumers

Status: Rejected

What was rejected:
A flatter or differently-shaped package layout designed for hypothetical future avionics / instructor-station consumers.

Why:
Don't design for unknown future consumers. Instruments remain individually importable at `@ab/activities/cockpit-panel/Asi.svelte` (etc.); future surfaces can pull them granularly without a restructure. Speculative layout work would invent constraints that don't exist.

References:

- [spec.md "Decisions (ratified 2026-04-30)" item 4](./spec.md)

## Round-dial vs. tape style consolidation

Status: Deferred

What was deferred:
Any consolidation between `libs/activities/src/pfd/` (tape-style attitude / airspeed / altitude / heading) and `libs/activities/src/cockpit-panel/` (round-dial six-pack).

Why:
Both styles serve real surfaces today (PFD for glass-cockpit, CockpitPanel for round-dial) and they aren't competing. Consolidation requires a forcing surface that needs to pick between them or render both side-by-side.

Trigger to revisit:
When a future avionics MFD, partial-panel drill, or "swap between glass and round" surface forces a choice between the two styles. Until then, both lib packages coexist.

Implementation pattern when triggered:
Author a new WP that first defines the forcing surface's contract (which style, which props, which truth-source), then evaluates whether the two packages share a common base or remain independent. Do not collapse them speculatively.

References:

- [spec.md "Future work"](./spec.md)
- [docs/work-packages/extract-sim-instruments/spec.md](../extract-sim-instruments/spec.md) -- PFD precedent
