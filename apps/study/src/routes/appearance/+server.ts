import { dev } from '$app/environment';
import { SECONDS_PER_YEAR } from '@ab/constants';
import { APPEARANCE_COOKIE, isAppearancePreference } from '@ab/themes';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Persist the user's appearance preference.
 *
 * Accepts `{ value: 'system' | 'light' | 'dark' }` as JSON. The cookie is
 * `Path=/; Max-Age=1y; SameSite=Lax` so every subsequent request (including
 * SSR on first paint) sees the preference.
 *
 * Not auth-gated: the toggle is visible on /login too, and the setting is
 * cosmetic -- no session data flows through it.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		throw error(400, 'invalid JSON');
	}
	const value = (payload as { value?: unknown } | null)?.value;
	if (!isAppearancePreference(value)) {
		throw error(400, 'invalid appearance value');
	}
	cookies.set(APPEARANCE_COOKIE, value, {
		path: '/',
		maxAge: SECONDS_PER_YEAR,
		sameSite: 'lax',
		httpOnly: false,
		// Production over HTTPS sets `secure`; dev (HTTP localhost) cannot.
		secure: !dev,
	});
	return json({ ok: true, value });
};
