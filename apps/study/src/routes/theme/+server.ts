import { SECONDS_PER_YEAR } from '@ab/constants';
import { isThemePreference, THEME_COOKIE } from '@ab/themes';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Persist the user's theme preference.
 *
 * Accepts `{ value: '<registered theme id>' }` as JSON. Validation goes through
 * the registry (`isThemePreference` -> `isValidThemeId`), so unknown ids are
 * rejected at the boundary -- the client can never write a theme id that the
 * emit pipeline didn't generate CSS for.
 *
 * The cookie is `Path=/; Max-Age=1y; SameSite=Lax` so every subsequent request
 * (including SSR on first paint) sees the preference. Mirrors the
 * appearance-cookie pattern in /appearance/+server.ts.
 *
 * Not auth-gated: theme is cosmetic, no session data flows through it, and the
 * picker is visible everywhere the nav renders.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
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
		secure: false,
	});
	return json({ ok: true, value });
};
