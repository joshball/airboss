# apps/sim

Throwaway Phase 0 prototype. Hand-rolled C172 flight dynamics model, full
six-pack of instruments, keyboard-only controls. Used to validate the UX
of a bare-metal FDM before deciding whether to build the full `avionics/`
surface lib or integrate with X-Plane/MSFS telemetry.

Not an FAA-approved ATD. Not for currency. Not a primary training tool.
This exists so pilots (and the author) can feel the control loop in a
browser tab without setting up a full sim rig.

## Phase 0 accepted residuals

These are known, accepted deviations from the platform's code-quality
bars. They are explicitly out of scope until sim graduates past
prototype and its UI moves into a real `libs/avionics/` surface.

- **Hardcoded hex in instrument SVGs.** Files in `src/lib/instruments/`
  embed raw hex (`#111`, `#f5f5f5`, `#e9c53c`, `#2fb856`, `#e0443e`,
  ...) directly in SVG `fill`/`stroke` attributes. Per the architecture
  review (2026-04-22), instrument SVGs should read from tokens when
  they migrate to `libs/avionics/`, at which point we introduce
  avionics-specific tokens (`--ab-instrument-face-bg`,
  `--ab-instrument-needle-primary`, `--ab-instrument-warning-arc`,
  etc.) in `libs/themes/tokens.css`. Until the migration lands, the
  hardcoded colors are acceptable because (a) the prototype ships only
  under the light theme, (b) the SVG colors are part of the
  instrument's functional design (yellow/green/red arcs communicate
  V-speed bands), and (c) migrating now would churn the prototype for
  no payoff.

- **Chromatic status colors in `[scenarioId]/+page.svelte`.** The
  SUCCESS/FAILURE status uses direct hex (`#2fb856`, `#e0443e`) for
  the same reason. The status-lanes polish (separate visual variants)
  lives in that file and uses tokens where tokens exist.

## Graduation criteria

Sim exits Phase 0 and its UI moves to `libs/avionics/` when:

- The FDM is reliable enough to score a non-trivial scenario set
  (stall recovery, crosswind landing, engine-out, at minimum).
- The keyboard control model is validated against a real yoke/throttle
  rig so we know where the abstraction boundaries go.
- The instrument component set is stable enough to be reused by a
  future glass-cockpit trainer (panel, EFIS, moving-map).

At that point, the hex-in-SVG residual converts into a real migration
task: introduce avionics tokens, reskin, gain dark/TUI theme support.
