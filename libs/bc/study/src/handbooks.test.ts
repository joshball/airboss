/**
 * Handbook BC tests. Real Postgres; each spec runs against fresh per-test
 * users + reference rows so parallel runs don't collide on (document_slug,
 * edition) uniqueness.
 *
 * Covers Phase 5 acceptance:
 *   - listReferences excludes superseded by default; opts in via
 *     `includeSuperseded`.
 *   - getReferenceByDocument defaults to latest non-superseded; honors
 *     explicit edition.
 *   - listHandbookChapters returns only level=chapter ordered by ordinal.
 *   - getHandbookSection returns the section + its figures + sibling-section
 *     TOC.
 *   - getNodesCitingSection matches handbook citations correctly across
 *     chapter-only vs section-locator queries.
 *   - resolveCitationUrl returns the right URL for handbook citations and
 *     null for other kinds + legacy freeform.
 *   - recordHeartbeat first-write upserts with `reading` status.
 *   - recordHeartbeat caps delta at 4x interval.
 *   - setComprehended(true) throws when status is unread.
 *   - markAsReread keeps notes, resets status + comprehended.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	HANDBOOK_HEARTBEAT_INTERVAL_SEC,
	HANDBOOK_READ_STATUSES,
	HANDBOOK_SECTION_LEVELS,
	REFERENCE_KINDS,
	ROUTES,
} from '@ab/constants';
import { db } from '@ab/db';
import type { LegacyCitation, StructuredCitation } from '@ab/types';
import { generateAuthId, generateHandbookFigureId, generateHandbookSectionId, generateReferenceId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	getHandbookSection,
	getNodesCitingSection,
	getReferenceByDocument,
	HandbookValidationError,
	listHandbookChapters,
	listReferences,
	markAsReread,
	ReferenceNotFoundError,
	recordHeartbeat,
	resolveCitationUrl,
	setComprehended,
	setNotes,
	setReadStatus,
} from './handbooks';
import {
	handbookFigure,
	handbookReadState,
	handbookSection,
	knowledgeNode,
	type NewKnowledgeNodeRow,
	reference,
} from './schema';

// -- Per-suite fixture ------------------------------------------------------

const SUITE_TAG = `hb-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `${SUITE_TAG}@airboss.test`;

// Suite-scoped slugs so two test suites running in parallel can't collide on
// the (document_slug, edition) unique index. The DB CHECK requires
// `^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$` (3..32 chars, alphanumeric ends), so we
// derive a short hex token and prefix it.
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const PHAK_SLUG = `phak-${SUITE_TOKEN}`;
const AFH_SLUG = `afh-${SUITE_TOKEN}`;

const PHAK_25B_ID = generateReferenceId();
const PHAK_25C_ID = generateReferenceId();
const AFH_3C_ID = generateReferenceId();

const CHAPTER_12_ID = generateHandbookSectionId();
const SECTION_12_3_ID = generateHandbookSectionId();
const SECTION_12_4_ID = generateHandbookSectionId();
const CHAPTER_5_ID = generateHandbookSectionId();
const SECTION_5_1_ID = generateHandbookSectionId();
const FIGURE_12_3_A_ID = generateHandbookFigureId();
const FIGURE_12_3_B_ID = generateHandbookFigureId();

const NODE_CITES_CHAPTER_ID = `kn-${SUITE_TAG}-cites-chapter`;
const NODE_CITES_SECTION_ID = `kn-${SUITE_TAG}-cites-section`;
const NODE_CITES_AFH_ID = `kn-${SUITE_TAG}-cites-afh`;

beforeAll(async () => {
	const now = new Date();

	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Handbook BC Test',
		firstName: 'Handbook',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	// Two PHAK editions (25B superseded by 25C) and one AFH edition.
	await db.insert(reference).values([
		{
			id: PHAK_25B_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: PHAK_SLUG,
			edition: 'FAA-H-8083-25B',
			title: "Pilot's Handbook of Aeronautical Knowledge (25B)",
			publisher: 'FAA',
			url: null,
			supersededById: PHAK_25C_ID,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: PHAK_25C_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: PHAK_SLUG,
			edition: 'FAA-H-8083-25C',
			title: "Pilot's Handbook of Aeronautical Knowledge (25C)",
			publisher: 'FAA',
			url: null,
			supersededById: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: AFH_3C_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: AFH_SLUG,
			edition: 'FAA-H-8083-3C',
			title: 'Airplane Flying Handbook (3C)',
			publisher: 'FAA',
			url: null,
			supersededById: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	// PHAK-25C: chapter 12 with two sections, chapter 5 with one section. The
	// codes mirror what the seed produces in Phase 9.
	await db.insert(handbookSection).values([
		{
			id: CHAPTER_12_ID,
			referenceId: PHAK_25C_ID,
			parentId: null,
			level: HANDBOOK_SECTION_LEVELS.CHAPTER,
			ordinal: 12,
			code: '12',
			title: 'Weather Theory',
			faaPageStart: null,
			faaPageEnd: null,
			sourceLocator: 'PHAK Ch 12',
			contentMd: '',
			contentHash: 'hash-chapter-12',
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SECTION_12_3_ID,
			referenceId: PHAK_25C_ID,
			parentId: CHAPTER_12_ID,
			level: HANDBOOK_SECTION_LEVELS.SECTION,
			ordinal: 3,
			code: '12.3',
			title: 'Atmospheric Pressure and Altitude',
			faaPageStart: '12-3',
			faaPageEnd: '12-3',
			sourceLocator: 'PHAK Ch 12 §3',
			contentMd: 'Pressure decreases with altitude...',
			contentHash: 'hash-12-3',
			hasFigures: true,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SECTION_12_4_ID,
			referenceId: PHAK_25C_ID,
			parentId: CHAPTER_12_ID,
			level: HANDBOOK_SECTION_LEVELS.SECTION,
			ordinal: 4,
			code: '12.4',
			title: 'Density Altitude',
			faaPageStart: '12-4',
			faaPageEnd: '12-4',
			sourceLocator: 'PHAK Ch 12 §4',
			contentMd: 'Density altitude is pressure altitude corrected for...',
			contentHash: 'hash-12-4',
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CHAPTER_5_ID,
			referenceId: PHAK_25C_ID,
			parentId: null,
			level: HANDBOOK_SECTION_LEVELS.CHAPTER,
			ordinal: 5,
			code: '5',
			title: 'Flight Controls',
			faaPageStart: null,
			faaPageEnd: null,
			sourceLocator: 'PHAK Ch 5',
			contentMd: '',
			contentHash: 'hash-chapter-5',
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SECTION_5_1_ID,
			referenceId: PHAK_25C_ID,
			parentId: CHAPTER_5_ID,
			level: HANDBOOK_SECTION_LEVELS.SECTION,
			ordinal: 1,
			code: '5.1',
			title: 'Primary Flight Controls',
			faaPageStart: '5-1',
			faaPageEnd: '5-1',
			sourceLocator: 'PHAK Ch 5 §1',
			contentMd: 'Primary flight controls govern roll, pitch, and yaw...',
			contentHash: 'hash-5-1',
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	// Two figures bound to PHAK 12.3 to test figure ordering.
	await db.insert(handbookFigure).values([
		{
			id: FIGURE_12_3_A_ID,
			sectionId: SECTION_12_3_ID,
			ordinal: 0,
			caption: 'Figure 12-7. Pressure altitude.',
			assetPath: `handbooks/${PHAK_SLUG}/FAA-H-8083-25C/figures/fig-12-7.png`,
			width: 800,
			height: 600,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			id: FIGURE_12_3_B_ID,
			sectionId: SECTION_12_3_ID,
			ordinal: 1,
			caption: 'Figure 12-8. Density altitude chart.',
			assetPath: `handbooks/${PHAK_SLUG}/FAA-H-8083-25C/figures/fig-12-8.png`,
			width: 800,
			height: 600,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
	]);

	// Three knowledge nodes:
	// - one cites PHAK chapter 12 (no section) -- chapter-only locator
	// - one cites PHAK section 12.3 -- full chapter+section locator
	// - one cites AFH chapter 5 -- different reference id
	const baseNode = (
		id: string,
		references: ReadonlyArray<StructuredCitation | LegacyCitation>,
	): NewKnowledgeNodeRow => ({
		id,
		title: id,
		domain: 'weather',
		crossDomains: [],
		knowledgeTypes: [],
		technicalDepth: null,
		stability: null,
		minimumCert: null,
		studyPriority: null,
		modalities: [],
		estimatedTimeMinutes: null,
		reviewTimeMinutes: null,
		references: references as unknown as { source: string; detail: string; note: string }[],
		assessable: false,
		assessmentMethods: [],
		masteryCriteria: null,
		seedOrigin: SUITE_TAG,
		contentMd: 'test',
		contentHash: null,
		version: 1,
		authorId: null,
		lifecycle: null,
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(knowledgeNode).values([
		baseNode(NODE_CITES_CHAPTER_ID, [
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: PHAK_25C_ID,
				locator: { chapter: 12 },
			},
		]),
		baseNode(NODE_CITES_SECTION_ID, [
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: PHAK_25C_ID,
				locator: { chapter: 12, section: 3, page_start: '12-7', page_end: '12-9' },
			},
			// Plus a legacy freeform entry to confirm it is ignored.
			{ source: 'PHAK Ch. 5', detail: 'unstructured', note: '' } satisfies LegacyCitation,
		]),
		baseNode(NODE_CITES_AFH_ID, [
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: AFH_3C_ID,
				locator: { chapter: 5, section: 1 },
			},
		]),
	]);
});

afterAll(async () => {
	await db.delete(handbookReadState).where(eq(handbookReadState.userId, TEST_USER_ID));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(handbookFigure).where(eq(handbookFigure.seedOrigin, SUITE_TAG));
	await db.delete(handbookSection).where(eq(handbookSection.seedOrigin, SUITE_TAG));
	await db.delete(reference).where(eq(reference.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

// -- Tests ------------------------------------------------------------------

describe('listReferences', () => {
	it('excludes superseded editions by default', async () => {
		const rows = await listReferences();
		const ids = new Set(rows.map((r) => r.id));
		expect(ids.has(PHAK_25C_ID)).toBe(true);
		expect(ids.has(AFH_3C_ID)).toBe(true);
		expect(ids.has(PHAK_25B_ID)).toBe(false);
	});

	it('includes superseded editions when opted in', async () => {
		const rows = await listReferences({ includeSuperseded: true });
		const ids = new Set(rows.map((r) => r.id));
		expect(ids.has(PHAK_25B_ID)).toBe(true);
		expect(ids.has(PHAK_25C_ID)).toBe(true);
	});

	it('filters by kind', async () => {
		const rows = await listReferences({ kind: REFERENCE_KINDS.HANDBOOK });
		expect(rows.every((r) => r.kind === REFERENCE_KINDS.HANDBOOK)).toBe(true);
	});
});

describe('getReferenceByDocument', () => {
	it('returns the latest non-superseded edition by default', async () => {
		const ref = await getReferenceByDocument(PHAK_SLUG);
		expect(ref.id).toBe(PHAK_25C_ID);
	});

	it('honors explicit edition', async () => {
		const ref = await getReferenceByDocument(PHAK_SLUG, { edition: 'FAA-H-8083-25B' });
		expect(ref.id).toBe(PHAK_25B_ID);
	});

	it('throws ReferenceNotFoundError on unknown slug', async () => {
		await expect(getReferenceByDocument('does-not-exist')).rejects.toBeInstanceOf(ReferenceNotFoundError);
	});
});

describe('listHandbookChapters', () => {
	it('returns chapter rows ordered by ordinal', async () => {
		const chapters = await listHandbookChapters(PHAK_25C_ID);
		expect(chapters.map((c) => c.code)).toEqual(['5', '12']);
		expect(chapters.every((c) => c.level === HANDBOOK_SECTION_LEVELS.CHAPTER)).toBe(true);
	});
});

describe('getHandbookSection', () => {
	it('returns the section, chapter, ordered figures, and sibling sections', async () => {
		const view = await getHandbookSection(PHAK_25C_ID, '12', '3');
		expect(view.section.id).toBe(SECTION_12_3_ID);
		expect(view.chapter.id).toBe(CHAPTER_12_ID);
		expect(view.figures.map((f) => f.id)).toEqual([FIGURE_12_3_A_ID, FIGURE_12_3_B_ID]);
		expect(view.siblings.map((s) => s.code)).toEqual(['12.3', '12.4']);
	});
});

describe('getNodesCitingSection', () => {
	it('matches both chapter-only and section-locator citations when filtering by chapter alone', async () => {
		const nodes = await getNodesCitingSection({ referenceId: PHAK_25C_ID, chapter: 12 });
		const ids = nodes.map((n) => n.id).sort();
		expect(ids).toEqual([NODE_CITES_CHAPTER_ID, NODE_CITES_SECTION_ID].sort());
	});

	it('matches only section-locator citations when filtering by chapter+section', async () => {
		const nodes = await getNodesCitingSection({ referenceId: PHAK_25C_ID, chapter: 12, section: 3 });
		expect(nodes.map((n) => n.id)).toEqual([NODE_CITES_SECTION_ID]);
	});

	it('does not match nodes citing a different reference', async () => {
		const nodes = await getNodesCitingSection({ referenceId: PHAK_25C_ID, chapter: 5, section: 1 });
		// AFH cites chapter 5 §1 but against a different reference id.
		expect(nodes.map((n) => n.id)).toEqual([]);
	});

	it('matches AFH section when querying its reference id', async () => {
		const nodes = await getNodesCitingSection({ referenceId: AFH_3C_ID, chapter: 5, section: 1 });
		expect(nodes.map((n) => n.id)).toEqual([NODE_CITES_AFH_ID]);
	});
});

describe('resolveCitationUrl', () => {
	it('resolves a handbook section citation', async () => {
		const refs = await listReferences();
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: PHAK_25C_ID,
				locator: { chapter: 12, section: 3 },
			},
			refs,
		);
		expect(url).toBe(ROUTES.HANDBOOK_SECTION(PHAK_SLUG, 12, 3));
	});

	it('resolves a chapter-only citation to the chapter URL', async () => {
		const refs = await listReferences();
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: PHAK_25C_ID,
				locator: { chapter: 12 },
			},
			refs,
		);
		expect(url).toBe(ROUTES.HANDBOOK_CHAPTER(PHAK_SLUG, 12));
	});

	it('returns null for legacy freeform citations', async () => {
		const refs = await listReferences();
		const url = resolveCitationUrl(
			{ source: 'PHAK Ch. 12', detail: 'pressure', note: '' } satisfies LegacyCitation,
			refs,
		);
		expect(url).toBeNull();
	});

	it('returns null for non-handbook structured kinds', async () => {
		const refs = await listReferences();
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.CFR,
				reference_id: 'ref_unknown',
				locator: { title: 14, part: 91, section: '155' },
			},
			refs,
		);
		expect(url).toBeNull();
	});

	it('returns null when reference id does not resolve', async () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: 'ref_does_not_exist',
				locator: { chapter: 12 },
			},
			[],
		);
		expect(url).toBeNull();
	});
});

describe('recordHeartbeat', () => {
	it('first write upserts with reading status and additive seconds', async () => {
		const row = await recordHeartbeat(TEST_USER_ID, SECTION_12_3_ID, HANDBOOK_HEARTBEAT_INTERVAL_SEC);
		expect(row.status).toBe(HANDBOOK_READ_STATUSES.READING);
		expect(row.totalSecondsVisible).toBe(HANDBOOK_HEARTBEAT_INTERVAL_SEC);

		const row2 = await recordHeartbeat(TEST_USER_ID, SECTION_12_3_ID, HANDBOOK_HEARTBEAT_INTERVAL_SEC);
		expect(row2.totalSecondsVisible).toBe(HANDBOOK_HEARTBEAT_INTERVAL_SEC * 2);
	});

	it('caps delta at 4x interval per write', async () => {
		// Use a fresh section so the cap is observable from a known baseline.
		const before = await recordHeartbeat(TEST_USER_ID, SECTION_12_4_ID, HANDBOOK_HEARTBEAT_INTERVAL_SEC);
		expect(before.totalSecondsVisible).toBe(HANDBOOK_HEARTBEAT_INTERVAL_SEC);

		const after = await recordHeartbeat(TEST_USER_ID, SECTION_12_4_ID, 1_000_000);
		const expectedDelta = HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4;
		expect(after.totalSecondsVisible).toBe(HANDBOOK_HEARTBEAT_INTERVAL_SEC + expectedDelta);
	});

	it('rejects deltas below the minimum', async () => {
		await expect(recordHeartbeat(TEST_USER_ID, SECTION_5_1_ID, 1)).rejects.toBeInstanceOf(HandbookValidationError);
	});

	it('does not overwrite an explicit read status', async () => {
		await setReadStatus(TEST_USER_ID, SECTION_5_1_ID, HANDBOOK_READ_STATUSES.READ);
		const row = await recordHeartbeat(TEST_USER_ID, SECTION_5_1_ID, HANDBOOK_HEARTBEAT_INTERVAL_SEC);
		expect(row.status).toBe(HANDBOOK_READ_STATUSES.READ);
	});
});

describe('setComprehended', () => {
	it('throws when status is unread', async () => {
		// Use a fresh section the test user has never opened.
		await expect(setComprehended(TEST_USER_ID, CHAPTER_5_ID, true)).rejects.toBeInstanceOf(HandbookValidationError);
	});

	it('allows setting once status is at least reading', async () => {
		await recordHeartbeat(TEST_USER_ID, SECTION_5_1_ID, HANDBOOK_HEARTBEAT_INTERVAL_SEC);
		// Setting it on a section that's now `read` (from the heartbeat suite above) should succeed.
		const row = await setComprehended(TEST_USER_ID, SECTION_5_1_ID, true);
		expect(row.comprehended).toBe(true);
	});
});

describe('markAsReread', () => {
	it('resets status + comprehended but preserves notes', async () => {
		await setNotes(TEST_USER_ID, SECTION_12_3_ID, 'my private notes');
		await setReadStatus(TEST_USER_ID, SECTION_12_3_ID, HANDBOOK_READ_STATUSES.READ);
		await setComprehended(TEST_USER_ID, SECTION_12_3_ID, true);

		const row = await markAsReread(TEST_USER_ID, SECTION_12_3_ID);
		expect(row.status).toBe(HANDBOOK_READ_STATUSES.UNREAD);
		expect(row.comprehended).toBe(false);
		expect(row.notesMd).toBe('my private notes');
	});
});

describe('setNotes', () => {
	it('upserts notes and rejects oversize input', async () => {
		const row = await setNotes(TEST_USER_ID, SECTION_12_4_ID, 'short note');
		expect(row.notesMd).toBe('short note');

		const tooBig = 'a'.repeat(20_000);
		await expect(setNotes(TEST_USER_ID, SECTION_12_4_ID, tooBig)).rejects.toBeInstanceOf(HandbookValidationError);
	});
});
