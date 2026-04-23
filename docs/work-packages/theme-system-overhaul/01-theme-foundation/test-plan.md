---
title: 'Test Plan: Theme Foundation'
feature: theme-foundation
type: test-plan
status: unread
---

# Test Plan

## Unit

- Derivation math: full peepfood-mono suite (98 tests) passes.
- Contrast helper: canonical WCAG values (black-on-white = 21, white-on-white = 1, others).
- Registry: duplicate id throws; unknown id throws on `getTheme`; undefined on `getThemeSafe`; `isValidThemeId` is a correct type predicate.
- `resolveTheme(theme)` with an extends chain: palette values merge correctly, later-overrides-earlier, derivations apply on top.
- `themeToCss(theme, appearance)` output: declared role tokens all have values, format parses as valid CSS.

## Determinism

- `bun run themes:emit` twice produces byte-identical output.
- Commit hook / CI blocks a PR that forgot to regenerate.

## Type safety

- `bun run check` clean.
- ThemeProvider with wrong prop shape fails type-check.
- Using a token name that doesn't exist in `TOKENS` fails type-check.

## Visual regression (manual smoke)

Pixel-diff before/after on every study route:

- `/login`, `/dashboard`
- `/plans`, `/plans/new`, `/plans/[id]`
- `/memory`, `/memory/new`, `/memory/browse`, `/memory/review`, `/memory/[id]`
- `/reps`, `/reps/new`, `/reps/browse`
- `/knowledge`, `/knowledge/[slug]`, `/knowledge/[slug]/learn`
- `/glossary`, `/glossary/[id]`
- `/calibration`, `/help`, `/help/[id]`
- `/sessions/[id]`, `/sessions/[id]/summary`, `/session/start`

Expected: pixel-identical within AA jitter. Visible diff → a rename mapped wrong.

## FOUC check (manual — automated in #3)

- Set `appearance=dark` cookie. Hard reload `/`. `<html>` has `data-appearance="dark"` immediately (devtools attribute inspector).
- No visible light-flash before hydration. (Dark palette is still a stub, so you'll see identical-to-light, but the attribute must flip instantly.)

## Nav theme scope

- Navigate from `/memory` → `/dashboard`. Nav stays in reading-theme typography. Main content switches to TUI.
- Previously nav switched too — regression guard.

## Grep guards

- `rg "--ab-" apps/ libs/ui/` → zero results.
- `rg "@ab/themes/tokens.css"` → zero results (all migrated to `generated/`).
