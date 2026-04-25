---
title: 'Spec: User-selectable theme picker'
feature: theme-picker
type: spec
status: done
review_status: done
shipped_in: '#183'
---

# Spec: User-selectable theme picker

User can select any registered theme from the study app header. Selection persists across reloads via cookie. Light/dark appearance remains an orthogonal preference.

## Why

The overhaul (phases 1-7) made themes swappable (`data-theme` on `<html>` re-skins everything), but theme selection was hard-wired to `resolveThemeForPath()`. Users had no way to pick. The acceptance line "swapping `data-theme` re-skins every page" had no UI behind it.

## What shipped

- `THEME_COOKIE = 'theme'` and `ROUTES.THEME = '/theme'`, mirroring the appearance pattern.
- `POST /theme` endpoint validates the value against the registry (`isValidThemeId`) and rejects unknown ids with 400.
- `resolveThemeSelection({ pathname, userTheme, userAppearance, systemAppearance })` in `libs/themes/resolve.ts`. Single entry point; documents the override rule.
- `forcedAppearanceFor(themeId)` centralises the sim/glass dark-only rule.
- Pre-hydration script in `apps/study/src/app.html` reads the cookie and applies `data-theme` before the bundle loads, with a comment-flagged inline allow-list of theme ids.
- Picker UI in the study header between `.nav-search` and `.identity`. Iterates `listThemes()`, uses `theme.name` as label.
- 13 vitest cases for the resolver / parser / safety rules.

## Override rule (documented in code)

1. If the route hard-requires a specific theme (only `/sim/*` requires `sim/glass` for dark-only crash safety), the route wins.
2. Otherwise the user pref wins.
3. `sim/glass` always forces `data-appearance=dark`, whether reached via route or user pref.
4. No user pref set: behavior is identical to pre-#183 (`resolveThemeForPath`).

## Layout vs theme

Layout (`reading` / `dashboard` / `full`) stays route-driven. Picking `study/sectional` while on `/dashboard` keeps the dashboard grid layout. The picker swaps palette + chrome only.

## Files (#183 -- shipped)

| File                                            | Change                                 |
| ----------------------------------------------- | -------------------------------------- |
| `libs/constants/src/routes.ts`                  | `ROUTES.THEME` added                   |
| `libs/themes/resolve.ts`                        | Cookie name, parser, resolver, helpers |
| `libs/themes/index.ts`                          | Re-export new surface                  |
| `apps/study/src/app.d.ts`                       | `App.Locals.theme: ThemePreference`    |
| `apps/study/src/hooks.server.ts`                | Reads cookie -> locals                 |
| `apps/study/src/routes/theme/+server.ts`        | New POST endpoint                      |
| `apps/study/src/routes/(app)/+layout.server.ts` | Passes theme to client                 |
| `apps/study/src/routes/(app)/+layout.svelte`    | Picker UI + sync effect                |
| `apps/study/src/app.html`                       | Pre-hydration cookie read              |
| `libs/themes/__tests__/resolve.test.ts`         | 13 new cases                           |

## After refactor (Phase 10 -- shipped)

The cookie/parser/endpoint/pre-hydration/picker-UI bundle was extracted into a shared `@ab/themes/picker/*` surface so adding the picker to a new app is roughly five lines of glue. See [10-theme-picker-shared-lib/spec.md](../10-theme-picker-shared-lib/spec.md) for the full plan; the API surface is:

| Symbol                              | Purpose                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `createThemeEndpoint()`             | Returns the POST handler for `routes/theme/+server.ts`                     |
| `readThemeFromCookies(cookies)`     | One-line cookie -> `ThemePreference` for `hooks.server.ts`                 |
| `THEME_COOKIE`, `ThemePreference`   | Re-exports of the resolver-side constants/types                            |
| `buildPreHydrationScript()`         | Codegen entry point: returns the script body with the registry allow-list  |
| `buildPreHydrationCspHash(body)`    | SHA-256 base64 hash for `script-src` CSP source                            |
| `injectPreHydrationScript(html, b)` | `transformPageChunk` substitution for `%theme-pre-hydration%`              |
| `PRE_HYDRATION_PLACEHOLDER`         | The token each app puts in `app.html`                                      |
| `ThemePicker.svelte`                | The UI component (sub-path import: `@ab/themes/picker/ThemePicker.svelte`) |

Generated artifacts (committed; emitted by `bun themes:emit`):

| File                                     | Purpose                                                  |
| ---------------------------------------- | -------------------------------------------------------- |
| `libs/themes/generated/pre-hydration.js` | Inline script body (debug aid; not imported at runtime)  |
| `libs/themes/generated/pre-hydration.ts` | `PRE_HYDRATION_SCRIPT` + `PRE_HYDRATION_SCRIPT_CSP_HASH` |

## Acceptance

- [x] Picker visible between search and username (study).
- [x] Selecting a theme updates `data-theme` on `<html>` immediately, no reload.
- [x] Cookie persists across reload.
- [x] Light/dark fieldset still in identity dropdown, works independently.
- [x] `sim/glass` forces dark appearance.
- [x] `bun run check` clean for files touched.
- [x] No hardcoded theme ids outside `libs/themes/` and the pre-hydration allow-list.
- [x] Picker available in study, sim, and hangar (Phase 10).

## Out of scope (resolved in same turn per CLAUDE.md)

- Per-user theme preference in DB: cookie is sufficient until multi-device sync is a stated requirement. Drop.
- Theme preview on hover: not asked for. Drop.
- A11y announcement on theme change: tracked in `docs/work/todos/20260425-02-theme-picker.md`. Defer with trigger: revisit when the a11y review next runs against `(app)/+layout.svelte`.
