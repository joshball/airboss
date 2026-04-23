---
title: 'Spec: Sim Theme — Glass'
feature: sim-theme-glass
type: spec
status: unread
review_status: pending
---

# Spec: Sim Theme — Glass (deferred)

**Deferred**: this work package does not start until sim work resumes. Captured now so it isn't lost.

Build sim's first theme: `glass`, the glass-cockpit instrument aesthetic. Dark-only (instruments don't do light mode). Ships a `cockpit` layout template. Introduces sim-scoped vocabulary extensions for instrument-specific tokens.

## Theme

- `libs/themes/sim/glass/` — extends `airboss/default`.
- `appearances: ['dark']` only. Resolver refuses to render `glass` in light.
- Palette: deep black panels, saturated instrument greens + ambers, bright critical reds. Needle whites.
- Typography: monospace-dominant (shared with `flightdeck` pack or custom).
- Chrome: sharp corners, crisp borders, no shadows.

## Layout template

- `layouts/cockpit.css` — multi-zone grid with bezel inserts, instrument slots, EFIS/MFD regions.
- Applied as a class on `<main>` when sim routes in cockpit mode.

## Vocabulary extension

`libs/themes/sim/vocab.ts`:

```ts
export const SIM_VOCAB = {
  instrumentHorizon: '--instrument-horizon',
  instrumentNeedle: '--instrument-needle',
  instrumentCautionArc: '--instrument-caution-arc',
  instrumentWarningArc: '--instrument-warning-arc',
  instrumentBezel: '--instrument-bezel',
  instrumentPanelBg: '--instrument-panel-bg',
  instrumentPanelEdge: '--instrument-panel-edge',
  instrumentReadoutInk: '--instrument-readout-ink',
  instrumentReadoutBg: '--instrument-readout-bg',
} as const;
```

Typed such that only sim's primitives can reference them. Lint rule extends vocab when scanning `apps/sim/` and `libs/sim-ui/` (if a sim-specific UI lib emerges).

## Primitives

- Sim-specific instrument primitives (attitude indicator, airspeed tape, altimeter) live in `libs/sim-ui/` — built separately. They read `--instrument-*` tokens.
- Shared primitives from `libs/ui/` still work in sim's chrome; they use the base role tokens.

## Acceptance (when built)

- `glass` theme registered, appears in registry.
- Dark-only enforcement: attempt to resolve `glass` with `light` throws.
- Cockpit layout template applied on sim's instrument routes.
- Contrast passes on instrument-specific pairs.
- Sim-vocab leakage test: study/hangar primitives cannot reference `--instrument-*` (TypeScript error).
