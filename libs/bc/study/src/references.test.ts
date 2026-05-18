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

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bauthUser } from '@ab/auth/schema';
import {
	HANDBOOK_HEARTBEAT_INTERVAL_SEC,
	HANDBOOK_READ_STATUSES,
	REFERENCE_KINDS,
	REFERENCE_SECTION_LEVELS,
	ROUTES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import {
	__ac_seed_mapping_internal__,
	airbossRefForHandbookSection,
	type SourceId,
	sourceIdForReference,
} from '@ab/sources';
import { editions as editionsTable, upsertEdition } from '@ab/sources/server';
import type { LegacyCitation, StructuredCitation } from '@ab/types';
import { generateAuthId, generateReferenceFigureId, generateReferenceId, generateReferenceSectionId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	getHandbookChapter,
	getHandbookProgressMap,
	getHandbookSection,
	getNodesCitingSection,
	getNodesCitingSectionsBatch,
	getOpenWarningsForReference,
	getReferenceByDocument,
	HandbookSectionNotFoundError,
	HandbookValidationError,
	listHandbookChapters,
	listReferences,
	markAsReread,
	ReferenceNotFoundError,
	recordHeartbeat,
	resolveCitationUrl,
	StaleWarningsTriageError,
	setComprehended,
	setReadStatus,
} from './references';
import {
	knowledgeNode,
	type NewKnowledgeNodeRow,
	type ReferenceRow,
	reference,
	referenceFigure,
	referenceSection,
	referenceSectionReadState,
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

const CHAPTER_12_ID = generateReferenceSectionId();
const SECTION_12_3_ID = generateReferenceSectionId();
const SECTION_12_4_ID = generateReferenceSectionId();
const SUBSECTION_12_3_4_ID = generateReferenceSectionId();
const CHAPTER_5_ID = generateReferenceSectionId();
const SECTION_5_1_ID = generateReferenceSectionId();
const FIGURE_12_3_A_ID = generateReferenceFigureId();
const FIGURE_12_3_B_ID = generateReferenceFigureId();

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

	// Two PHAK editions (25B retired in registry, 25C current) and one AFH
	// edition. Per ADR 026: edition supersession lives in
	// `sources_registry.editions`; the `study.reference.edition` column
	// remains a denormalized cache populated by the seed.
	const phakSlugForRegistry = PHAK_SLUG;
	const afhSlugForRegistry = AFH_SLUG;

	const phakRows = [
		{
			id: PHAK_25B_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: phakSlugForRegistry,
			edition: 'FAA-H-8083-25B',
			title: "Pilot's Handbook of Aeronautical Knowledge (25B)",
			publisher: 'FAA',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: PHAK_25C_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: phakSlugForRegistry,
			edition: 'FAA-H-8083-25C',
			title: "Pilot's Handbook of Aeronautical Knowledge (25C)",
			publisher: 'FAA',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: AFH_3C_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: afhSlugForRegistry,
			edition: 'FAA-H-8083-3C',
			title: 'Airplane Flying Handbook (3C)',
			publisher: 'FAA',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	];
	await db.insert(reference).values(phakRows);

	// Seed registry editions: PHAK 25B retired, PHAK 25C current, AFH 3C
	// current. Mirrors the post-WP seed contract: the registry is the source
	// of truth; the `notSupersededInRegistry` predicate consults these rows.
	const phakSourceId = sourceIdForReference({ kind: 'handbook', documentSlug: phakSlugForRegistry }) as SourceId;
	const afhSourceId = sourceIdForReference({ kind: 'handbook', documentSlug: afhSlugForRegistry }) as SourceId;
	await upsertEdition({ sourceId: phakSourceId, editionLabel: 'FAA-H-8083-25B', publishedAt: now, retiredAt: now });
	await upsertEdition({ sourceId: phakSourceId, editionLabel: 'FAA-H-8083-25C', publishedAt: now });
	await upsertEdition({ sourceId: afhSourceId, editionLabel: 'FAA-H-8083-3C', publishedAt: now });

	// PHAK-25C: chapter 12 with two sections, chapter 5 with one section. The
	// codes mirror what the seed produces in Phase 9.
	await db.insert(referenceSection).values([
		{
			id: CHAPTER_12_ID,
			referenceId: PHAK_25C_ID,
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
			ordinal: 12,
			depth: 0,
			code: '12',
			airbossRef: airbossRefForHandbookSection(PHAK_SLUG, 'FAA-H-8083-25C', '12'),
			title: 'Weather Theory',
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
			level: REFERENCE_SECTION_LEVELS.SECTION,
			ordinal: 3,
			depth: 1,
			code: '12.3',
			airbossRef: airbossRefForHandbookSection(PHAK_SLUG, 'FAA-H-8083-25C', '12.3'),
			title: 'Atmospheric Pressure and Altitude',
			metadata: { faaPages: { start: '12-3', end: '12-3' } },
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
			level: REFERENCE_SECTION_LEVELS.SECTION,
			ordinal: 4,
			depth: 1,
			code: '12.4',
			airbossRef: airbossRefForHandbookSection(PHAK_SLUG, 'FAA-H-8083-25C', '12.4'),
			title: 'Density Altitude',
			metadata: { faaPages: { start: '12-4', end: '12-4' } },
			sourceLocator: 'PHAK Ch 12 §4',
			contentMd: 'Density altitude is pressure altitude corrected for...',
			contentHash: 'hash-12-4',
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		// Subsection under §12.3 -- exercises the multi-dot code path. Real
		// PHAK ingestion produces these (e.g. `1.2.1`, `1.2.2`); the fixture
		// guards `getHandbookSection` + `getHandbookChapter` against treating
		// a section row as a chapter when a hand-typed URL probes the
		// multi-dot path.
		{
			id: SUBSECTION_12_3_4_ID,
			referenceId: PHAK_25C_ID,
			parentId: SECTION_12_3_ID,
			level: REFERENCE_SECTION_LEVELS.SUBSECTION,
			ordinal: 4,
			depth: 2,
			code: '12.3.4',
			airbossRef: airbossRefForHandbookSection(PHAK_SLUG, 'FAA-H-8083-25C', '12.3.4'),
			title: 'Subsection used for level-guard tests',
			metadata: { faaPages: { start: '12-3', end: '12-3' } },
			sourceLocator: 'PHAK Ch 12 §3.4',
			contentMd: 'Synthetic subsection.',
			contentHash: 'hash-12-3-4',
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
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
			ordinal: 5,
			depth: 0,
			code: '5',
			airbossRef: airbossRefForHandbookSection(PHAK_SLUG, 'FAA-H-8083-25C', '5'),
			title: 'Flight Controls',
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
			level: REFERENCE_SECTION_LEVELS.SECTION,
			ordinal: 1,
			depth: 1,
			code: '5.1',
			airbossRef: airbossRefForHandbookSection(PHAK_SLUG, 'FAA-H-8083-25C', '5.1'),
			title: 'Primary Flight Controls',
			metadata: { faaPages: { start: '5-1', end: '5-1' } },
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
	await db.insert(referenceFigure).values([
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
	await db.delete(referenceSectionReadState).where(eq(referenceSectionReadState.userId, TEST_USER_ID));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(referenceFigure).where(eq(referenceFigure.seedOrigin, SUITE_TAG));
	await db.delete(referenceSection).where(eq(referenceSection.seedOrigin, SUITE_TAG));
	await db.delete(reference).where(eq(reference.seedOrigin, SUITE_TAG));
	const phakSourceId = sourceIdForReference({ kind: 'handbook', documentSlug: PHAK_SLUG });
	const afhSourceId = sourceIdForReference({ kind: 'handbook', documentSlug: AFH_SLUG });
	await db.delete(editionsTable).where(eq(editionsTable.sourceId, phakSourceId));
	await db.delete(editionsTable).where(eq(editionsTable.sourceId, afhSourceId));
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
		expect(chapters.every((c) => c.level === REFERENCE_SECTION_LEVELS.CHAPTER)).toBe(true);
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

	// Wave 4 fix: the chapter slot must be a level=chapter row. The fixture
	// includes `12.3` (section) + `12.3.4` (subsection). A hand-typed URL of
	// `/library/handbook/<slug>/12.3/4` would call
	// `getHandbookSection(refId, '12.3', '4')` -> `fullCode='12.3.4'` (a real
	// subsection row exists). Pre-fix, the chapter slot would be filled with
	// the SECTION row code='12.3' -- the page would render with a section in
	// the chapter header. Post-fix, the chapter resolver requires
	// `level=chapter`, so the request 404s cleanly.
	it('throws when the chapterCode resolves to a non-chapter row (level guard)', async () => {
		await expect(getHandbookSection(PHAK_25C_ID, '12.3', '4')).rejects.toBeInstanceOf(HandbookSectionNotFoundError);
	});
});

describe('getHandbookChapter', () => {
	it('returns the chapter row by code', async () => {
		const chapter = await getHandbookChapter(PHAK_25C_ID, '12');
		expect(chapter.id).toBe(CHAPTER_12_ID);
		expect(chapter.level).toBe(REFERENCE_SECTION_LEVELS.CHAPTER);
	});

	// Wave 4 fix: chapter resolution must filter by `level=chapter`. Before
	// the fix, a section row with a multi-dot code (e.g. '12.3') would be
	// returned when a hand-typed URL like /library/handbook/<slug>/12.3
	// reached the chapter resolver. The page would then render with a
	// section row in the chapter slot. The fixed behaviour: 404 cleanly.
	it('throws when the code matches a non-chapter row (level guard)', async () => {
		await expect(getHandbookChapter(PHAK_25C_ID, '12.3')).rejects.toBeInstanceOf(HandbookSectionNotFoundError);
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

describe('getNodesCitingSectionsBatch', () => {
	it('groups citing nodes per requested section in one query', async () => {
		const map = await getNodesCitingSectionsBatch({
			referenceId: PHAK_25C_ID,
			chapter: 12,
			sections: [3, 4],
		});
		// section 3 has the section-locator citation; section 4 has none. The
		// chapter-only NODE_CITES_CHAPTER_ID node should NOT appear -- this
		// helper buckets per section, and a chapter-only locator does not
		// resolve to a section.
		expect(map.get(3)?.map((n) => n.id)).toEqual([NODE_CITES_SECTION_ID]);
		expect(map.get(4)).toEqual([]);
	});

	it('returns empty arrays for unrequested or unmatched sections', async () => {
		const map = await getNodesCitingSectionsBatch({
			referenceId: PHAK_25C_ID,
			chapter: 5,
			sections: [1],
		});
		// AFH cites 5.1 but references a different reference id, so PHAK 5.1
		// has no citers.
		expect(map.get(1)).toEqual([]);
	});

	it('returns an empty Map for an empty sections list', async () => {
		const map = await getNodesCitingSectionsBatch({
			referenceId: PHAK_25C_ID,
			chapter: 12,
			sections: [],
		});
		expect(map.size).toBe(0);
	});

	it('does not match nodes from other reference ids', async () => {
		// Same chapter+section as the AFH node but probing the wrong reference id.
		const map = await getNodesCitingSectionsBatch({
			referenceId: PHAK_25C_ID,
			chapter: 5,
			sections: [1],
		});
		expect(map.get(1)).toEqual([]);
	});
});

describe('getHandbookProgressMap', () => {
	it('returns per-reference summary keyed by reference id', async () => {
		const map = await getHandbookProgressMap(TEST_USER_ID, [PHAK_25C_ID, AFH_3C_ID]);
		expect(map.size).toBe(2);
		const phak = map.get(PHAK_25C_ID);
		// Four non-chapter rows seeded under PHAK-25C: 12.3, 12.4, 12.3.4, 5.1.
		// (Two chapters do not count toward the section total -- this mirrors
		// the per-row helper's `<> chapter` filter.)
		expect(phak?.totalSections).toBe(4);
		expect(phak?.readSections).toBe(0);
		expect(phak?.readingSections).toBe(0);
		expect(phak?.unreadSections).toBe(4);
		expect(phak?.comprehendedSections).toBe(0);

		const afh = map.get(AFH_3C_ID);
		expect(afh?.totalSections).toBe(0);
		expect(afh?.unreadSections).toBe(0);
	});

	it('returns empty Map for empty input', async () => {
		const map = await getHandbookProgressMap(TEST_USER_ID, []);
		expect(map.size).toBe(0);
	});

	it('returns zero summary for unknown reference ids without throwing', async () => {
		const fake = generateReferenceId();
		const map = await getHandbookProgressMap(TEST_USER_ID, [fake]);
		expect(map.get(fake)).toEqual({
			totalSections: 0,
			readSections: 0,
			readingSections: 0,
			unreadSections: 0,
			comprehendedSections: 0,
		});
	});
});

describe('resolveCitationUrl', () => {
	// Handbook citation routing is exercised against a hand-built reference
	// row carrying the canonical `phak` slug. The flightbag handbook URL
	// helper validates the doc slug against the `HANDBOOK_DOC_SLUGS`
	// allowlist, so the suite-tokenised slugs the DB fixture uses for
	// (document_slug, edition) isolation would not route -- a real slug is
	// required here. The resolver is pure given its `references` argument.
	const phakHandbookRef = (): ReferenceRow => ({
		id: PHAK_25C_ID,
		kind: REFERENCE_KINDS.HANDBOOK,
		documentSlug: 'phak',
		edition: 'FAA-H-8083-25C',
		title: "Pilot's Handbook of Aeronautical Knowledge (25C)",
		publisher: 'FAA',
		url: null,
		subjects: [],
		primaryCert: null,
		sectionSchema: {},
		metadata: {},
		seedOrigin: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	it('resolves a handbook section citation to the flightbag reader URL', () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: PHAK_25C_ID,
				locator: { chapter: 12, section: 3 },
			},
			[phakHandbookRef()],
		);
		expect(url).toBe(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '3'));
	});

	it('resolves a chapter-only citation to the flightbag chapter URL', () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: PHAK_25C_ID,
				locator: { chapter: 12 },
			},
			[phakHandbookRef()],
		);
		expect(url).toBe(ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '12'));
	});

	it('returns null for legacy freeform citations', async () => {
		const refs = await listReferences();
		const url = resolveCitationUrl(
			{ source: 'PHAK Ch. 12', detail: 'pressure', note: '' } satisfies LegacyCitation,
			refs,
		);
		expect(url).toBeNull();
	});

	it('resolves a CFR citation to an eCFR URL', async () => {
		const refs = await listReferences();
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.CFR,
				reference_id: 'ref_unknown',
				locator: { title: 14, part: 91, section: '155' },
			},
			refs,
		);
		expect(url).toBe('https://www.ecfr.gov/current/title-14/chapter-I/part-91/section-91.155');
	});

	it('resolves an AC citation to the FAA AC index', async () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.AC,
				reference_id: 'ref_ac_61_83k',
				locator: { paragraph: '5.2' },
			},
			[],
		);
		expect(url).toBe('https://www.faa.gov/regulations_policies/advisory_circulars/');
	});

	it('resolves an ACS citation to the test-standards index', async () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.ACS,
				reference_id: 'ref_ppl_acs_25',
				locator: { area: 'V', task: 'A', element: 'K1' },
			},
			[],
		);
		expect(url).toBe('https://www.faa.gov/training_testing/testing/acs');
	});

	it('resolves a PTS citation to the test-standards index', async () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.PTS,
				reference_id: 'ref_cfi_pts',
				locator: { area: 'I', task: 'A' },
			},
			[],
		);
		expect(url).toBe('https://www.faa.gov/training_testing/testing/acs');
	});

	it('resolves an AIM citation to the AIM index', async () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.AIM,
				reference_id: 'ref_aim',
				locator: { paragraph: '5-1-7' },
			},
			[],
		);
		expect(url).toBe('https://www.faa.gov/air_traffic/publications/atpubs/aim_html/');
	});

	it('resolves a PCG citation to the PCG index', async () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.PCG,
				reference_id: 'ref_pcg',
				locator: { term: 'Aerodynamic Stall' },
			},
			[],
		);
		expect(url).toBe('https://www.faa.gov/air_traffic/publications/atpubs/pcg_html/');
	});

	it('returns null for NTSB / POH / other kinds', async () => {
		expect(
			resolveCitationUrl({ kind: REFERENCE_KINDS.NTSB, reference_id: 'r', locator: { detail: '...' } }, []),
		).toBeNull();
		expect(
			resolveCitationUrl({ kind: REFERENCE_KINDS.POH, reference_id: 'r', locator: { detail: '...' } }, []),
		).toBeNull();
		expect(
			resolveCitationUrl({ kind: REFERENCE_KINDS.OTHER, reference_id: 'r', locator: { detail: '...' } }, []),
		).toBeNull();
	});

	it('routes through @ab/sources getLiveUrl when airboss_ref is set on a non-handbook citation', async () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.ACS,
				reference_id: 'ref_ppl_acs_25',
				locator: { area: 'V', task: 'A', element: 'K1' },
				airboss_ref: 'airboss-ref:acs/ppl-airplane-acs-6c/area-05/task-a/elem-k01',
			},
			[],
		);
		// Per-publication ACS PDF URL surfaces from the acs corpus resolver
		// after the cert-syllabus WP's locked Q7 format change.
		expect(url).toBe('https://www.faa.gov/training_testing/testing/acs/private_airplane_acs_6.pdf');
	});

	it('falls back to the kind template when airboss_ref is malformed', async () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.ACS,
				reference_id: 'ref_ppl_acs_25',
				locator: { area: 'V', task: 'A', element: 'K1' },
				airboss_ref: 'not-an-airboss-ref',
			},
			[],
		);
		expect(url).toBe('https://www.faa.gov/training_testing/testing/acs');
	});

	it('handbook citations ignore airboss_ref and route to the flightbag reader', () => {
		const url = resolveCitationUrl(
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: PHAK_25C_ID,
				locator: { chapter: 12, section: 3 },
				airboss_ref: 'airboss-ref:handbooks/phak/8083-25C/12/3',
			},
			[phakHandbookRef()],
		);
		expect(url).toBe(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '12', '3'));
	});

	it('returns null when reference id does not resolve for a handbook citation', async () => {
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
	it('resets status + comprehended', async () => {
		await setReadStatus(TEST_USER_ID, SECTION_12_3_ID, HANDBOOK_READ_STATUSES.READ);
		await setComprehended(TEST_USER_ID, SECTION_12_3_ID, true);

		const row = await markAsReread(TEST_USER_ID, SECTION_12_3_ID);
		expect(row.status).toBe(HANDBOOK_READ_STATUSES.UNREAD);
		expect(row.comprehended).toBe(false);
	});
});

