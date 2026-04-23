---
title: 'Tasks: Typography Packs'
feature: theme-typography-packs
type: tasks
---

# Tasks

- [ ] `libs/themes/core/typography-packs.ts` — `airboss-standard`, `airboss-compact`.
- [ ] `TypographyPack` and `TypeBundle` types live in `contract.ts` (from #1 — extend if needed).
- [ ] Extend emitter: bundles → `--type-<role>-<variant>-{family,size,weight,line-height,tracking}` variables.
- [ ] Update `airboss/default` theme to reference `airboss-standard`.
- [ ] Update `study/flightdeck` to reference `airboss-compact` with mono-family overrides.
- [ ] Rewrite primitives' `<style>` blocks to use bundle variables:
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
- [ ] Keep emitting back-compat atomic `--font-*` tokens for pages (removed in #7).
- [ ] Regenerate `libs/themes/generated/tokens.css`.
- [ ] `bun run check` clean.
- [ ] Visual regression pass on all study routes.
