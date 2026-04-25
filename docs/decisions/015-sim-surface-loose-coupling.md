# ADR 015 -- Sim surface loose coupling

**Status:** Accepted
**Date:** 2026-04-25
**Context:** Phase 7 horizon view (apps/sim)

## Problem

The sim app started life as a single cockpit page rendering instruments + receiving control input + dispatching audio cues. Phase 7 introduces a 3D outside-the-cockpit horizon view. We need it to be:

1. **Compositable** -- some scenarios want only the cockpit, some only the horizon, some both side-by-side.
2. **Independently testable** -- a regression in the cockpit must not block the horizon, and vice versa.
3. **Future-proof** -- avionics trainer, instructor station, replay theatre, etc. should all be able to plug the same components in without learning either page's internals.

A monolithic page that grows a `?withHorizon=true` flag would couple the two surfaces forever; one component reaching into the other to read attitude state would create import cycles the moment a third surface lands.

## Decision

**Components are pure-prop, dumb, and surface-agnostic. Pages compose components and own the FDM-worker host.**

| Layer        | Responsibility                                                                                       | Coupling rule |
| ------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Component    | Render. Accept primitives (numbers / radians / SI units) as props. No imports from `@ab/bc-sim`.      | Components do **not** import other components from sibling surfaces. |
| Page         | Host the FDM worker, own the SNAPSHOT subscription, derive component props from `truth` / `display`. | Pages **do not** import other pages. Cross-page links go through `ROUTES`.            |
| Routing      | `ROUTES.SIM_SCENARIO`, `SIM_SCENARIO_HORIZON`, `SIM_SCENARIO_DUAL` -- one route per surface.          | Routes are constants; never inline.           |

`Horizon3D.svelte` takes `{ pitchRadians, rollRadians, headingRadians, altitudeMeters, groundElevationMeters }`. Nothing else. It does not know what produced those numbers; it does not know whether a cockpit is rendering next to it. The cockpit page does not import `Horizon3D`. The horizon page does not import the cockpit. The dual page imports both.

`ScenarioSurfaceNav.svelte` is the single piece of nav glue, keyed by `scenarioId` + `current`. All three pages drop it into their header. Adding a fourth surface (e.g. `/avionics`) means: add one route constant, add one branch in the nav, render the surface as another page. No edits to the existing pages' bodies.

## Consequences

**Today:**

- Three pages exist: cockpit (full controls + audio + gauges), horizon (3D view + small overlay), dual (3D view + minimal instrument strip composed from the same atomic gauge components the cockpit uses).
- Each page spawns its own FDM worker. A user opening cockpit + horizon in two tabs runs two physics loops -- acceptable for now; if it bites, the worker becomes a SharedWorker keyed by scenario id (no API change for the components).

**Follow-up (out of scope for this ADR's PR):**

- The cockpit page is still a fat single-component (~1000 lines: controls, audio cue dispatch, six-pack rendering, scenario-step banner, ...). A future PR should extract `CockpitPanel.svelte` from it -- pure props, the same shape the other gauge components have. Once that lands, the dual page can render the full panel, not just the four primary gauges. The architecture stays identical; only the cockpit page shrinks.
- If a scenario ever wants a horizon page that accepts pilot inputs, the input-handling code factors into a `ControlInput.svelte` host component the same way; the page composes it next to whichever visual surface(s) it wants.

**What this prevents:**

- Components reaching into worker / scenario plumbing.
- "Just one quick import" between cockpit and horizon turning into a coupling spaghetti pile.
- A single-page-with-flags pattern that makes adding the fifth surface a refactor instead of an additive change.
