/**
 * Picker server-surface tests.
 *
 * Cover the `createThemeEndpoint` factory + the cookie reader. The
 * factory is the only path through which a theme cookie can be set, so
 * its validation behavior is the safety boundary -- it must reject every
 * unknown id, every malformed payload, and every non-string.
 */

import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import '../core/defaults/airboss-default/index';
import '../sim/glass/index';
import '../study/flightdeck/index';
import '../study/sectional/index';
import { createThemeEndpoint, readThemeFromCookies, THEME_COOKIE } from '../picker/server';
import { THEMES } from '../resolve';

interface CookieRecord {
	value: string;
	options: Parameters<Cookies['set']>[2];
}

function makeCookies(initial: Record<string, string> = {}): {
	cookies: Cookies;
	store: Map<string, CookieRecord>;
} {
	const store = new Map<string, CookieRecord>();
	for (const [k, v] of Object.entries(initial)) {
		store.set(k, { value: v, options: { path: '/' } });
	}
	const cookies = {
		get: (name: string) => store.get(name)?.value,
		getAll: () => Array.from(store.entries()).map(([name, r]) => ({ name, value: r.value })),
		set: (name: string, value: string, options: Parameters<Cookies['set']>[2]) => {
			store.set(name, { value, options });
		},
		delete: (name: string) => {
			store.delete(name);
		},
		serialize: () => '',
	} as unknown as Cookies;
	return { cookies, store };
}

function makeRequest(body: unknown): Request {
	return new Request('http://localhost/theme', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	});
}

// Minimal RequestEvent shape -- the handler only touches `request` and
// `cookies`. Cast through `unknown` to avoid pulling SvelteKit's full
// type surface into the unit test.
function makeEvent(body: unknown, cookies: Cookies) {
	return { request: makeRequest(body), cookies } as unknown as Parameters<ReturnType<typeof createThemeEndpoint>>[0];
}

describe('createThemeEndpoint', () => {
	const POST = createThemeEndpoint();

	it('persists a registered theme id to the cookie', async () => {
		const { cookies, store } = makeCookies();
		const res = await POST(makeEvent({ value: THEMES.STUDY_FLIGHTDECK }, cookies));
		expect(res.status).toBe(200);
		const stored = store.get(THEME_COOKIE);
		expect(stored?.value).toBe(THEMES.STUDY_FLIGHTDECK);
		expect(stored?.options).toMatchObject({ path: '/', sameSite: 'lax', httpOnly: false });
	});

	it('returns 400 on invalid JSON', async () => {
		const { cookies } = makeCookies();
		const res = await POST(makeEvent('not json {', cookies)).catch((e) => e);
		expect(res.status).toBe(400);
	});

	it('returns 400 on unknown theme id', async () => {
		const { cookies, store } = makeCookies();
		const res = await POST(makeEvent({ value: 'fake/theme' }, cookies)).catch((e) => e);
		expect(res.status).toBe(400);
		expect(store.has(THEME_COOKIE)).toBe(false);
	});

	it('returns 400 when value is not a string', async () => {
		const { cookies } = makeCookies();
		const res = await POST(makeEvent({ value: 42 }, cookies)).catch((e) => e);
		expect(res.status).toBe(400);
	});

	it('returns 400 when payload is missing value', async () => {
		const { cookies } = makeCookies();
		const res = await POST(makeEvent({}, cookies)).catch((e) => e);
		expect(res.status).toBe(400);
	});

	it('overwrites an existing cookie value', async () => {
		const { cookies, store } = makeCookies({ [THEME_COOKIE]: THEMES.STUDY_SECTIONAL });
		const res = await POST(makeEvent({ value: THEMES.AIRBOSS_DEFAULT }, cookies));
		expect(res.status).toBe(200);
		expect(store.get(THEME_COOKIE)?.value).toBe(THEMES.AIRBOSS_DEFAULT);
	});

	it('uses a one-year max-age so the cookie survives across reloads', async () => {
		const { cookies, store } = makeCookies();
		await POST(makeEvent({ value: THEMES.AIRBOSS_DEFAULT }, cookies));
		const opts = store.get(THEME_COOKIE)?.options;
		expect(typeof opts?.maxAge).toBe('number');
		// One year ± a day's slack -- exact constant lives in `@ab/constants`.
		expect((opts?.maxAge ?? 0) >= 60 * 60 * 24 * 360).toBe(true);
	});
});

describe('readThemeFromCookies', () => {
	it('returns null when the cookie is missing', () => {
		const { cookies } = makeCookies();
		expect(readThemeFromCookies(cookies)).toBeNull();
	});

	it('returns the registered theme id when present', () => {
		const { cookies } = makeCookies({ [THEME_COOKIE]: THEMES.SIM_GLASS });
		expect(readThemeFromCookies(cookies)).toBe(THEMES.SIM_GLASS);
	});

	it('returns null for an unregistered cookie value', () => {
		const { cookies } = makeCookies({ [THEME_COOKIE]: 'rogue/theme' });
		expect(readThemeFromCookies(cookies)).toBeNull();
	});

	it('returns null when the cookie is empty string', () => {
		const { cookies } = makeCookies({ [THEME_COOKIE]: '' });
		expect(readThemeFromCookies(cookies)).toBeNull();
	});
});
