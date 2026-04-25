# Theme picker (apps/study)

User-selectable theme dropdown in the study app header.

## Done

- [x] `THEME_COOKIE` constant + `parseThemePreference` / `isThemePreference` / `forcedAppearanceFor` helpers in `libs/themes/resolve.ts`
- [x] `ROUTES.THEME` constant in `libs/constants/src/routes.ts`
- [x] `App.Locals.theme: ThemePreference` typing
- [x] `hooks.server.ts` reads the cookie into `event.locals.theme`
- [x] `POST /theme` endpoint validates against the registry and writes the cookie
- [x] `resolveThemeSelection({ pathname, userTheme, ... })` -- new resolver with documented precedence (route safety lock > user pref > path default)
- [x] `(app)/+layout.svelte` wires the picker, syncs `data-theme` / `data-appearance` / `data-layout` on `<html>`, posts to `/theme`
- [x] Pre-hydration script in `apps/study/src/app.html` reads the theme cookie (with id allow-list mirroring registry), forces dark for sim/glass, leaves /sim route-locked
- [x] Picker placed between HelpSearch and the identity dropdown; light/dark fieldset stayed in identity
- [x] Theme ids/names sourced from `listThemes()` -- no hardcoded label map
- [x] 13 new vitest cases covering precedence + helpers (20 total in resolve.test.ts, all green)

## Notes

- Pre-existing `theme-lint` violations in `apps/sim/src/lib/instruments/cluster/*` and `apps/sim/src/routes/[scenarioId]/debrief/*` are unchanged on main; out of scope for the study picker.
