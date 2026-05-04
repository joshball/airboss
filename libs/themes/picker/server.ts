/**
 * Theme picker -- server surface.
 *
 * Single source of truth for the cookie name, the parser, and the POST
 * endpoint factory. All four apps (study, sim, hangar, avionics) wire their
 * `/theme` handler with `createThemeEndpoint()` so the safety contract --
 * registry validation, max-age, SameSite, Path -- can never drift between apps.
 *
 * The cookie / parser / safety helpers live in `../resolve.ts` (kept there
 * because they're used by both client and server during resolution); this
 * file just re-exports them under the `picker` namespace and adds the
 * endpoint factory + the per-request cookie reader for `hooks.server.ts`.
 *
 * The override rule (`/sim/*` -> `sim/glass`, `sim/glass` forces dark) lives
 * inside `resolveThemeSelection` -- not here. Avionics intentionally does NOT
 * lock its theme; it participates in the full light/dark picker. The endpoint
 * just records the user's preference; resolution happens at render time.
 */

import { SECONDS_PER_YEAR } from '@ab/constants';
import { createLogger } from '@ab/utils';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { isThemePreference, parseThemePreference, THEME_COOKIE, type ThemePreference } from '../resolve';

const log = createLogger('themes:picker');

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
	/**
	 * When true, the endpoint rejects requests without `event.locals.user`
	 * (401). Hangar opts in: the surface is admin-only and an anonymous POST
	 * is always either a probe or noise. Study / sim / avionics also opt in
	 * since the picker only ever runs after sign-in. Closes chunk-6 security
	 * MIN: theme cookie endpoint was unauthenticated and lacked a CSRF token.
	 */
	requireAuth?: boolean;
}

export function createThemeEndpoint(options: CreateThemeEndpointOptions = {}): RequestHandler {
	const secure = !options.dev;
	const requireAuth = options.requireAuth === true;
	return async ({ request, cookies, locals }) => {
		const ctx = locals as { user?: { id?: string } | null; requestId?: string } | undefined;
		if (requireAuth && !ctx?.user) {
			throw error(401, 'sign-in required');
		}
		let payload: unknown;
		try {
			payload = await request.json();
		} catch {
			// Bad payloads from a stale client bundle are noise unless the rate
			// climbs; `info` lets the responder spot the rate without paging.
			log.info('theme payload not JSON', {
				requestId: ctx?.requestId,
				userId: ctx?.user?.id ?? null,
			});
			throw error(400, 'invalid JSON');
		}
		const value = (payload as { value?: unknown } | null)?.value;
		if (!isThemePreference(value)) {
			log.info('theme value invalid', {
				requestId: ctx?.requestId,
				userId: ctx?.user?.id ?? null,
				metadata: { value: typeof value === 'string' ? value : typeof value },
			});
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
