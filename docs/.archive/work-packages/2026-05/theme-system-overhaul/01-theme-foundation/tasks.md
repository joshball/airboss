---
title: 'Tasks: Theme Foundation'
feature: theme-foundation
type: tasks
status: unread
---

# Tasks

## Typed contract (pre-CSS)

- [ ] `libs/themes/vocab.ts` — full `TOKENS` object + flattened `TokenName` union.
- [ ] `libs/themes/contract.ts` — `Theme`, `ThemeId`, `AppearanceMode`, `Palette`, `InteractiveStates`, `SignalStates`, `DerivedPalette`, `TypographyPack`, `TypeBundle`, `Chrome`, `ComponentTokens`, `AppVocabulary`.
- [ ] `libs/themes/tones.ts` — `TONES` + `Tone`.
- [ ] `libs/themes/derive.ts` — port from peepfood-mono's `themes/utils.ts`.
- [ ] `libs/themes/contrast.ts` — WCAG 2.x luminance + ratio helper.
- [ ] `libs/themes/registry.ts` — register/get/getSafe/isValid/list.
- [ ] Port peepfood-mono's derivation test suite to `libs/themes/__tests__/derive.test.ts`.
- [ ] Unit tests for contrast (known WCAG values) and registry (duplicate id, unknown id).

## Emit pipeline

- [ ] `libs/themes/emit.ts`:
  - [ ] `resolveTheme(theme)` walks extends chain; merges palette, typography, chrome, componentTokens.
  - [ ] `applyDerivations(palette, appearance)` runs derive utilities.
  - [ ] Block generators: roles, typography, chrome, layout variables, component tokens.
  - [ ] `themeToCss(theme, appearance)` wraps blocks in `[data-theme="..."][data-appearance="..."] { ... }`.
  - [ ] `emitAllThemes()` loops registered themes × appearances; prepends a `:root` block with Layer 0 scale defaults for fallback.
- [ ] `scripts/themes/emit.ts` — CLI entry writing to `libs/themes/generated/tokens.css`.
- [ ] `package.json` script: `"themes:emit": "bun scripts/themes/emit.ts"`.
- [ ] Pre-commit hook (or CI): run `themes:emit`, fail on uncommitted diff.

## Theme definitions

