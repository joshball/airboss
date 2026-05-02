/**
 * Unit tests for cookie forwarding.
 *
 * The critical invariant: better-auth issues short-lived cookies (notably the
 * 5-minute `bauth_session_data` cookie-cache) alongside the long-lived session
 * cookie. Forwarding all of them with one fixed Max-Age silently extends the
 * short ones -- and the cookie-cache is the propagation channel for ban /
 * role-change, so extending it neutralizes those guarantees.
 *
 * These tests pin that invariant so a future refactor cannot regress it.
 */

import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { forwardAuthCookies } from './cookies';

interface RecordedCookie {
	name: string;
	value: string;
	maxAge: number | undefined;
}

function makeCookies(): { cookies: Cookies; set: RecordedCookie[]; deleted: string[] } {
	const set: RecordedCookie[] = [];
	const deleted: string[] = [];
	const cookies = {
		set: (name: string, value: string, opts: { maxAge?: number }) => {
			set.push({ name, value, maxAge: opts.maxAge });
		},
		delete: (name: string) => {
			deleted.push(name);
		},
		// Unused by the SUT but required by the type
		get: () => undefined,
		getAll: () => [],
		serialize: () => '',
	} as unknown as Cookies;
	return { cookies, set, deleted };
}

function makeResponseWithSetCookies(setCookieHeaders: string[]): Response {
	const headers = new Headers();
	for (const sc of setCookieHeaders) headers.append('set-cookie', sc);
	return new Response(null, { status: 200, headers });
}

describe('forwardAuthCookies', () => {
	it('preserves a short Max-Age set by better-auth (the ban-propagation invariant)', () => {
		// better-auth's cookie-cache cookie has Max-Age=300 (5 minutes).
		// Forwarding must NOT extend this to the session lifetime.
		const response = makeResponseWithSetCookies([
			'bauth_session_data=abc123; Path=/; HttpOnly; Max-Age=300; SameSite=Lax',
		]);
		const { cookies, set } = makeCookies();

		forwardAuthCookies(response, cookies, true, 'localhost', 60 * 60 * 24 * 7);

		expect(set).toHaveLength(1);
		expect(set[0].name).toBe('bauth_session_data');
		expect(set[0].maxAge).toBe(300);
	});

	it('falls back to the configured maxAge only when better-auth set no Max-Age and no Expires', () => {
		const response = makeResponseWithSetCookies(['bauth_session_token=xyz; Path=/; HttpOnly; SameSite=Lax']);
		const { cookies, set } = makeCookies();

		forwardAuthCookies(response, cookies, true, 'localhost', 12345);

		expect(set).toHaveLength(1);
		expect(set[0].maxAge).toBe(12345);
	});

	it('preserves Max-Age across multiple cookies with different lifetimes (independent preservation)', () => {
		const response = makeResponseWithSetCookies([
			'bauth_session_token=longlived; Path=/; HttpOnly; Max-Age=604800',
			'bauth_session_data=shortcache; Path=/; HttpOnly; Max-Age=300',
		]);
		const { cookies, set } = makeCookies();

		forwardAuthCookies(response, cookies, true, 'localhost');

		expect(set.find((c) => c.name === 'bauth_session_token')?.maxAge).toBe(604800);
		expect(set.find((c) => c.name === 'bauth_session_data')?.maxAge).toBe(300);
	});

	it('falls back to Expires when Max-Age is absent (RFC 6265 fallback)', () => {
		const inFiveMinutes = new Date(Date.now() + 5 * 60 * 1000).toUTCString();
		const response = makeResponseWithSetCookies([`bauth_session_data=val; Path=/; HttpOnly; Expires=${inFiveMinutes}`]);
		const { cookies, set } = makeCookies();

		forwardAuthCookies(response, cookies, true, 'localhost');

		expect(set).toHaveLength(1);
		// Allow ±2s of skew between Date.now() in test and in SUT.
		expect(set[0].maxAge).toBeGreaterThanOrEqual(298);
		expect(set[0].maxAge).toBeLessThanOrEqual(300);
	});

	it('treats Max-Age=0 as a delete, regardless of date format on Expires', () => {
		const response = makeResponseWithSetCookies([
			'bauth_session_token=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
		]);
		const { cookies, set, deleted } = makeCookies();

		forwardAuthCookies(response, cookies, true, 'localhost');

		expect(set).toHaveLength(0);
		expect(deleted).toEqual(['bauth_session_token']);
	});

	it('treats a past Expires as a delete even if Max-Age is absent', () => {
		const inThePast = new Date(Date.now() - 60 * 1000).toUTCString();
		const response = makeResponseWithSetCookies([`bauth_session_token=; Path=/; HttpOnly; Expires=${inThePast}`]);
		const { cookies, set, deleted } = makeCookies();

		forwardAuthCookies(response, cookies, true, 'localhost');

		expect(set).toHaveLength(0);
		expect(deleted).toEqual(['bauth_session_token']);
	});

	it('treats an empty value as a delete (defense-in-depth for missing TTL hints)', () => {
		const response = makeResponseWithSetCookies(['bauth_session_token=; Path=/; HttpOnly']);
		const { cookies, set, deleted } = makeCookies();

		forwardAuthCookies(response, cookies, true, 'localhost');

		expect(set).toHaveLength(0);
		expect(deleted).toEqual(['bauth_session_token']);
	});

	it('decodes URL-encoded cookie values', () => {
		const response = makeResponseWithSetCookies(['bauth_session_token=a%2Fb%2Bc; Path=/; HttpOnly; Max-Age=600']);
		const { cookies, set } = makeCookies();

		forwardAuthCookies(response, cookies, true, 'localhost');

		expect(set).toHaveLength(1);
		expect(set[0].value).toBe('a/b+c');
	});
});
