---
status: active
trigger: fired -- CockpitPanel has three sim consumers (cockpit, dual, window) and is the natural surface to share with future avionics / instructor / replay-theatre pages
source: ADR 015 follow-up note
related:
  - docs/decisions/015-sim-surface-loose-coupling.md
  - docs/work-packages/extract-sim-instruments/spec.md (PFD precedent, shipped 2026-04-29 in PR #328)
---

# Promote `CockpitPanel` to `libs/activities/cockpit-panel/`

## Problem

`apps/sim/src/lib/cockpit/CockpitPanel.svelte` ships the round-dial six-pack + tach + engine cluster + annunciator strip. ADR 015 already factored it out of the fat cockpit page; today it has three sim consumers:

- `apps/sim/src/routes/[scenarioId]/+page.svelte` (cockpit / instructional surround)
- `apps/sim/src/routes/[scenarioId]/dual/+page.svelte` (3D horizon + full panel side-by-side)
- `apps/sim/src/routes/[scenarioId]/window/+page.svelte` (3D horizon + panel overlay HUD)

The PFD set hit the same shape and was promoted to `libs/activities/src/pfd/` in PR #328 (see `extract-sim-instruments` WP). This WP applies the same precedent to the round-dial cockpit panel: domain-coupled visual component, multiple consumers in the monorepo, no app-local imports needed -> `libs/activities/` is its home.

This is a **promotion**, not a rewrite. `CockpitPanel.svelte` was authored to ADR 015's contract: pure-prop, takes `truth` + `display` primitives off the worker SNAPSHOT, no scenario / worker / audio / keyboard imports. The move is mechanical (relocate + import-rewrite), not a redesign.

## Goals

- Single home for the round-dial cockpit panel: `libs/activities/src/cockpit-panel/`.
- All three current sim consumers import from `@ab/activities/cockpit-panel/CockpitPanel.svelte`.
- Zero behaviour change. Visual diff at every consumer is empty.
- History preserved via `git mv` for every relocated file.
- Future surfaces (avionics, instructor station, replay theatre, partial-panel drill) can pull the panel without touching `apps/sim/`.

## Non-goals

- **No redesign.** The panel ships as-is. Visual changes are a downstream WP if needed.
- **No barrel export.** Match the PFD precedent: consumers import direct component paths via `@ab/activities/cockpit-panel/CockpitPanel.svelte`. `libs/activities/src/index.ts` stays prose-only.
- **No move of the cockpit page surround.** `ScenarioStepBanner`, `WxPanel`, `VSpeeds`, `AudioCaptions`, `CockpitNarration`, `KeybindingsHelp`, `KeyboardCheatsheet`, `ResetConfirm`, `ControlInputs` (HUD readout) stay in `apps/sim/src/lib/panels/`. They are the cockpit-page chrome, not the panel itself.
- **No move of `ControlInput.svelte`.** The keyboard-input host is a separate concern and a separate ADR-015 follow-up (see "Future work" below).
- **No move of `Horizon3D.svelte` or `ScenarioSurfaceNav.svelte`.** Out of scope; the horizon set has a single visual definition today and no second consumer.
- **No engine / scoring / FDM-worker changes.** Pages still own the worker; the panel only renders the SNAPSHOT.

## Scope: what moves

From `apps/sim/src/lib/` to `libs/activities/src/cockpit-panel/`:

- `cockpit/CockpitPanel.svelte` -- the panel itself
- `instruments/Asi.svelte`, `Altimeter.svelte`, `AttitudeIndicator.svelte`, `HeadingIndicator.svelte`, `Tachometer.svelte`, `TurnCoordinator.svelte`, `Vsi.svelte` -- the round-dial six-pack + tach
- `instruments/cluster/EngineCluster.svelte`, `cluster/ClusterGauge.svelte`, `cluster/FuelGauge.svelte` -- the engine row
- `panels/AnnunciatorStrip.svelte` -- the lamp strip the panel composes

Why bring instruments + cluster + AnnunciatorStrip too: they are the panel's render dependencies, they have no other "cockpit page chrome" character, and shipping a `libs/activities/cockpit-panel/` that still reaches back into `apps/sim/$lib/instruments/` would invert the dependency direction. The instruments are not consumed elsewhere by anything outside the panel and the dev-only `_dev/instruments` gallery and the `debrief` page (both rewired in this WP).

After the move, the new layout under `libs/activities/src/cockpit-panel/` is:

```text
cockpit-panel/
  CockpitPanel.svelte
  AnnunciatorStrip.svelte
  Altimeter.svelte
  Asi.svelte
  AttitudeIndicator.svelte
  HeadingIndicator.svelte
  Tachometer.svelte
  TurnCoordinator.svelte
  Vsi.svelte
  cluster/
    ClusterGauge.svelte
    EngineCluster.svelte
    FuelGauge.svelte
```

Boundary discussion -- including the design tradeoff between "panel only" vs "panel + instruments" vs "panel + instruments + tick" -- is in [design.md](./design.md).

## Consumers rewired

| Consumer                                                  | Before                                                                       | After                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/sim/src/routes/[scenarioId]/+page.svelte`           | `import CockpitPanel from '$lib/cockpit/CockpitPanel.svelte'`                | `import CockpitPanel from '@ab/activities/cockpit-panel/CockpitPanel.svelte'`               |
| `apps/sim/src/routes/[scenarioId]/dual/+page.svelte`      | `import CockpitPanel from '$lib/cockpit/CockpitPanel.svelte'`                | `import CockpitPanel from '@ab/activities/cockpit-panel/CockpitPanel.svelte'`               |
| `apps/sim/src/routes/[scenarioId]/window/+page.svelte`    | `import CockpitPanel from '$lib/cockpit/CockpitPanel.svelte'`                | `import CockpitPanel from '@ab/activities/cockpit-panel/CockpitPanel.svelte'`               |
| `apps/sim/src/routes/_dev/instruments/+page.svelte`       | `import EngineCluster from '$lib/instruments/cluster/EngineCluster.svelte'` | `import EngineCluster from '@ab/activities/cockpit-panel/cluster/EngineCluster.svelte'`     |
| `apps/sim/src/routes/[scenarioId]/debrief/+page.svelte`   | `import EngineCluster from '$lib/instruments/cluster/EngineCluster.svelte'` | `import EngineCluster from '@ab/activities/cockpit-panel/cluster/EngineCluster.svelte'`     |

`@ab/activities` is already aliased in `apps/sim/svelte.config.js` (added by PR #328). No new alias work.

## Acceptance criteria

- `git mv` preserves history for every relocated file (`git log --follow` resolves through the rename).
- `bun run check` clean on touched files. Theme-lint clean.
- Cockpit, dual, window, debrief, and `_dev/instruments` routes render identically before and after (manual smoke per [test-plan.md](./test-plan.md)).
- Zero references to the old paths remain after the move:
  - `grep -rn '$lib/cockpit/CockpitPanel' apps/sim/src` -> empty
  - `grep -rn '$lib/instruments/' apps/sim/src` -> empty
  - `grep -rn '$lib/panels/AnnunciatorStrip' apps/sim/src` -> empty
- `apps/sim/src/lib/cockpit/CockpitPanel.svelte`, `apps/sim/src/lib/instruments/`, and `apps/sim/src/lib/panels/AnnunciatorStrip.svelte` no longer exist (`apps/sim/src/lib/panels/` keeps the surround panels listed under "Non-goals").
- `libs/activities/src/cockpit-panel/CockpitPanel.svelte` imports its dependencies via relative intra-lib paths (e.g. `./instruments/Asi.svelte`, `./AnnunciatorStrip.svelte`); no `$lib/*` imports leak into the lib.

## Decisions (ratified 2026-04-30)

The drafting agent flagged five judgement calls. All resolved in favour of the spec as written; no changes to scope.

1. **Promote `ControlInput.svelte` in this WP?** -> **Separate WP.** Different axis (input host vs visual render), separate boundary questions (`control-handler.ts`, `control-ramp.ts`, `tape-store.ts`). Logged as future work below. Keeps this WP mechanical.
2. **Move `_dev/instruments` gallery into the lib?** -> **Stays in `apps/sim/`.** It's a *consumer* of the lib (a dev gallery), not part of the lib. Imports rewired per spec. Moving dev tooling into a lib confuses the lib's purpose.
3. **Folder name `cockpit-panel/` vs `cockpit/` vs other?** -> **`cockpit-panel/`.** `cockpit/` would conflict with `apps/sim/src/lib/cockpit/` which still hosts `ControlInput.svelte`. Unambiguous. Already in spec.
4. **Restructure for hypothetical avionics or instructor-station consumers (flatter layout)?** -> **Ship cut B as designed.** Instruments remain individually importable at `@ab/activities/cockpit-panel/Asi.svelte`. Don't design for unknown future consumers.
5. **Add `panel-tick.svelte.ts` easing layer (mirror PFD) in this WP?** -> **Defer.** Adding easing is a behaviour change, not an extraction. This WP is scoped zero-behaviour-change. Easing gets its own WP if a consumer asks for it.

## Future work (logged here, not done in this WP)

- **`ControlInput.svelte` promotion.** Same shape as this WP: pure-prop input host, three current sim consumers, future avionics / instructor / replay-theatre pages will want it. Trigger: when an off-sim surface needs keyboard input bound to FDM-style `inputs`. Destination: `libs/activities/src/cockpit-controls/` (separate package dir to keep the visual panel and the input host independently importable).
- **Cockpit-page surround panels** (`ScenarioStepBanner`, `WxPanel`, `VSpeeds`, `KeybindingsHelp`, `ControlInputs`). These are sim-cockpit chrome. If a non-sim consumer ever wants any of them, evaluate per-component then -- not now.
- **Round-dial vs. tape style consolidation.** PFD ships tape-style attitude / airspeed / altitude / heading. CockpitPanel ships round-dial. Both live under `libs/activities/` after this WP. A future avionics MFD or partial-panel drill might want either, neither, or both; no consolidation needed unless that surface forces the question.
