/**
 * GENERATED FILE -- do not edit by hand.
 *
 * Source: `bun themes:emit` (scripts/themes/emit.ts).
 * Origin: `libs/themes/picker/pre-hydration.ts`.
 *
 * Carries the inline pre-hydration script body and its SHA-256 CSP hash.
 * - `PRE_HYDRATION_SCRIPT` is dropped into `<script>` in each app's
 *   `app.html` via the `%theme-pre-hydration%` placeholder + the
 *   `transformPageChunk` hook.
 * - `PRE_HYDRATION_SCRIPT_CSP_HASH` goes into each app's
 *   `svelte.config.js` `script-src` directive so a strict CSP allows
 *   the inline script to run.
 *
 * Determinism: regenerated on every `themes:emit`; byte-identical when
 * the registered themes are unchanged.
 */

export const PRE_HYDRATION_SCRIPT =
	"(function () {\n\ttry {\n\t\tvar doc = document.documentElement;\n\t\tvar path = window.location.pathname;\n\t\tvar sim = path === '/sim' || path.indexOf('/sim/') === 0;\n\t\tvar flightdeck = !sim && (path === '/dashboard' || path.indexOf('/dashboard/') === 0);\n\t\t// Path defaults mirror resolveThemeForPath in @ab/themes/resolve.ts.\n\t\tvar pathTheme = sim ? 'sim/glass' : flightdeck ? 'study/flightdeck' : 'study/sectional';\n\t\tvar layout = sim ? 'cockpit' : flightdeck ? 'dashboard' : 'reading';\n\t\t// User theme cookie. Allow-list is generated from listThemes() at\n\t\t// build time so a new theme shipping in @ab/themes is picked up\n\t\t// automatically the next time bun themes:emit runs.\n\t\tvar themeCookie = document.cookie.match(/(?:^|;\\s*)theme=([^;]+)/);\n\t\tvar rawTheme = themeCookie ? decodeURIComponent(themeCookie[1]) : '';\n\t\tvar allowed = { 'airboss/default': 1, 'sim/glass': 1, 'study/flightdeck': 1, 'study/sectional': 1 };\n\t\tvar userTheme = allowed[rawTheme] ? rawTheme : '';\n\t\t// Route safety lock: /sim/* always uses sim/glass regardless of pref.\n\t\tvar theme = sim ? pathTheme : (userTheme || pathTheme);\n\t\tvar stored = document.cookie.match(/(?:^|;\\s*)appearance=(system|light|dark)/);\n\t\tvar pref = stored ? stored[1] : 'system';\n\t\tvar system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';\n\t\t// Forced-appearance themes (today: sim/glass dark-only) bypass user prefs.\n\t\tvar forcedDark = theme === 'sim/glass';\n\t\tvar appearance = forcedDark ? 'dark' : pref === 'system' ? system : pref;\n\t\tdoc.setAttribute('data-theme', theme);\n\t\tdoc.setAttribute('data-appearance', appearance);\n\t\tdoc.setAttribute('data-layout', layout);\n\t} catch (e) {\n\t\t/* Fall through to the HTML defaults. */\n\t}\n})();";

export const PRE_HYDRATION_SCRIPT_CSP_HASH = 'sha256-q8lW1tqb4YXNK5XlILbdyK6IVC424yxwHk1ux/o+a2U=';
