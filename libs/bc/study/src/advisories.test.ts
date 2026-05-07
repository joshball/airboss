/**
 * Advisories BC aggregator tests. Real Postgres; per-suite slugs and ids
 * keep parallel runs from colliding on the (document_slug, edition) unique
 * index.
 *
 * Coverage:
 *
 *   - landing view returns one bucket per advisories kind (SAFO + InFO),
 *     each carrying hand-authored copy + the test fixture's bulletin rows.
 *   - bulletins sort newest-first by document slug.
 *   - per-bulletin metadata (date, audience, description) projects from
 *     `metadata` JSONB onto the card payload.
 *   - external link is built off `externalUrlForReference` -- per-bulletin
 *     `url` when authored, kind-level FAA index URL otherwise.
 *   - detail view hydrates a single bulletin by slug + carries kind copy.
 *   - detail view throws AdvisoriesViewNotFoundError when the slug resolves
 *     to nothing OR resolves to a non-advisory reference kind.
 */

import { LIBRARY_ADVISORIES_KINDS, REFERENCE_KINDS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateReferenceId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdvisoriesViewNotFoundError, getAdvisoriesView } from './advisories';
import { reference } from './schema';

// -- Per-suite fixture ------------------------------------------------------

const SUITE_TAG = `adv-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_SUFFIX = SUITE_TAG.slice(-5).toLowerCase();

const SAFO_OLD_SLUG = `safo-90${SUITE_SUFFIX.slice(-3)}`;
const SAFO_NEW_SLUG = `safo-99${SUITE_SUFFIX.slice(-3)}`;
const INFO_SLUG = `info-99${SUITE_SUFFIX.slice(-3)}`;
const NON_ADVISORY_SLUG = `cfrtest-${SUITE_SUFFIX}`;
const MISSING_SLUG = `safo-noexist-${SUITE_SUFFIX}`;

const SAFO_OLD_REF_ID = generateReferenceId();
const SAFO_NEW_REF_ID = generateReferenceId();
const INFO_REF_ID = generateReferenceId();
const NON_ADVISORY_REF_ID = generateReferenceId();

beforeAll(async () => {
	const now = new Date();

	await db.insert(reference).values([
		{
			id: SAFO_OLD_REF_ID,
			kind: REFERENCE_KINDS.SAFO,
			documentSlug: SAFO_OLD_SLUG,
			edition: `SAFO ${SAFO_OLD_SLUG.slice(-5)}`,
			title: 'Older SAFO test fixture',
			publisher: 'FAA',
			url: null,
			metadata: {
				date: '2090-03-15',
				audience: 'Part 91 operators',
				description: 'Older SAFO summary used to test sort order.',
				whyItMatters: 'Sort assertion target.',
			},
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SAFO_NEW_REF_ID,
			kind: REFERENCE_KINDS.SAFO,
			documentSlug: SAFO_NEW_SLUG,
			edition: `SAFO ${SAFO_NEW_SLUG.slice(-5)}`,
			title: 'Newer SAFO test fixture',
			publisher: 'FAA',
			url: 'https://www.faa.gov/test-safo.pdf',
			metadata: {
				date: '2099-08-01',
				audience: 'All operators',
				description: 'Newer SAFO summary; should sort first.',
				whyItMatters: 'Top of the list.',
			},
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: INFO_REF_ID,
			kind: REFERENCE_KINDS.INFO,
			documentSlug: INFO_SLUG,
			edition: `InFO ${INFO_SLUG.slice(-5)}`,
			title: 'InFO test fixture',
			publisher: 'FAA',
			url: 'https://www.faa.gov/test-info.pdf',
			metadata: {
				date: '2099-09-12',
				audience: 'Part 135 operators',
				description: 'InFO summary used by the bucket assertion.',
			},
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			// A non-advisory reference using the same SUITE_TAG so cleanup
			// captures it. Used by the detail-view "wrong kind" assertion.
			id: NON_ADVISORY_REF_ID,
			kind: REFERENCE_KINDS.OTHER,
			documentSlug: NON_ADVISORY_SLUG,
			edition: '2024',
			title: 'Non-advisory fixture',
			publisher: 'FAA',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);
});

afterAll(async () => {
	await db.delete(reference).where(eq(reference.seedOrigin, SUITE_TAG));
});

// -- Tests ------------------------------------------------------------------

describe('getAdvisoriesView (landing)', () => {
	it('returns one bucket per advisories kind', async () => {
		const view = await getAdvisoriesView({ view: 'advisories-landing' });
		expect(view.view).toBe('advisories-landing');
		expect(view.buckets).toHaveLength(2);
		const kinds = view.buckets.map((b) => b.kind);
		expect(kinds).toContain(LIBRARY_ADVISORIES_KINDS.SAFO);
		expect(kinds).toContain(LIBRARY_ADVISORIES_KINDS.INFO);
	});

	it('every bucket carries hand-authored copy', async () => {
		const view = await getAdvisoriesView({ view: 'advisories-landing' });
		for (const bucket of view.buckets) {
			expect(bucket.label).toMatch(/\S/);
			expect(bucket.shortLabel).toMatch(/\S/);
			expect(bucket.officialTitle).toMatch(/\S/);
			expect(bucket.description).toMatch(/\S/);
			expect(bucket.whyItMatters).toMatch(/\S/);
			expect(bucket.count).toBeGreaterThanOrEqual(0);
		}
	});

	it('counts the test fixtures in each kind they contribute to', async () => {
		const view = await getAdvisoriesView({ view: 'advisories-landing' });
		const safo = view.buckets.find((b) => b.kind === LIBRARY_ADVISORIES_KINDS.SAFO);
		const info = view.buckets.find((b) => b.kind === LIBRARY_ADVISORIES_KINDS.INFO);
		expect(safo?.count ?? 0).toBeGreaterThanOrEqual(2);
		expect(info?.count ?? 0).toBeGreaterThanOrEqual(1);
	});

	it('SAFO bucket lists test fixtures newest-first', async () => {
		const view = await getAdvisoriesView({ view: 'advisories-landing' });
		const safo = view.buckets.find((b) => b.kind === LIBRARY_ADVISORIES_KINDS.SAFO);
		const slugs = safo?.bulletins.map((b) => b.documentSlug) ?? [];
		const newIdx = slugs.indexOf(SAFO_NEW_SLUG);
		const oldIdx = slugs.indexOf(SAFO_OLD_SLUG);
		expect(newIdx).toBeGreaterThanOrEqual(0);
		expect(oldIdx).toBeGreaterThanOrEqual(0);
		expect(newIdx).toBeLessThan(oldIdx);
	});

	it('bulletin cards project metadata fields onto the payload', async () => {
		const view = await getAdvisoriesView({ view: 'advisories-landing' });
		const safo = view.buckets.find((b) => b.kind === LIBRARY_ADVISORIES_KINDS.SAFO);
		const card = safo?.bulletins.find((b) => b.documentSlug === SAFO_NEW_SLUG);
		expect(card).toBeDefined();
		expect(card?.date).toBe('2099-08-01');
		expect(card?.audience).toBe('All operators');
		expect(card?.description).toBe('Newer SAFO summary; should sort first.');
		expect(card?.whyItMatters).toBe('Top of the list.');
	});

	it('bulletin cards expose an external link (per-bulletin URL when authored, FAA index otherwise)', async () => {
		const view = await getAdvisoriesView({ view: 'advisories-landing' });
		const safo = view.buckets.find((b) => b.kind === LIBRARY_ADVISORIES_KINDS.SAFO);
		const newCard = safo?.bulletins.find((b) => b.documentSlug === SAFO_NEW_SLUG);
		const oldCard = safo?.bulletins.find((b) => b.documentSlug === SAFO_OLD_SLUG);
		expect(newCard?.external?.url).toBe('https://www.faa.gov/test-safo.pdf');
		expect(newCard?.external?.label).toBe('FAA');
		// Old fixture has no per-bulletin URL -- falls back to the kind-level
		// SAFO index URL emitted by externalUrlForReference.
		expect(oldCard?.external?.url).toContain('/safo');
	});
});

describe('getAdvisoriesView (detail)', () => {
	it('hydrates a single SAFO bulletin by slug', async () => {
		const view = await getAdvisoriesView({ view: 'advisories-detail', slug: SAFO_NEW_SLUG });
		expect(view.view).toBe('advisories-detail');
		expect(view.bulletin.documentSlug).toBe(SAFO_NEW_SLUG);
		expect(view.bulletin.kind).toBe(LIBRARY_ADVISORIES_KINDS.SAFO);
		expect(view.bulletin.title).toBe('Newer SAFO test fixture');
		expect(view.bulletin.date).toBe('2099-08-01');
		expect(view.kindCopy.shortLabel).toBe('SAFO');
	});

	it('hydrates a single InFO bulletin by slug', async () => {
		const view = await getAdvisoriesView({ view: 'advisories-detail', slug: INFO_SLUG });
		expect(view.bulletin.documentSlug).toBe(INFO_SLUG);
		expect(view.bulletin.kind).toBe(LIBRARY_ADVISORIES_KINDS.INFO);
		expect(view.kindCopy.shortLabel).toBe('InFO');
	});

	it('throws AdvisoriesViewNotFoundError when the slug resolves to nothing', async () => {
		await expect(getAdvisoriesView({ view: 'advisories-detail', slug: MISSING_SLUG })).rejects.toBeInstanceOf(
			AdvisoriesViewNotFoundError,
		);
	});

	it('throws AdvisoriesViewNotFoundError when the slug resolves to a non-advisory reference', async () => {
		await expect(getAdvisoriesView({ view: 'advisories-detail', slug: NON_ADVISORY_SLUG })).rejects.toBeInstanceOf(
			AdvisoriesViewNotFoundError,
		);
	});
});
