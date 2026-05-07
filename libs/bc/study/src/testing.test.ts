/**
 * Testing-standards BC aggregator tests. Real Postgres; per-suite slugs and
 * ids keep parallel runs from colliding on the (document_slug, edition)
 * unique index.
 *
 * Coverage:
 *
 *   - landing view: returns one bucket per LIBRARY_TESTING_KIND, the test
 *     fixture publications appear in the right buckets, publications carry
 *     the kind-level fallback copy when no metadata is authored, the
 *     external publisher URL is populated.
 *   - detail view: hydrates a publication by document slug; throws
 *     TestingViewNotFoundError when the slug doesn't resolve OR when the
 *     reference exists but is not an ACS/PTS publication.
 */

import { LIBRARY_TESTING_KINDS, REFERENCE_KINDS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateReferenceId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { reference } from './schema';
import { getTestingView, TestingViewNotFoundError } from './testing';

// -- Per-suite fixture ------------------------------------------------------

const SUITE_TAG = `testing-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_SUFFIX = SUITE_TAG.slice(-6).toLowerCase();

const ACS_SLUG = `test-acs-${SUITE_SUFFIX}`;
const PTS_SLUG = `test-pts-${SUITE_SUFFIX}`;
// A non-testing reference -- used to verify the detail view rejects slugs
// that resolve to refs of other kinds.
const HANDBOOK_SLUG = `test-hb-${SUITE_SUFFIX}`;

const ACS_REF_ID = generateReferenceId();
const PTS_REF_ID = generateReferenceId();
const HANDBOOK_REF_ID = generateReferenceId();

beforeAll(async () => {
	const now = new Date();
	await db.insert(reference).values([
		{
			id: ACS_REF_ID,
			kind: REFERENCE_KINDS.ACS,
			documentSlug: ACS_SLUG,
			edition: 'FAA-S-ACS-TEST',
			title: `Test Pilot ACS (${SUITE_SUFFIX})`,
			publisher: 'FAA',
			url: 'https://www.faa.gov/test-acs',
			metadata: { description: 'Hand-authored ACS description.' },
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: PTS_REF_ID,
			kind: REFERENCE_KINDS.PTS,
			documentSlug: PTS_SLUG,
			edition: 'FAA-S-PTS-TEST',
			title: `Test Pilot PTS (${SUITE_SUFFIX})`,
			publisher: 'FAA',
			url: 'https://www.faa.gov/test-pts',
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: HANDBOOK_REF_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: HANDBOOK_SLUG,
			edition: '2024',
			title: `Test Handbook (${SUITE_SUFFIX})`,
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

describe('getTestingView (landing)', () => {
	it('returns one bucket per testing kind', async () => {
		const view = await getTestingView({ view: 'testing-landing' });
		expect(view.view).toBe('testing-landing');
		expect(view.buckets).toHaveLength(2);
		const kinds = view.buckets.map((b) => b.kind);
		expect(kinds).toContain(LIBRARY_TESTING_KINDS.ACS);
		expect(kinds).toContain(LIBRARY_TESTING_KINDS.PTS);
	});

	it('every bucket carries hand-authored copy and a non-empty label', async () => {
		const view = await getTestingView({ view: 'testing-landing' });
		for (const bucket of view.buckets) {
			expect(bucket.label).toMatch(/\S/);
			expect(bucket.officialTitle).toMatch(/\S/);
			expect(bucket.description).toMatch(/\S/);
			expect(bucket.whyItMatters).toMatch(/\S/);
			expect(bucket.count).toBeGreaterThanOrEqual(0);
			expect(bucket.external).toMatchObject({ url: expect.stringMatching(/^https:\/\//), label: expect.any(String) });
		}
	});

	it('counts the test fixture in each bucket it contributes to', async () => {
		const view = await getTestingView({ view: 'testing-landing' });
		const acs = view.buckets.find((b) => b.kind === LIBRARY_TESTING_KINDS.ACS);
		const pts = view.buckets.find((b) => b.kind === LIBRARY_TESTING_KINDS.PTS);
		expect(acs?.count ?? 0).toBeGreaterThanOrEqual(1);
		expect(pts?.count ?? 0).toBeGreaterThanOrEqual(1);
	});

	it('emits one publication card per ACS/PTS reference', async () => {
		const view = await getTestingView({ view: 'testing-landing' });
		const acsPub = view.publications.find((p) => p.id === ACS_REF_ID);
		expect(acsPub).toBeDefined();
		expect(acsPub?.testingKind).toBe(LIBRARY_TESTING_KINDS.ACS);
		expect(acsPub?.documentSlug).toBe(ACS_SLUG);
		expect(acsPub?.edition).toBe('FAA-S-ACS-TEST');
		// Authored description survives projection.
		expect(acsPub?.description).toBe('Hand-authored ACS description.');
		// External URL falls back to the reference row's url.
		expect(acsPub?.externalUrl).toBe('https://www.faa.gov/test-acs');

		const ptsPub = view.publications.find((p) => p.id === PTS_REF_ID);
		expect(ptsPub).toBeDefined();
		expect(ptsPub?.testingKind).toBe(LIBRARY_TESTING_KINDS.PTS);
	});

	it('publication card uses kind-level fallback copy when metadata is empty', async () => {
		const view = await getTestingView({ view: 'testing-landing' });
		const ptsPub = view.publications.find((p) => p.id === PTS_REF_ID);
		// PTS fixture has no metadata.description; the BC falls back to the
		// LIBRARY_TESTING_KIND_COPY.pts.description so the card is never blank.
		expect(ptsPub?.description).toMatch(/\S/);
		expect(ptsPub?.whyItMatters).toMatch(/\S/);
	});

	it('does not include non-testing references (e.g. handbooks) in publications', async () => {
		const view = await getTestingView({ view: 'testing-landing' });
		const hb = view.publications.find((p) => p.id === HANDBOOK_REF_ID);
		expect(hb).toBeUndefined();
	});

	it('orders ACS publications before PTS publications', async () => {
		const view = await getTestingView({ view: 'testing-landing' });
		const acsIdx = view.publications.findIndex((p) => p.id === ACS_REF_ID);
		const ptsIdx = view.publications.findIndex((p) => p.id === PTS_REF_ID);
		expect(acsIdx).toBeGreaterThanOrEqual(0);
		expect(ptsIdx).toBeGreaterThanOrEqual(0);
		expect(acsIdx).toBeLessThan(ptsIdx);
	});
});

describe('getTestingView (detail)', () => {
	it('returns the publication for an ACS slug', async () => {
		const view = await getTestingView({ view: 'testing-detail', slug: ACS_SLUG });
		expect(view.view).toBe('testing-detail');
		expect(view.reference.id).toBe(ACS_REF_ID);
		expect(view.reference.testingKind).toBe(LIBRARY_TESTING_KINDS.ACS);
		expect(view.copy.officialTitle).toMatch(/\S/);
		expect(view.copy.description).toBe('Hand-authored ACS description.');
		expect(view.external?.url).toBe('https://www.faa.gov/test-acs');
		expect(view.external?.label).toBe('FAA');
	});

	it('returns the publication for a PTS slug', async () => {
		const view = await getTestingView({ view: 'testing-detail', slug: PTS_SLUG });
		expect(view.reference.id).toBe(PTS_REF_ID);
		expect(view.reference.testingKind).toBe(LIBRARY_TESTING_KINDS.PTS);
		// Falls back to kind-level copy when no metadata.description exists.
		expect(view.copy.description).toMatch(/\S/);
	});

	it('throws TestingViewNotFoundError for an unknown slug', async () => {
		await expect(getTestingView({ view: 'testing-detail', slug: 'no-such-slug' })).rejects.toBeInstanceOf(
			TestingViewNotFoundError,
		);
	});

	it('throws TestingViewNotFoundError when the slug resolves to a non-testing reference', async () => {
		await expect(getTestingView({ view: 'testing-detail', slug: HANDBOOK_SLUG })).rejects.toBeInstanceOf(
			TestingViewNotFoundError,
		);
	});
});
