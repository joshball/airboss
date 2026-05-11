/**
 * Persist a reader-typography preference for the signed-in user.
 *
 * Mirror of `apps/flightbag/src/routes/reading-prefs/+server.ts`. Lives on
 * the study origin so `<ReaderPrefsButton>` mounted in study's chrome can
 * POST same-origin (no CSRF preflight, no cross-origin cookie attach).
 *
 * POST `{ key: <one of READING_PREF_KEYS>, value: <validated per schema> }`.
 * Returns `{ ok: true }` on success; 4xx on validation, 401 when not signed
 * in, 500 on a write failure.
 */

import { requireAuth } from '@ab/auth';
import { setUserPref, USER_PREF_SCHEMAS } from '@ab/bc-study/server';
import { READING_PREF_KEYS, type UserPrefKey } from '@ab/constants';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const READING_KEY_SET: ReadonlySet<string> = new Set(READING_PREF_KEYS);

function isReadingPrefKey(key: string): key is UserPrefKey {
	return READING_KEY_SET.has(key);
}

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Body must be JSON.');
	}
	if (typeof body !== 'object' || body === null) {
		throw error(400, 'Body must be an object.');
	}
	const { key, value } = body as { key?: unknown; value?: unknown };
	if (typeof key !== 'string' || !isReadingPrefKey(key)) {
		throw error(400, 'Unknown reading-pref key.');
	}
	const schema = USER_PREF_SCHEMAS[key];
	const parsed = schema.safeParse(value);
	if (!parsed.success) {
		throw error(400, `Invalid value for ${key}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
	}

	try {
		await setUserPref(user.id, key, parsed.data);
	} catch (err) {
		throw error(500, (err as Error).message);
	}
	return json({ ok: true });
};
