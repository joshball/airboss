/**
 * Theme picker -- server surface.
 *
 * Single source of truth for the cookie name, the parser, and the POST
 * endpoint factory. All three apps (study, sim, hangar) wire their `/theme`
 * handler with `createThemeEndpoint()` so the safety contract -- registry
 * validation, max-age, SameSite, Path -- can never drift between apps.
 *
 * The cookie / parser / safety helpers live in `../resolve.ts` (kept there
 * because they're used by both client and server during resolution); this
 * file just re-exports them under the `picker` namespace and adds the
 * endpoint factory + the per-request cookie reader for `hooks.server.ts`.
 *
 * The override rule (`/sim/*` -> `sim/glass`, `sim/glass` forces dark) lives
 * inside `resolveThemeSelection` -- not here. The endpoint just records the
 * user's preference; resolution happens at render time via the resolver.
 */

import { SECONDS_PER_YEAR } from '@ab/constants';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { isThemePreference, parseThemePreference, THEME_COOKIE, type ThemePreference } from '../resolve';

export {
	forcedAppearanceFor,
	isThemePreference,
	parseThemePreference,
	THEME_COOKIE,
	type ThemePreference,
} from '../resolve';

/**
 * Read the persisted theme preference from the per-request cookies bag.
 *
 * Used in each app's `hooks.server.ts` to populate `event.locals.theme`.
 * Returns `null` for "no preference set" (the path-default applies) or the
 * registered theme id otherwise.
 */
export function readThemeFromCookies(cookies: Cookies): ThemePreference {
	return parseThemePreference(cookies.get(THEME_COOKIE));
}

/**
 * Build the POST `/theme` endpoint.
 *
 * Each app exports the result as `POST` from its `routes/theme/+server.ts`.
 * Kept as a factory (not a const handler) so we can extend it later with
 * per-app options (audit hook, custom max-age) without rewriting every
 * call site.
 *
 * Validates the body against the registered theme ids -- the registry is
 * the single source of truth, so the client can never persist an id the
 * emit pipeline didn't generate CSS for.
 *
 * Cookie attributes mirror the appearance cookie: `Path=/; Max-Age=1y;
 * SameSite=Lax; HttpOnly=false`. `httpOnly=false` is intentional -- the
 * pre-hydration script reads it via `document.cookie` to set `data-theme`
 * before SvelteKit hydrates. The `secure` flag is on in prod and off in
 * dev so HTTP localhost still works during development.
 */
export interface CreateThemeEndpointOptions {
	/**
	 * When true, omit the `Secure` cookie attribute (dev / HTTP-localhost).
	 * Pass `dev` from `$app/environment` at the call site so prod always
	 * gets `Secure=true`. Defaults to false (i.e. `Secure=true`) so a
	 * caller that forgets to pass this errs on the safe side.
	 */
	dev?: boolean;
}

export function createThemeEndpoint(options: CreateThemeEndpointOptions = {}): RequestHandler {
	const secure = !options.dev;
	return async ({ request, cookies }) => {
		let payload: unknown;
		try {
			payload = await request.json();
		} catch {
			throw error(400, 'invalid JSON');
		}
		const value = (payload as { value?: unknown } | null)?.value;
		if (!isThemePreference(value)) {
			throw error(400, 'invalid theme value');
		}
		cookies.set(THEME_COOKIE, value, {
			path: '/',
			maxAge: SECONDS_PER_YEAR,
			sameSite: 'lax',
			httpOnly: false,
			secure,
		});
		return json({ ok: true, value });
	};
}
