import { APPEARANCE_COOKIE, isAppearancePreference } from '@ab/themes';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persist the user's appearance preference for hangar.
 *
 * POST `{ value: 'system' | 'light' | 'dark' }`. Cookie is
 * `Path=/; Max-Age=1y; SameSite=Lax` so every subsequent request (including
 * SSR on first paint) sees the preference. Mirrors `apps/study/appearance`.
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
		maxAge: YEAR_SECONDS,
		sameSite: 'lax',
		httpOnly: false,
		secure: false,
	});
	return json({ ok: true, value });
};
