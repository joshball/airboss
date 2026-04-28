---
status: active
trigger: when PFD components have a second consumer (sim glass-cockpit overlay, avionics MFD, or another tape-style instrument page)
note: original trigger ("when apps/avionics/ exists") fired via PRs #291, #294, #297; WP rewritten in PR #292 to track the second-consumer trigger. The lib promotion to `libs/activities/pfd/` has NOT happened yet.
source: 2026-04-27 architecture review
resolved_by: docs/products/avionics/work-packages/avionics-app-scaffold/
---

# Promote PFD components to `libs/activities/pfd/`

## Problem

`apps/avionics/src/lib/pfd/` ships the PFD primitives -- `AttitudeIndicator`, `AirspeedTape`, `AltitudeTape`, `HeadingIndicator`, `VsiIndicator`, plus `pfd-tick.svelte.ts` (rAF loop, critically-damped low-pass) and `airspeed-arcs.ts` (V-speeds -> arc bands). They were built for the avionics surface's PFD demo and currently have exactly one consumer: `apps/avionics/src/routes/pfd/`.

The moment a second consumer appears -- a sim glass-cockpit overlay, an avionics MFD that reuses the tape style, a partial-panel scan trainer that reuses the attitude indicator, or any other tape-style instrument page -- the components belong in a shared lib, not duplicated. `libs/activities/` is the home for domain-coupled visual components (per the monorepo map in [CLAUDE.md](../../../CLAUDE.md)), so the destination is `libs/activities/pfd/`.

This is a **promotion**, not an extraction. The components were authored with a future move in mind: token-driven colours, no app-local imports, props-only inputs. The move is mechanical (relocate + import-rewrite), not a redesign.

## Trigger

Move when -- and only when -- a second consumer materialises. Concrete triggers:

- A sim glass-cockpit overlay needs `AttitudeIndicator` or any tape
- An avionics MFD page wants the tape style for its data fields
- A second tape-style instrument page lands anywhere in the monorepo (study scenario, partial-panel drill, etc.)

Don't pre-promote. The "create when needed, not before" rule from [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) applies to libs as much as to apps; a one-consumer lib is just an extra import path with no payoff.

## Scope (when triggered)

Move from `apps/avionics/src/lib/pfd/` to `libs/activities/pfd/`:

- `AttitudeIndicator.svelte`
- `AirspeedTape.svelte`
- `AltitudeTape.svelte`
- `HeadingIndicator.svelte`
- `VsiIndicator.svelte`
- `Pfd.svelte` (the layout shell)
- `PfdInputs.svelte`, `PfdKeyboardLegend.svelte` (only if the second consumer wants the same input chrome; otherwise these stay in the avionics app)
- `pfd-tick.svelte.ts` (rAF loop + easing)
- `airspeed-arcs.ts` (V-speeds -> arc bands)
- `pfd-types.ts` (view types)

Mechanical work in the new lib:

- New package `libs/activities/pfd/` with `name: '@ab/activities-pfd'` (or extend the existing `@ab/activities` barrel -- match whatever convention is in place at trigger time)
- Re-export the components and types from the package barrel
- Add the alias to every consuming app's `svelte.config.js` and the root `tsconfig.json`
- Rewrite imports in `apps/avionics/` from `$lib/pfd/...` to the new alias

## Out of scope

- Sim's round-dial instruments (`apps/sim/src/lib/instruments/`, `apps/sim/src/lib/horizon/`, `apps/sim/src/lib/panels/`) stay in `apps/sim/`. They have one consumer (sim) and a different visual language (round-dial vs. tape glass). Promoting them is a separate decision with its own trigger.
- No redesign. The components ship as-is; visual changes are a downstream WP if needed.
- No new features. This is move-and-rewire only.

## Resolved by

This WP was previously framed as "extract sim instruments" and deferred until `apps/avionics/` existed. The avionics-app-scaffold WP at [docs/products/avionics/work-packages/avionics-app-scaffold/](../../products/avionics/work-packages/avionics-app-scaffold/) created the avionics app and authored the PFD components fresh in `apps/avionics/src/lib/pfd/`, rather than extracting from sim. That made the original framing obsolete: the components live in avionics now, and sim's round-dial instruments are not the right thing to promote.

This rewrite restates the WP around the new reality: the surface that needs sharing is the PFD set, the destination is `libs/activities/pfd/`, and the trigger is "second consumer materialises", not "avionics app exists".

## Previous framing (superseded)

Kept for history. The original WP, before the avionics app authored its own PFD components, read:

> ### Extract sim instruments to a shared lib
>
> `apps/sim/src/lib/instruments/`, `apps/sim/src/lib/horizon/`, and `apps/sim/src/lib/panels/` ship reusable visual components (Altimeter, Asi, AttitudeIndicator, HeadingIndicator, Tachometer, TurnCoordinator, Vsi, Horizon3D, AnnunciatorStrip, ...). The avionics app on the roadmap will want these.
>
> Move:
>
> - `apps/sim/src/lib/instruments/` -> `libs/avionics-ui/src/instruments/`
> - `apps/sim/src/lib/horizon/` -> `libs/avionics-ui/src/horizon/`
> - relevant `apps/sim/src/lib/panels/` panels -> `libs/avionics-ui/src/panels/`
>
> Both apps consume from the new lib.
>
> Trigger: when `apps/avionics/` is created. Don't pre-extract per the "create when needed, not before" rule.

Why superseded:

- avionics didn't extract from sim; it authored fresh tape-style PFD components in `apps/avionics/src/lib/pfd/` (the round-dial sim instruments are a different visual language)
- the destination `libs/avionics-ui/` was speculative; the actual home for domain-coupled visual components is `libs/activities/`
- the trigger "when `apps/avionics/` is created" fired and was satisfied without any extraction; the real sharing trigger is "second consumer of the PFD set"
