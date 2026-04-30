# Design -- extract-sim-cockpit-panel

## Summary

Promote the round-dial cockpit panel and its render dependencies (six-pack instruments, engine cluster, annunciator strip) to `libs/activities/src/cockpit-panel/`. Match the PFD precedent from PR #328: subpath imports, no barrel, `<surface>-component/` directory convention. No behaviour change.

## Boundary: what counts as "the panel"?

The judgement call is where to cut the dependency graph. Three plausible cuts:

| Cut                       | What moves                                                                                                | Tradeoff                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(A) Panel only**        | `CockpitPanel.svelte`. Instruments + AnnunciatorStrip stay in `apps/sim/`.                                | Tightest cut; lib reaches back into `apps/sim/$lib/...` to render. Inverts dependency direction (lib depends on app). Nonstarter.                                              |
| **(B) Panel + deps**      | Panel + the seven instruments + the three cluster files + AnnunciatorStrip.                               | The panel renders standalone from the lib. Round-dial instruments and the lamp strip move with it -- they have no other character outside the cockpit panel surface today. **Chosen cut.** |
| **(C) Panel + deps + tick** | (B) plus a `panel-tick.svelte.ts` rAF easing layer mirroring `pfd-tick.svelte.ts`.                       | The panel doesn't currently have a tick layer -- gauges read straight off the worker SNAPSHOT. Adding one is a behaviour change, not an extraction. Out of scope for this WP. |

**Decision: (B).** The lib is self-contained; the move is mechanical; the dependency direction stays correct (`apps/sim` -> `libs/activities`, never the reverse).

### Why instruments come along

`Asi.svelte`, `Altimeter.svelte`, `AttitudeIndicator.svelte`, `HeadingIndicator.svelte`, `Tachometer.svelte`, `TurnCoordinator.svelte`, `Vsi.svelte`, `cluster/{ClusterGauge,EngineCluster,FuelGauge}.svelte`, and `panels/AnnunciatorStrip.svelte` are not currently consumed off the cockpit-panel surface except by:

- The `_dev/instruments` gallery -- a developer tool that exists to render the same components individually. Rewiring it to import from `@ab/activities/cockpit-panel/...` is a one-line change per import.
- The `[scenarioId]/debrief` page -- which renders `EngineCluster` for the post-flight readout. Same one-line rewire.

Neither of those qualifies as "an independent surface for round-dial instruments." If a future surface ever wants the instruments without the panel chassis, they are still importable individually from the lib (`@ab/activities/cockpit-panel/Asi.svelte`). The lib doesn't lose granularity by moving them together.

### Why AnnunciatorStrip comes along

`AnnunciatorStrip.svelte` is the lamp strip the panel composes at the bottom. It has no consumers outside `CockpitPanel.svelte` today. It belongs with the panel.

### Why the cockpit-page surround stays in `apps/sim/`

`ScenarioStepBanner`, `WxPanel`, `VSpeeds`, `AudioCaptions`, `CockpitNarration`, `KeybindingsHelp`, `KeyboardCheatsheet`, `ResetConfirm`, and the HUD-readout `ControlInputs.svelte` are cockpit-page chrome. They wrap the panel; they aren't part of it. Pulling them along would make the lib a sim-cockpit-page-in-a-lib, not a reusable panel.

### Why `ControlInput.svelte` stays (for now)

`ControlInput.svelte` is the keyboard-input host. It already meets ADR 015's loose-coupling contract (pure-prop, callback-driven, no worker / scenario / audio reach). It has the same three sim consumers as `CockpitPanel`. It is a strong candidate for promotion -- but on a separate axis (input behaviour vs. visual render), with separate boundary questions (does it bring `control-handler.ts`, `control-ramp.ts`, `tape-store.ts`?). Logged as future work in [spec.md](./spec.md). Deferring keeps this WP's scope mechanical.

## Package shape

Match `libs/activities/src/pfd/` exactly:

```text
libs/activities/
  package.json              # already exists -- "@ab/activities", private, type: module
  src/
    index.ts                # prose-only docstring; "no runtime barrel"
    pfd/                    # promoted in PR #328
      ...
    crosswind-component/    # original activities resident
      ...
    cockpit-panel/          # this WP
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

## Import strategy

| Surface                         | Imports                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Inside the panel lib            | Relative paths only: `./Asi.svelte`, `./cluster/EngineCluster.svelte`. Cross-lib via alias: `@ab/bc-sim`, `@ab/constants`, `@ab/themes`.       |
| App consumers                   | Direct subpath: `import CockpitPanel from '@ab/activities/cockpit-panel/CockpitPanel.svelte';` Same shape as the existing PFD imports.        |
| Barrel                          | None. `libs/activities/src/index.ts` is prose-only. Activities are heavyweight `.svelte` components loaded on demand; consumers go direct.    |

## Naming convention question (resolved)

PR #328 used `pfd/` (no `-component` suffix). The original `crosswind-component/` predates the convention. The folder name in this WP is `cockpit-panel/` -- short, descriptive, no suffix. Consistent with `pfd/`.

## What this design prevents

- A lib reaching back into `apps/sim/$lib` (cut A) -- never happens because instruments come along.
- A barrel import surface that loads everything eagerly -- never happens; consumers import direct paths.
- A second visual definition of "the round-dial six-pack" growing in `apps/avionics/` or wherever -- the canonical home is the lib; new surfaces consume it, not author parallel copies.
- The cockpit page's chrome leaking into the lib -- explicit non-goal; the surround stays where it is.

## Risk + mitigation

| Risk                                                                                                | Mitigation                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Theme tokens differ between the panel and its dev-gallery callsites after the move                  | Theme-lint runs as part of Phase 5; the panel and its instruments already use tokens, so the move shouldn't introduce any new hex.     |
| `git log --follow` history breaks if a file is copied + deleted instead of `git mv`'d.              | Tasks call out `git mv` per file. Phase 5 includes a history spot-check.                                                                |
| A consumer outside the listed five (cockpit, dual, window, debrief, `_dev/instruments`) is missed.  | Phase 1 grep of `$lib/instruments/`, `$lib/panels/AnnunciatorStrip`, and `$lib/cockpit/CockpitPanel` surfaces every reference.          |
| Vite chunk hash changes break a stale tab pinned to an old chunk path.                              | Same risk as any extraction; build hash is unstable across rebuilds and consumers reload after a deploy. Not a code-correctness issue. |

## References

- ADR 015 -- [docs/decisions/015-sim-surface-loose-coupling.md](../../decisions/015-sim-surface-loose-coupling.md). Establishes the pure-prop contract this panel already satisfies.
- PFD extraction WP -- [docs/work-packages/extract-sim-instruments/spec.md](../extract-sim-instruments/spec.md). Shipped 2026-04-29 in PR #328. Same shape, same playbook.
- Monorepo map -- [CLAUDE.md](../../../CLAUDE.md) "Monorepo" section: `libs/activities/` is the home for domain-coupled visual components.
