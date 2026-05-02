import { SECONDS_PER_YEAR } from '@ab/constants';
import { APPEARANCE_COOKIE, isAppearancePreference } from '@ab/themes';
import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

/**
 * Persist the user's appearance preference for hangar.
 *
 * POST `{ value: 'system' | 'light' | 'dark' }`. Cookie is
 * `Path=/; Max-Age=1y; SameSite=Lax` so every subsequent request (including
 * SSR on first paint) sees the preference. Mirrors `apps/study/appearance`.
 */
export const POST: RequestHandler = async ({ request, cookies, locals, url }) => {
	// Cosmetic preference, but requires a session and a same-origin POST so a
	// drive-by JSON POST can't flip an admin's appearance from a third-party page.
	if (!locals.user) {
		throw error(401, 'sign in required');
	}
	const origin = request.headers.get('origin');
	if (origin !== null && origin !== url.origin) {
		throw error(403, 'cross-origin POST blocked');
	}
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
