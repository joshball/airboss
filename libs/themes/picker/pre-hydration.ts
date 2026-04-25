/**
 * Pre-hydration script generator.
 *
 * Each app's `app.html` runs a small inline script before the SvelteKit
 * bundle loads so `<html>` already carries `data-theme` / `data-appearance`
 * / `data-layout` at first paint. Without it, a user who selected dark
 * sees a light-mode flash on every reload.
 *
 * The script can't `import` from the bundle (it runs before the bundle
 * exists), so the registered theme allow-list has to be baked in. Hard-
 * coding the list in three `app.html` files would let the lists drift
 * silently away from `listThemes()`. The fix:
 *
 *   1. `bun themes:emit` walks `listThemes()` and writes
 *      `libs/themes/generated/pre-hydration.js` -- the script body ready
 *      to drop into a `<script>` tag.
 *   2. The same step writes `libs/themes/generated/pre-hydration.ts` --
 *      a typed module exporting the script body string and the SHA-256
 *      CSP hash. `svelte.config.js` imports the hash; `hooks.server.ts`
 *      imports the body and substitutes it into `<script>%theme-pre-hydration%</script>`
 *      via `transformPageChunk`.
 *
 * Build-time codegen (chosen over a Vite plugin) because it keeps the
 * generated artifact in source control. The CI determinism check that
 * already gates `tokens.css` extends to the script: two back-to-back
 * `themes:emit` runs must produce byte-identical output, which keeps the
 * CSP hash stable.
 *
 * Why Option A (codegen) over Option B (runtime function): Option B would
 * recompute the hash on every dev start and require the `svelte.config.js`
 * to await a Promise -- SvelteKit's CSP config is synchronous, so the
 * hash has to be a literal at config-load time.
 */

import { listThemes } from '../registry';
import { resolveThemeForPath } from '../resolve';

const FLIGHTDECK_THEME = resolveThemeForPath('/dashboard').theme;
const SIM_THEME = resolveThemeForPath('/sim').theme;
const DEFAULT_THEME = resolveThemeForPath('/').theme;

/**
 * Build the inline script body that runs before the SvelteKit bundle.
 *
 * Mirrors `resolveThemeSelection` for the subset that matters at first
 * paint:
 *   - path-default theme (sim/dashboard/everything-else)
 *   - layout (cockpit/dashboard/reading)
 *   - user theme cookie (validated against registered ids)
 *   - route safety lock (`/sim/*` ignores user pref)
 *   - appearance preference (cookie -> system -> light fallback)
 *   - forced-appearance themes (today: only `sim/glass`)
 *
 * The allow-list is the registered ids; bumping `listThemes()` updates
 * the script automatically the next time `themes:emit` runs.
 *
 * Output is intentionally ES5-compatible (no arrow fns, no `const`) so
 * the script runs in any browser the platform supports without
 * transpilation.
 */
export function buildPreHydrationScript(): string {
	const ids = listThemes()
		.map((t) => t.id)
		.sort();
	const allowList = ids.map((id) => `'${id}': 1`).join(', ');
	// Single-quoted theme ids; the resolver treats forced-dark themes via
	// `forcedAppearanceFor`. Today only `sim/glass` qualifies; if another
	// theme joins the forced set, surface it via a named export here so
	// this script picks it up at codegen time.
	return `(function () {
	try {
		var doc = document.documentElement;
		var path = window.location.pathname;
		var sim = path === '/sim' || path.indexOf('/sim/') === 0;
		var flightdeck = !sim && (path === '/dashboard' || path.indexOf('/dashboard/') === 0);
		// Path defaults mirror resolveThemeForPath in @ab/themes/resolve.ts.
		var pathTheme = sim ? '${SIM_THEME}' : flightdeck ? '${FLIGHTDECK_THEME}' : '${DEFAULT_THEME}';
		var layout = sim ? 'cockpit' : flightdeck ? 'dashboard' : 'reading';
		// User theme cookie. Allow-list is generated from listThemes() at
		// build time so a new theme shipping in @ab/themes is picked up
		// automatically the next time bun themes:emit runs.
		var themeCookie = document.cookie.match(/(?:^|;\\s*)theme=([^;]+)/);
		var rawTheme = themeCookie ? decodeURIComponent(themeCookie[1]) : '';
		var allowed = { ${allowList} };
		var userTheme = allowed[rawTheme] ? rawTheme : '';
		// Route safety lock: /sim/* always uses sim/glass regardless of pref.
		var theme = sim ? pathTheme : (userTheme || pathTheme);
		var stored = document.cookie.match(/(?:^|;\\s*)appearance=(system|light|dark)/);
		var pref = stored ? stored[1] : 'system';
		var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		// Forced-appearance themes (today: sim/glass dark-only) bypass user prefs.
		var forcedDark = theme === '${SIM_THEME}';
		var appearance = forcedDark ? 'dark' : pref === 'system' ? system : pref;
		doc.setAttribute('data-theme', theme);
		doc.setAttribute('data-appearance', appearance);
		doc.setAttribute('data-layout', layout);
	} catch (e) {
		/* Fall through to the HTML defaults. */
	}
})();`;
}

/**
 * SHA-256 hash of the script body, base64-encoded, formatted as a
 * `script-src` CSP source: `sha256-<base64>`.
 *
 * Why CSP cares: `app.html`'s inline script has no nonce (SvelteKit's
 * `mode: 'auto'` only nonces scripts the framework emits), so the hash
 * is the only way the browser will execute it under a strict CSP.
 *
 * Why we ship a helper instead of computing once at module load: the
 * codegen runs in the build script, not in the runtime bundle, so we
 * need a pure function that doesn't depend on web-crypto or fs.
 */
export async function buildPreHydrationCspHash(scriptBody: string): Promise<string> {
	const encoded = new TextEncoder().encode(scriptBody);
	const digest = await crypto.subtle.digest('SHA-256', encoded);
	const bytes = new Uint8Array(digest);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `sha256-${btoa(binary)}`;
}

/**
 * Substitute the generated script body into `app.html`'s `%theme-pre-hydration%`
 * placeholder. Used by each app's `hooks.server.ts` `transformPageChunk`.
 *
 * Kept as a helper so the substitution rule lives once. If we ever need
 * to wrap the script differently per app (e.g. add a nonce), this is the
 * single place to change it.
 */
export const PRE_HYDRATION_PLACEHOLDER = '%theme-pre-hydration%';

export function injectPreHydrationScript(html: string, scriptBody: string): string {
	return html.replace(PRE_HYDRATION_PLACEHOLDER, () => scriptBody);
}
