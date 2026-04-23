---
title: 'Test Plan: Sim Theme — Glass (deferred)'
feature: sim-theme-glass
type: test-plan
---

# Test Plan (deferred)

## Theme

- Register `sim/glass`; `appearances: ['dark']`.
- `resolveTheme({ theme: 'sim/glass', appearance: 'light' })` throws with a clear message.
- `resolveTheme({ theme: 'sim/glass', appearance: 'dark' })` returns the expected palette.

## Vocabulary scoping

- Attempting to reference `SIM_VOCAB.instrumentHorizon` from a file under `apps/study/` produces a TypeScript compile error (via import boundary).
- Sim primitives compile and reference the tokens successfully.

## Contrast

- Instrument-readout pairs pass WCAG AA.
- Needle-on-horizon pairs pass.
- Caution-arc and warning-arc pairs visually distinct.

## Layout

- `cockpit` layout applied on instrument routes; bezels render correctly.
- Non-instrument sim routes (e.g. briefing) use `sectional` or another non-cockpit layout.
