---
title: 'Spec: Theme Foundation'
feature: theme-foundation
type: spec
status: unread
review_status: pending
---

# Spec: Theme Foundation

Establish the typed contract, derivation utilities, and the new directory structure in one pass. After this package lands, `libs/themes/` has the shape described in [02-ARCHITECTURE.md](../../../platform/theme-system/02-ARCHITECTURE.md): a layered, per-app, TypeScript-first theme system with CSS emitted from TS, a registry with safe getters, a pre-hydration script, and role-based token names end-to-end.

Bundles what were originally two packages (theme-vocabulary + theme-architecture) because they always ship together — the contract without the emit pipeline is useless; the emit pipeline without the contract doesn't compile. Splitting them created a small PR with nothing to show and a big PR that depended on it. One foundation PR is the right shape.

## Goal

After this package lands:

- `libs/themes/vocab.ts` — typed `TOKENS` catalogue per [04-VOCABULARY.md](../../../platform/theme-system/04-VOCABULARY.md).
- `libs/themes/contract.ts` — `Theme`, `Palette`, `TypographyPack`, `AppearanceMode`, `ThemeId`, `AppVocabulary`.
- `libs/themes/tones.ts` — `TONES` enum shared across Badge, StatTile, Banner.
- `libs/themes/derive.ts` — `alpha`, `adjustBrightness`, `getContrastingTextColor`, `deriveInteractiveStates`, `deriveSignalVariants` (ported from peepfood-mono with its 98-test suite).
- `libs/themes/contrast.ts` — WCAG helper.
- `libs/themes/registry.ts` — `registerTheme`, `getTheme`, `getThemeSafe`, `isValidThemeId`, `listThemes`.
- `libs/themes/emit.ts` — `themeToCss(theme, appearance)` and `emitAllThemes()` pipeline.
- `scripts/themes/emit.ts` — CLI that writes `libs/themes/generated/tokens.css`.
- `libs/themes/core/defaults/airboss-default/` — shared base theme with palette (light real, dark stub), typography (atomic; packs land in #2), chrome, layouts.
- `libs/themes/study/sectional/` — reading theme, extends airboss-default.
- `libs/themes/study/flightdeck/` — TUI/dashboard theme, extends airboss-default.
- `libs/themes/sim/` — empty, reserved directory with README.
- `ThemeProvider.svelte` — accepts `theme`, `appearance`, `layout` props; emits three data attributes.
- `resolve.ts` — `resolveThemeForPath(path, userAppearance, systemAppearance): ThemeSelection`.
- `apps/study/src/app.html` — pre-hydration script sets `data-theme` + `data-appearance` before first paint; global focus ring uses `var(--focus-ring-strong)`.
- `apps/study/src/routes/(app)/+layout.svelte` — ThemeProvider moved *inside* `<main>` so nav stays on chrome theme.
- All 12 primitives in `libs/ui/src/components/*.svelte` — `<style>` blocks migrated from `--ab-*` names to role names (`--action-default`, `--ink-body`, etc.).
- Dark palettes ship as stubs (same values as light with a top-of-file TODO). Real dark values land in #6.

## Non-goals

- Typography packs (package #2).
- Lint rule / codemod / contrast tests (package #3).
- New primitives (package #4).
- Page-level migration in `apps/study` (package #5).
- Real dark palettes (package #6).
- Sim theme (package #7).

## Key design choices

- **TypeScript as source of truth.** Themes are typed objects. CSS is emitted. Never hand-edit `generated/tokens.css`.
- **Commit the generated CSS.** Diffs stay visible for review. Pre-commit hook (or CI check) regenerates and fails if the committed file drifts.
- **Inheritance via `extends: ThemeId`.** Flat chains only. `study/sectional` extends `airboss/default`. No deep chains until we have a real use case.
- **OKLCH for every color.** Derivation math is predictable across hues.
- **Three axes forever**: `theme`, `appearance`, `layout`. No chrome axis, no density axis.
- **Empty theme files are valid.** A theme that only overrides chrome can ship with empty palette files; inheritance does the rest.

## Token rename table

The full `--ab-*` → role-name mapping lives in the tasks file. Codemod handles mechanical cases; two context-dependent cases need review:

- `--ab-color-warning-*` maps to either `--signal-warning-*` (status/feedback) or `--action-caution-*` (interactive warning action). Review each use site in primitives.
- `--ab-control-*` maps to either `--button-*` or `--input-*` component tokens. Decide per primitive.

## Acceptance

- `bun run check` clean.
- `bun run test` clean (derivation suite ported and passing).
- `bun run themes:emit` deterministic (two runs = identical output).
- Visual regression: every study route pixel-identical to pre-change (values unchanged; only names changed).
- Dashboard nav no longer restyles into mono when navigating to `/dashboard` (ThemeProvider scope fix).
- `<html>` carries `data-theme` + `data-appearance` before domcontentloaded (manual devtools check; automated in #3).
- Grep for `--ab-` in `apps/**` and `libs/ui/**` returns zero results.
