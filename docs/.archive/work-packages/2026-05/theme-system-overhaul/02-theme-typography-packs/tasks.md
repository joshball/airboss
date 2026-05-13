---
title: 'Tasks: Typography Packs'
feature: theme-typography-packs
type: tasks
---

# Tasks

- [x] `libs/themes/core/typography-packs.ts` — `airboss-standard`, `airboss-compact`.
- [x] `TypographyPack` and `TypeBundle` types live in `contract.ts` — extended with `serif`/`display` family keys and per-family `adjustments`.
- [x] Extend emitter: bundles → `--type-<role>-<variant>-{family,size,weight,line-height,tracking}` variables with per-family size adjustments applied.
- [x] Update `airboss/default` theme to reference `airboss-standard`.
- [x] Update `study/flightdeck` to reference `airboss-compact` with mono-family overrides.
- [ ] Rewrite primitives' `<style>` blocks to use bundle variables — owned by Wave 2 Agent C (package #4).
  - [ ] Button
  - [ ] TextField
  - [ ] Select
  - [ ] Badge
  - [ ] KbdHint
  - [ ] PanelShell
  - [ ] StatTile
  - [ ] Banner
  - [ ] Card
  - [ ] ConfirmAction
  - [ ] ConfidenceSlider
- [x] Emit back-compat `--font-*` / `--ab-font-*` / `--ab-letter-spacing-*` / `--ab-line-height-*` / `--ab-font-weight-*` tokens bound to `--type-*` role tokens (removed atomically in #7).
- [x] Regenerate `libs/themes/generated/tokens.css`.
- [x] `bun run check` clean.
- [ ] Visual regression pass on all study routes — manual QA step.