// `setNotes` retired by wp-notes-primitive: per-section notes now live on
// `study.note` (see `notes.test.ts`). The legacy single-blob writer was
// removed alongside the `reference_section_read_state.notes_md` column.

// ---------------------------------------------------------------------------
// getOpenWarningsForReference (WP-HANDBOOK-RE-EXTRACTION-V2 Phase 3)
// ---------------------------------------------------------------------------

describe('getOpenWarningsForReference', () => {
	const ISO = '2026-05-04T00:00:00.000+00:00';
	// 64-hex sha digests we use across cases. Real values aren't checked
	// against any actual file -- the reader only compares the digest in
	// `warnings.json` against the digest in `warnings-triage.json`.
	const MANIFEST_SHA_A = 'a'.repeat(64);
	const MANIFEST_SHA_B = 'b'.repeat(64);
	// Per-warning ids -- 16 hex chars each.
	const WARN_ID_OPEN = 'aa'.repeat(8);
	const WARN_ID_FIXED = 'bb'.repeat(8);
	const WARN_ID_WONTFIX = 'cc'.repeat(8);

	let workRoot: string;

	beforeEach(() => {
		workRoot = mkdtempSync(join(tmpdir(), 'open-warnings-'));
	});

	afterEach(() => {
		rmSync(workRoot, { recursive: true, force: true });
	});

	function writeWarningsForHandbook(args: {
		documentSlug: string;
		edition: string;
		manifestSha?: string;
		warnings: ReadonlyArray<{ id: string; code: string; section_code: string | null; message: string }>;
	}): void {
		const dir = join(workRoot, 'handbooks', args.documentSlug, args.edition);
		mkdirSync(dir, { recursive: true });
		const file = {
			schema_version: 1,
			document_slug: args.documentSlug,
			edition: args.edition,
			manifest_sha256: args.manifestSha ?? MANIFEST_SHA_A,
			generated_at: ISO,
			warnings: args.warnings,
		};
		writeFileSync(join(dir, 'warnings.json'), JSON.stringify(file), 'utf-8');
	}

	function writeTriageForHandbook(args: {
		documentSlug: string;
		edition: string;
		referenceId: string;
		manifestSha?: string;
		triage: Record<string, { status: 'open' | 'wontfix' | 'fixed' | 'duplicate'; note?: string }>;
	}): void {
		const dir = join(workRoot, 'validation', 'handbooks', args.documentSlug, args.edition);
		mkdirSync(dir, { recursive: true });
		const triageEntries: Record<string, { status: string; note?: string; decided_at: string }> = {};
		for (const [id, entry] of Object.entries(args.triage)) {
			triageEntries[id] = { status: entry.status, decided_at: ISO };
			if (entry.note !== undefined) triageEntries[id].note = entry.note;
		}
		const file = {
			schema_version: 1,
			reference_id: args.referenceId,
			manifest_sha256: args.manifestSha ?? MANIFEST_SHA_A,
			triaged_at: ISO,
			triage: triageEntries,
		};
		writeFileSync(join(dir, 'warnings-triage.json'), JSON.stringify(file), 'utf-8');
	}

	it('returns every warning as open when warnings.json exists and no triage file is present', async () => {
		writeWarningsForHandbook({
			documentSlug: PHAK_SLUG,
			edition: 'FAA-H-8083-25C',
			warnings: [
				{ id: WARN_ID_OPEN, code: 'caption-without-figure', section_code: '12', message: 'cap msg' },
				{ id: WARN_ID_FIXED, code: 'empty-section-kept', section_code: '5', message: 'empty msg' },
			],
		});

		const out = await getOpenWarningsForReference(PHAK_25C_ID, { repoRoot: workRoot });
		expect(out).toHaveLength(2);
		expect(new Set(out.map((w) => w.id))).toEqual(new Set([WARN_ID_OPEN, WARN_ID_FIXED]));
		expect(out.every((w) => w.triage_note === undefined)).toBe(true);
	});

	it('filters fixed and wontfix entries when a matching triage file exists', async () => {
		writeWarningsForHandbook({
			documentSlug: PHAK_SLUG,
			edition: 'FAA-H-8083-25C',
			warnings: [
				{ id: WARN_ID_OPEN, code: 'caption-without-figure', section_code: '12', message: 'cap msg' },
				{ id: WARN_ID_FIXED, code: 'empty-section-kept', section_code: '5', message: 'empty msg' },
				{ id: WARN_ID_WONTFIX, code: 'tablish-block-not-converted', section_code: '7', message: 'tab msg' },
			],
		});
		writeTriageForHandbook({
			documentSlug: PHAK_SLUG,
			edition: 'FAA-H-8083-25C',
			referenceId: PHAK_25C_ID,
			triage: {
				[WARN_ID_FIXED]: { status: 'fixed' },
				[WARN_ID_WONTFIX]: { status: 'wontfix', note: 'expected; FAA caption art' },
				[WARN_ID_OPEN]: { status: 'open', note: 'investigating' },
			},
		});

		const out = await getOpenWarningsForReference(PHAK_25C_ID, { repoRoot: workRoot });
		expect(out).toHaveLength(1);
		expect(out[0]?.id).toBe(WARN_ID_OPEN);
		expect(out[0]?.triage_note).toBe('investigating');
	});

	it('throws StaleWarningsTriageError when manifest_sha256 in triage does not match warnings.json', async () => {
		writeWarningsForHandbook({
			documentSlug: PHAK_SLUG,
			edition: 'FAA-H-8083-25C',
			manifestSha: MANIFEST_SHA_A,
			warnings: [{ id: WARN_ID_OPEN, code: 'caption-without-figure', section_code: '12', message: 'cap msg' }],
		});
		writeTriageForHandbook({
			documentSlug: PHAK_SLUG,
			edition: 'FAA-H-8083-25C',
			referenceId: PHAK_25C_ID,
			manifestSha: MANIFEST_SHA_B,
			triage: { [WARN_ID_OPEN]: { status: 'fixed' } },
		});

		await expect(getOpenWarningsForReference(PHAK_25C_ID, { repoRoot: workRoot })).rejects.toBeInstanceOf(
			StaleWarningsTriageError,
		);
	});

	it('returns [] when warnings.json does not exist on disk', async () => {
		// No file written -- the corpus has not been re-extracted under v2 yet.
		const out = await getOpenWarningsForReference(AFH_3C_ID, { repoRoot: workRoot });
		expect(out).toEqual([]);
	});

	it('reads AC corpus warnings via the seed-mapping inverse lookup', async () => {
		// Stage a synthetic AC reference row + its on-disk mapping.
		const AC_DOC_SLUG_FS = `99-test-${SUITE_TOKEN}`;
		const AC_REVISION = 'a';
		const AC_DOCUMENT_SLUG = `ac-99-test-${SUITE_TOKEN}`;
		const AC_EDITION = `AC 99-TEST-${SUITE_TOKEN.toUpperCase()}A`;
		const AC_REF_ID = generateReferenceId();

		__ac_seed_mapping_internal__.register({
			docSlug: AC_DOC_SLUG_FS,
			revision: AC_REVISION,
			documentSlug: AC_DOCUMENT_SLUG,
			edition: AC_EDITION,
		});

		const now = new Date();
		await db.insert(reference).values({
			id: AC_REF_ID,
			kind: REFERENCE_KINDS.AC,
			documentSlug: AC_DOCUMENT_SLUG,
			edition: AC_EDITION,
			title: `AC 99-TEST ${SUITE_TOKEN}A`,
			publisher: 'FAA',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});

		try {
			const dir = join(workRoot, 'ac', AC_DOC_SLUG_FS, AC_REVISION);
			mkdirSync(dir, { recursive: true });
			const file = {
				schema_version: 1,
				document_slug: AC_DOCUMENT_SLUG,
				edition: AC_EDITION,
				manifest_sha256: MANIFEST_SHA_A,
				generated_at: ISO,
				warnings: [{ id: WARN_ID_OPEN, code: 'caption-without-figure', section_code: '1', message: 'ac cap msg' }],
			};
			writeFileSync(join(dir, 'warnings.json'), JSON.stringify(file), 'utf-8');

			const out = await getOpenWarningsForReference(AC_REF_ID, { repoRoot: workRoot });
			expect(out).toHaveLength(1);
			expect(out[0]?.code).toBe('caption-without-figure');
		} finally {
			await db.delete(reference).where(eq(reference.id, AC_REF_ID));
			__ac_seed_mapping_internal__.reset();
		}
	});
});
