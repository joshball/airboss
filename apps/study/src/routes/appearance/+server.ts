import { SECONDS_PER_YEAR } from '@ab/constants';
import { APPEARANCE_COOKIE, isAppearancePreference } from '@ab/themes';
import { createLogger } from '@ab/utils';
import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

const log = createLogger('study:appearance');

/**
 * Persist the user's appearance preference.
 *
 * Accepts `{ value: 'system' | 'light' | 'dark' }` as JSON. The cookie is
 * `Path=/; Max-Age=1y; SameSite=Lax` so every subsequent request (including
 * SSR on first paint) sees the preference.
 *
 * Not auth-gated: the toggle is visible on /login too, and the setting is
 * cosmetic -- no session data flows through it.
 *
 * 400 paths are logged at `info` so a broken client (stale bundle, bad
 * payload) shows up in telemetry without paging anyone -- the surface is
 * cosmetic and a bad request is just noise unless the rate climbs.
 */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		log.info('appearance payload not JSON', {
			requestId: locals.requestId,
			userId: locals.user?.id ?? null,
		});
		throw error(400, 'invalid JSON');
	}
	const value = (payload as { value?: unknown } | null)?.value;
	if (!isAppearancePreference(value)) {
		log.info('appearance value invalid', {
			requestId: locals.requestId,
			userId: locals.user?.id ?? null,
			metadata: { value: typeof value === 'string' ? value : typeof value },
		});
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
