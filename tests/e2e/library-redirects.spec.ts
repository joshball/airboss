/**
 * Study `/library/*` -> flightbag redirect smoke.
 *
 * Per ADR 023 + WP-FLIGHTBAG-READER-UX Phase 2, every legacy `/library/*`
 * URL in study is a 301 to the equivalent flightbag URL. This spec
 * exercises the redirect chain end-to-end:
 *
 *   1. Hit each legacy URL with redirects disabled.
 *   2. Confirm a 301 status.
 *   3. Confirm `Location:` points at the expected flightbag URL.
 *
 * The spec doesn't load the redirected page (that's covered by
 * `flightbag/representative-pages.spec.ts`). The contract here is just
 * "the legacy URL still resolves to a real flightbag deep link," so a
 * stale citation chip doesn't 404 a user.
 */

import { expect, test } from '@playwright/test';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DEV_DB_URL_E2E, REFERENCE_KINDS } from '../../libs/constants/src';
import { reference } from '../../libs/bc/study/src/schema';

interface SeededHandbook {
	readonly documentSlug: string;
	readonly edition: string;
}

function shortHandbookEdition(edition: string): string {
	if (edition.startsWith('FAA-H-')) return edition.slice('FAA-H-'.length);
	return edition;
}

let phak: SeededHandbook | null = null;

test.beforeAll(async () => {
	const sql = postgres(DEV_DB_URL_E2E);
	const db = drizzle(sql);
	const rows = await db
		.select({ documentSlug: reference.documentSlug, edition: reference.edition })
		.from(reference)
		.where(eq(reference.kind, REFERENCE_KINDS.HANDBOOK))
		.orderBy(asc(reference.documentSlug));
	await sql.end();
	phak = rows.find((r) => r.documentSlug === 'phak') ?? rows[0] ?? null;
});

test.describe('study /library/* -> flightbag redirects', () => {
	test('library catalog 301s to flightbag home', async ({ request }) => {
		const response = await request.get('/library', { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		const location = response.headers().location ?? '';
		expect(location).toMatch(/\/$/);
		expect(location).toMatch(/flightbag\./);
	});

	test('library handbook landing 301s to flightbag handbook landing with latest edition', async ({ request }) => {
		test.skip(phak === null, 'no handbook seeded');
		if (phak === null) return;
		const response = await request.get(`/library/handbook/${phak.documentSlug}`, { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		const location = response.headers().location ?? '';
		const expectedEdition = shortHandbookEdition(phak.edition);
		expect(location).toContain(`/handbook/${phak.documentSlug}/${expectedEdition}`);
		expect(location).toMatch(/flightbag\./);
	});

	test('library handbook chapter 301s to flightbag chapter URL', async ({ request }) => {
		test.skip(phak === null, 'no handbook seeded');
		if (phak === null) return;
		const response = await request.get(`/library/handbook/${phak.documentSlug}/4`, { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		const location = response.headers().location ?? '';
		const expectedEdition = shortHandbookEdition(phak.edition);
		expect(location).toContain(`/handbook/${phak.documentSlug}/${expectedEdition}/4`);
	});

	test('library handbook section 301s to flightbag section URL', async ({ request }) => {
		test.skip(phak === null, 'no handbook seeded');
		if (phak === null) return;
		const response = await request.get(`/library/handbook/${phak.documentSlug}/4/2`, { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		const location = response.headers().location ?? '';
		const expectedEdition = shortHandbookEdition(phak.edition);
		expect(location).toContain(`/handbook/${phak.documentSlug}/${expectedEdition}/4/2`);
	});

	test('library regulations index 301s to flightbag home', async ({ request }) => {
		const response = await request.get('/library/regulations', { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		expect(response.headers().location).toMatch(/flightbag\./);
	});

	test('library regulations 14 CFR section 301s to flightbag CFR section URL', async ({ request }) => {
		const response = await request.get('/library/regulations/14-cfr/91/91.107', { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		const location = response.headers().location ?? '';
		expect(location).toContain('/cfr/14/91/91.107');
	});

	test('library testing detail 301s to flightbag ACS URL', async ({ request }) => {
		const response = await request.get('/library/testing/acs-private-airplane', { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		expect(response.headers().location).toContain('/acs/acs-private-airplane');
	});

	test('library advisories landing 301s to flightbag home', async ({ request }) => {
		const response = await request.get('/library/advisories', { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		expect(response.headers().location).toMatch(/flightbag\./);
	});

	test('library advisories SAFO bulletin 301s to flightbag SAFO URL', async ({ request }) => {
		const response = await request.get('/library/advisories/safo-23001', { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		expect(response.headers().location).toContain('/safo/23001');
	});

	test('library aircraft slug returns 410 Gone (no flightbag equivalent yet)', async ({ request }) => {
		const response = await request.get('/library/aircraft/c172', { maxRedirects: 0 });
		expect(response.status()).toBe(410);
	});

	test('library topic 301s to flightbag landing with topic query', async ({ request }) => {
		const response = await request.get('/library/topic/weather', { maxRedirects: 0 });
		expect(response.status()).toBe(301);
		const location = response.headers().location ?? '';
		expect(location).toContain('?topic=weather');
	});
});