- [ ] `libs/themes/core/defaults/airboss-default/`:
  - [ ] `index.ts` registers `airboss/default`.
  - [ ] `palette.light.ts` — port current web values into role-named palette (values identical, names changed).
  - [ ] `palette.dark.ts` — STUB (same values as light + top-of-file TODO).
  - [ ] `typography.ts` — atomic bundle (packs in #2).
  - [ ] `chrome.ts` — radii, shadows, motion, spacing picks (values = current web theme).
  - [ ] `layouts/reading.css` — `.ab-container` web rules + `.ab-grid`.
  - [ ] `layouts/dashboard.css` — `.ab-container` tui rules + `.ab-grid`.
- [ ] `libs/themes/study/sectional/`:
  - [ ] `index.ts` — registers `study/sectional`, extends `airboss/default`.
  - [ ] `palette.light.ts` — overrides (may be empty).
  - [ ] `palette.dark.ts` — STUB.
  - [ ] `typography.ts`, `chrome.ts` — mostly inherit.
  - [ ] `layouts/reading.css` references base.
- [ ] `libs/themes/study/flightdeck/`:
  - [ ] `index.ts` — registers `study/flightdeck`, extends `airboss/default`.
  - [ ] `palette.light.ts` — port current tui darker state colors.
  - [ ] `palette.dark.ts` — STUB.
  - [ ] `typography.ts` — mono stack (from current tui).
  - [ ] `chrome.ts` — sharp radii, flat shadows.
  - [ ] `layouts/dashboard.css` — full-bleed grid with tui adjustments.
- [ ] `libs/themes/sim/` — README only, reserved.

## Provider + resolver

- [ ] Update `ThemeProvider.svelte`: `theme`, `appearance`, `layout` props; three data attributes; `display: contents` preserved.
- [ ] Update `resolve.ts`: `resolveThemeForPath(path, userAppearance, systemAppearance)` returns `ThemeSelection { theme, appearance, layout }`.
- [ ] Update `libs/themes/index.ts` barrel.

## Pre-hydration script

- [ ] `apps/study/src/app.html` inline script before `%sveltekit.head%`: reads `appearance` cookie + `prefers-color-scheme`, path-based theme resolution, sets both data attributes on `<html>`.
- [ ] Same in `apps/sim/src/app.html`.

## Primitive token rename

Migrate `<style>` blocks in all 12 primitives:

- [ ] `libs/ui/src/components/Banner.svelte`
- [ ] `libs/ui/src/components/Badge.svelte`
- [ ] `libs/ui/src/components/Button.svelte`
- [ ] `libs/ui/src/components/Card.svelte`
- [ ] `libs/ui/src/components/ConfidenceSlider.svelte`
- [ ] `libs/ui/src/components/ConfirmAction.svelte`
- [ ] `libs/ui/src/components/KbdHint.svelte`
- [ ] `libs/ui/src/components/PanelShell.svelte`
- [ ] `libs/ui/src/components/Select.svelte`
- [ ] `libs/ui/src/components/StatTile.svelte`
- [ ] `libs/ui/src/components/TextField.svelte`

Rename mapping (mechanical):

| Old                              | New                                |
| -------------------------------- | ---------------------------------- |
| `--ab-color-fg`                  | `--ink-body`                       |
| `--ab-color-fg-muted`            | `--ink-muted`                      |
| `--ab-color-fg-subtle`           | `--ink-subtle`                     |
| `--ab-color-fg-faint`            | `--ink-faint`                      |
| `--ab-color-fg-strong`           | `--ink-strong`                     |
| `--ab-color-fg-inverse`          | `--ink-inverse`                    |
| `--ab-color-bg`                  | `--surface-page`                   |
| `--ab-color-surface`             | `--surface-panel`                  |
| `--ab-color-surface-raised`      | `--surface-raised`                 |
| `--ab-color-surface-sunken`      | `--surface-sunken`                 |
| `--ab-color-surface-muted`       | `--surface-muted`                  |
| `--ab-color-border`              | `--edge-default`                   |
| `--ab-color-border-strong`       | `--edge-strong`                    |
| `--ab-color-border-subtle`       | `--edge-subtle`                    |
| `--ab-color-primary`             | `--action-default`                 |
| `--ab-color-primary-hover`       | `--action-default-hover`           |
| `--ab-color-primary-active`      | `--action-default-active`          |
| `--ab-color-primary-subtle`      | `--action-default-wash`            |
| `--ab-color-primary-subtle-border` | `--action-default-edge`          |
| `--ab-color-primary-fg`          | `--action-default-ink`             |
| `--ab-color-danger*`             | `--action-hazard*`                 |
| `--ab-color-success*`            | `--signal-success*`                |
| `--ab-color-info*`               | `--signal-info*`                   |
| `--ab-color-muted*`              | `--action-neutral*`                |
| `--ab-color-accent*`             | `--accent-code` (current only use) |
| `--ab-color-focus-ring`          | `--focus-ring`                     |
| `--ab-color-focus-ring-strong`   | `--focus-ring-strong`              |
| `--ab-shadow-focus-ring`         | `--focus-ring-shadow`              |
| `--ab-font-family-sans`          | `--font-family-sans`               |
| `--ab-space-*`                   | `--space-*`                        |
| `--ab-radius-*`                  | `--radius-*`                       |
| `--ab-shadow-*`                  | `--shadow-*`                       |
| `--ab-layout-*`                  | `--layout-*`                       |
| `--ab-transition-*`              | `--motion-*`                       |
| `--ab-control-*`                 | `--button-*` or `--input-*` (review per case) |

Context-dependent (review each use):

- [ ] `--ab-color-warning-*` → `--signal-warning-*` or `--action-caution-*`?

## App wiring

- [ ] `apps/study/src/routes/+layout.svelte` — import `@ab/themes/generated/tokens.css`.
- [ ] `apps/study/src/routes/(app)/+layout.svelte` — ThemeProvider moved inside `<main>`; nav stays on chrome theme.
- [ ] `apps/study/src/routes/login/+page.svelte` — ThemeProvider new API.
- [ ] `apps/study/src/app.html` — focus ring uses `var(--focus-ring-strong)`; `<style>` block `--ab-*` references renamed.
- [ ] Same updates in `apps/sim/src/`.

## Cleanup

- [ ] Delete old `libs/themes/tokens.css`.
- [ ] Delete old `libs/themes/tokens.ts`.
- [ ] Grep for `--ab-` in `apps/**` and `libs/ui/**` → zero.
- [ ] Grep for `@ab/themes/tokens.css` → updated to `@ab/themes/generated/tokens.css`.

## Verification

- [ ] `bun run check` clean.
- [ ] `bun run test` passes.
- [ ] `bun run themes:emit` twice → identical output.
- [ ] Manual: every study route pixel-identical to pre-change.
- [ ] Manual: dashboard nav keeps its reading-theme styling.
- [ ] DevTools: computed CSS vars resolve through role names on any element.
