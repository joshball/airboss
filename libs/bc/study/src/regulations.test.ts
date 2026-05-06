/**
 * Regulations BC aggregator tests. Real Postgres; per-suite slugs and ids
 * keep parallel runs from colliding on the (document_slug, edition) unique
 * index.
 *
 * Coverage:
 *
 *   - landing view counts every regulations bucket and the test fixture's
 *     contribution shows up in each bucket it belongs to.
 *   - group view: 14 CFR groups by Part with `Part NN` labels; AC groups by
 *     series with `Series NN` labels and orphans go to the umbrella card list;
 *     AIM/NTSB return umbrella cards.
 *   - section view: returns the section TOC when one reference resolves and
 *     has chapter rows; throws RegulationsViewNotFoundError when no reference
 *     matches the slug.
 *   - detail view: hydrates section + chapter + figures + siblings + read
 *     state + citing nodes + errata + supersededByEdition; throws when no
 *     reference matches; throws when the section doesn't exist.
 *   - resolveRegulationsSectionId returns the section id without hydrating
 *     the rest of the payload.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	HANDBOOK_READ_STATUSES,
	LIBRARY_REGULATIONS_KINDS,
	REFERENCE_KINDS,
	REFERENCE_SECTION_LEVELS,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { airbossRefForCfrSection } from '@ab/sources';
import type { StructuredCitation } from '@ab/types';
import { generateAuthId, generateReferenceFigureId, generateReferenceId, generateReferenceSectionId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getRegulationsView, RegulationsViewNotFoundError, resolveRegulationsSectionId } from './regulations';
import {
	knowledgeNode,
	type NewKnowledgeNodeRow,
	reference,
	referenceFigure,
	referenceSection,
	referenceSectionReadState,
} from './schema';

// -- Per-suite fixture ------------------------------------------------------

const SUITE_TAG = `regs-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `${SUITE_TAG}@airboss.test`;

// Use deliberately out-of-band Part numbers so the test fixture doesn't
// collide with the seeded 14-/49-CFR rows. The aggregator's grouping logic
// keys on the part number extracted from the slug, so any non-collision part
// works for the assertions.
const CFR14_PART = '99001';
const CFR49_PART = '99002';
// Flat-shape Part: sections seeded directly under the reference at
// `level=section` with `parent_id=null` (the WP-CFR seeder shape per
// REFERENCE_SECTION_LEVELS.PART doc). Tests the buildSectionListView /
// buildDetailView fallback path that the hierarchical CFR14_PART fixture
// does not exercise.
const CFR14_FLAT_PART = '99003';
const AC_SERIES = '120';
// AC orphan: a series outside the canonical bucket list (00/60/61/90/91/120/150).
const AC_ORPHAN_SERIES = '777';

const CFR14_SLUG = `14cfr${CFR14_PART}`;
const CFR14_FLAT_SLUG = `14cfr${CFR14_FLAT_PART}`;
const CFR49_SLUG = `49cfr${CFR49_PART}`;
const AC_SLUG = `ac-${AC_SERIES}-${SUITE_TAG.slice(-4)}`.toLowerCase();
const AC_ORPHAN_SLUG = `ac-${AC_ORPHAN_SERIES}-${SUITE_TAG.slice(-4)}`.toLowerCase();
// AIM and NTSB umbrellas: slug-shape under the schema's
// `^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$` constraint. Take the last 6 hex chars
// of the suite tag to keep the slug short.
const SUITE_SUFFIX = SUITE_TAG.slice(-6).toLowerCase();
const AIM_SLUG = `aim-${SUITE_SUFFIX}`;
const NTSB_SLUG = `ntsb-${SUITE_SUFFIX}`;

const CFR14_REF_ID = generateReferenceId();
const CFR14_FLAT_REF_ID = generateReferenceId();
const CFR49_REF_ID = generateReferenceId();
const AC_REF_ID = generateReferenceId();
const AC_ORPHAN_REF_ID = generateReferenceId();
const AIM_REF_ID = generateReferenceId();
const NTSB_REF_ID = generateReferenceId();
const CFR14_SUPERSEDED_REF_ID = generateReferenceId();

const CFR14_CHAPTER_ID = generateReferenceSectionId();
const CFR14_SECTION_103_ID = generateReferenceSectionId();
const CFR14_SECTION_107_ID = generateReferenceSectionId();
const CFR14_FIGURE_ID = generateReferenceFigureId();

// Flat-shape Part fixture ids -- two sections directly under the reference,
// no chapter, no parent. Mirrors the WP-CFR seeder output for 14 CFR Parts.
const CFR14_FLAT_SECTION_103_ID = generateReferenceSectionId();
const CFR14_FLAT_SECTION_107_ID = generateReferenceSectionId();

const CITING_NODE_ID = `kn-${SUITE_TAG}-cites-cfr14`;

beforeAll(async () => {
	const now = new Date();

	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Regulations BC Test',
		firstName: 'Regulations',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	// Two editions of the test 14-CFR row -- the older one is superseded by
	// the newer. The aggregator should never see the superseded row in the
	// listReferences default; the supersededByEdition assertion checks the
	// detail view surfaces the latest edition tag.
	await db.insert(reference).values([
		{
			id: CFR14_SUPERSEDED_REF_ID,
			kind: REFERENCE_KINDS.CFR,
			documentSlug: CFR14_SLUG,
			edition: '2023',
			title: `14 CFR Part ${CFR14_PART} (2023)`,
			publisher: 'FAA',
			url: null,
			supersededById: CFR14_REF_ID,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CFR14_REF_ID,
			kind: REFERENCE_KINDS.CFR,
			documentSlug: CFR14_SLUG,
			edition: 'current',
			title: `14 CFR Part ${CFR14_PART} (current)`,
			publisher: 'FAA',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			// Flat-shape CFR Part. Same kind/slug-shape as CFR14_REF_ID but
			// its sections live flat under the reference (no chapter row).
			// Mirrors the production WP-CFR seeder output. The
			// buildSectionListView / buildDetailView flat-fallback path is
			// the only thing that lights this up.
			id: CFR14_FLAT_REF_ID,
			kind: REFERENCE_KINDS.CFR,
			documentSlug: CFR14_FLAT_SLUG,
			edition: 'current',
			title: `14 CFR Part ${CFR14_FLAT_PART} (flat fixture)`,
			publisher: 'FAA',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CFR49_REF_ID,
			kind: REFERENCE_KINDS.CFR,
			documentSlug: CFR49_SLUG,
			edition: 'current',
			title: `49 CFR Part ${CFR49_PART} (current)`,
			publisher: 'NTSB',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: AC_REF_ID,
			kind: REFERENCE_KINDS.AC,
			documentSlug: AC_SLUG,
			edition: 'A',
			title: `AC ${AC_SERIES} test`,
			publisher: 'FAA',
			url: 'https://www.faa.gov/test-ac',
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: AC_ORPHAN_REF_ID,
			kind: REFERENCE_KINDS.AC,
			documentSlug: AC_ORPHAN_SLUG,
			edition: 'A',
			title: `AC ${AC_ORPHAN_SERIES} orphan`,
			publisher: 'FAA',
			url: 'https://www.faa.gov/test-ac-orphan',
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: AIM_REF_ID,
			kind: REFERENCE_KINDS.AIM,
			documentSlug: AIM_SLUG,
			edition: '2024',
			title: `AIM (${SUITE_SUFFIX})`,
			publisher: 'FAA',
			url: 'https://www.faa.gov/test-aim',
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: NTSB_REF_ID,
			kind: REFERENCE_KINDS.NTSB,
			documentSlug: NTSB_SLUG,
			edition: '2024',
			title: `NTSB (${SUITE_SUFFIX})`,
			publisher: 'NTSB',
			url: 'https://www.ntsb.gov/test',
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	// Inline section ingest for the 14-CFR test reference -- one chapter,
	// two sections + one figure on §103. Mirrors the handbook fixture shape.
	await db.insert(referenceSection).values([
		{
			id: CFR14_CHAPTER_ID,
			referenceId: CFR14_REF_ID,
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
			ordinal: 1,
			depth: 0,
			code: '91',
			airbossRef: 'airboss-ref:regs/cfr-14/91',
			title: `Subpart 91 (test ${SUITE_SUFFIX})`,
			sourceLocator: '14 CFR §91',
			contentMd: '',
			contentHash: 'hash-cfr14-chapter',
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CFR14_SECTION_103_ID,
			referenceId: CFR14_REF_ID,
			parentId: CFR14_CHAPTER_ID,
			level: REFERENCE_SECTION_LEVELS.SECTION,
			ordinal: 103,
			depth: 1,
			code: '91.103',
			airbossRef: airbossRefForCfrSection(14, '91.103'),
			title: 'Preflight action',
			metadata: { faaPages: { start: '91-103', end: '91-103' } },
			sourceLocator: '14 CFR §91.103',
			contentMd: 'Each pilot in command shall, before beginning a flight...',
			contentHash: 'hash-cfr14-103',
			hasFigures: true,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CFR14_SECTION_107_ID,
			referenceId: CFR14_REF_ID,
			parentId: CFR14_CHAPTER_ID,
			level: REFERENCE_SECTION_LEVELS.SECTION,
			ordinal: 107,
			depth: 1,
			code: '91.107',
			airbossRef: airbossRefForCfrSection(14, '91.107'),
			title: 'Use of safety belts',
			metadata: { faaPages: { start: '91-107', end: '91-107' } },
			sourceLocator: '14 CFR §91.107',
			contentMd: 'No pilot may take off a U.S.-registered civil aircraft...',
			contentHash: 'hash-cfr14-107',
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		// Flat-shape Part: two sections directly under the reference, no
		// chapter, no parent, depth 0. Codes are bare `<part>.<section>`
		// (no `§` prefix) per the URL-slug-shape contract enforced by
		// SECTION_SHAPE in libs/aviation/src/slugs.ts. The codes here are
		// what the URL will contain -- if the production seeder writes
		// `§99003.103` the detail-page link will 404.
		{
			id: CFR14_FLAT_SECTION_103_ID,
			referenceId: CFR14_FLAT_REF_ID,
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.SECTION,
			ordinal: 103,
			depth: 0,
			code: `${CFR14_FLAT_PART}.103`,
			airbossRef: airbossRefForCfrSection(14, `${CFR14_FLAT_PART}.103`),
			title: 'Flat fixture preflight action',
			sourceLocator: `14 CFR §${CFR14_FLAT_PART}.103`,
			contentMd: 'Flat-shape body. Each pilot in command shall...',
			contentHash: `hash-cfr14-flat-${CFR14_FLAT_PART}-103`,
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CFR14_FLAT_SECTION_107_ID,
			referenceId: CFR14_FLAT_REF_ID,
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.SECTION,
			ordinal: 107,
			depth: 0,
			code: `${CFR14_FLAT_PART}.107`,
			airbossRef: airbossRefForCfrSection(14, `${CFR14_FLAT_PART}.107`),
			title: 'Flat fixture safety belts',
			sourceLocator: `14 CFR §${CFR14_FLAT_PART}.107`,
			contentMd: 'Flat-shape body. No pilot may take off...',
			contentHash: `hash-cfr14-flat-${CFR14_FLAT_PART}-107`,
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(referenceFigure).values([
		{
			id: CFR14_FIGURE_ID,
			sectionId: CFR14_SECTION_103_ID,
			ordinal: 0,
			caption: 'Figure 91-103. Preflight checklist.',
			assetPath: `cfr/${CFR14_SLUG}/figures/fig-103.png`,
			width: 800,
			height: 600,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
	]);

	// One knowledge node citing 14-CFR §103 -- exercises the citing-nodes
	// panel in the detail view. The aggregator passes Number(chapter) /
	// Number(section) so the locator must match the numeric chapter/section
	// the URL would carry.
	const citingNode: NewKnowledgeNodeRow = {
		id: CITING_NODE_ID,
		title: `Cites 14 CFR ${CFR14_PART}.103`,
		domain: 'regulations',
		crossDomains: [],
		knowledgeTypes: [],
		technicalDepth: null,
		stability: null,
		minimumCert: null,
		studyPriority: null,
		modalities: [],
		estimatedTimeMinutes: null,
		reviewTimeMinutes: null,
		references: [
			{
				kind: REFERENCE_KINDS.HANDBOOK,
				reference_id: CFR14_REF_ID,
				locator: { chapter: 91, section: 103 },
			} satisfies StructuredCitation,
		] as unknown as { source: string; detail: string; note: string }[],
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
	};
	await db.insert(knowledgeNode).values([citingNode]);
});

afterAll(async () => {
	await db.delete(referenceSectionReadState).where(eq(referenceSectionReadState.userId, TEST_USER_ID));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(referenceFigure).where(eq(referenceFigure.seedOrigin, SUITE_TAG));
	await db.delete(referenceSection).where(eq(referenceSection.seedOrigin, SUITE_TAG));
	await db.delete(reference).where(eq(reference.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

// -- Tests ------------------------------------------------------------------

describe('getRegulationsView (landing)', () => {
	it('returns one bucket per regulations kind', async () => {
		const view = await getRegulationsView({ view: 'landing' });
		expect(view.view).toBe('landing');
		expect(view.buckets).toHaveLength(5);
		const kinds = view.buckets.map((b) => b.kind);
		expect(kinds).toContain(LIBRARY_REGULATIONS_KINDS.CFR_14);
		expect(kinds).toContain(LIBRARY_REGULATIONS_KINDS.CFR_49);
		expect(kinds).toContain(LIBRARY_REGULATIONS_KINDS.AIM);
		expect(kinds).toContain(LIBRARY_REGULATIONS_KINDS.AC);
		expect(kinds).toContain(LIBRARY_REGULATIONS_KINDS.NTSB);
	});

	it('every bucket label is human-readable', async () => {
		const view = await getRegulationsView({ view: 'landing' });
		for (const bucket of view.buckets) {
			expect(bucket.label).toMatch(/\S/);
			expect(bucket.count).toBeGreaterThanOrEqual(0);
		}
	});

	it('counts the test fixture in each kind it contributes to', async () => {
		const view = await getRegulationsView({ view: 'landing' });
		const cfr14 = view.buckets.find((b) => b.kind === LIBRARY_REGULATIONS_KINDS.CFR_14);
		const cfr49 = view.buckets.find((b) => b.kind === LIBRARY_REGULATIONS_KINDS.CFR_49);
		const aim = view.buckets.find((b) => b.kind === LIBRARY_REGULATIONS_KINDS.AIM);
		const ac = view.buckets.find((b) => b.kind === LIBRARY_REGULATIONS_KINDS.AC);
		const ntsb = view.buckets.find((b) => b.kind === LIBRARY_REGULATIONS_KINDS.NTSB);
		expect(cfr14?.count ?? 0).toBeGreaterThanOrEqual(1);
		expect(cfr49?.count ?? 0).toBeGreaterThanOrEqual(1);
		expect(aim?.count ?? 0).toBeGreaterThanOrEqual(1);
		expect(ac?.count ?? 0).toBeGreaterThanOrEqual(2);
		expect(ntsb?.count ?? 0).toBeGreaterThanOrEqual(1);
	});
});

describe('getRegulationsView (group)', () => {
	it('14 CFR groups by Part and labels each `Part <N>`', async () => {
		const view = await getRegulationsView({
			view: 'group',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
		});
		expect(view.view).toBe('group');
		expect(view.kind).toBe(LIBRARY_REGULATIONS_KINDS.CFR_14);
		expect(view.kindLabel).toBe('14 CFR');
		const testPart = view.groups.find((g) => g.groupKey === CFR14_PART);
		expect(testPart).toBeDefined();
		expect(testPart?.label).toBe(`14 CFR Part ${CFR14_PART}`);
		expect(testPart?.referenceCount).toBe(1);
		expect(view.umbrellas).toEqual([]);
	});

	it('49 CFR groups by Part separately from 14 CFR', async () => {
		const view = await getRegulationsView({
			view: 'group',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_49,
		});
		const testPart = view.groups.find((g) => g.groupKey === CFR49_PART);
		expect(testPart).toBeDefined();
		expect(testPart?.label).toBe(`49 CFR Part ${CFR49_PART}`);
		// 14 CFR test parts must not bleed into the 49 CFR group.
		expect(view.groups.find((g) => g.groupKey === CFR14_PART)).toBeUndefined();
	});

	it('AC groups by series and orphans go to the umbrella card list', async () => {
		const view = await getRegulationsView({
			view: 'group',
			kind: LIBRARY_REGULATIONS_KINDS.AC,
		});
		const series = view.groups.find((g) => g.groupKey === AC_SERIES);
		expect(series).toBeDefined();
		expect(series?.label).toBe(`Series ${AC_SERIES}`);
		// Orphan series must NOT appear in the groups list.
		expect(view.groups.find((g) => g.groupKey === AC_ORPHAN_SERIES)).toBeUndefined();
		// Orphan must appear in the umbrella card list.
		const orphanCard = view.umbrellas.find((u) => u.id === AC_ORPHAN_REF_ID);
		expect(orphanCard).toBeDefined();
		expect(orphanCard?.kindLabel).toBe('Advisory Circular');
	});

	it('AIM returns umbrella cards (no inline groups)', async () => {
		const view = await getRegulationsView({
			view: 'group',
			kind: LIBRARY_REGULATIONS_KINDS.AIM,
		});
		expect(view.groups).toEqual([]);
		const card = view.umbrellas.find((u) => u.id === AIM_REF_ID);
		expect(card).toBeDefined();
		expect(card?.documentSlug).toBe(AIM_SLUG);
		expect(card?.kindLabel).toBe('AIM');
	});

	it('NTSB returns umbrella cards (no inline groups)', async () => {
		const view = await getRegulationsView({
			view: 'group',
			kind: LIBRARY_REGULATIONS_KINDS.NTSB,
		});
		expect(view.groups).toEqual([]);
		const card = view.umbrellas.find((u) => u.id === NTSB_REF_ID);
		expect(card).toBeDefined();
	});

	it('14 CFR group view exposes a canonical eCFR title URL via `external`', async () => {
		const view = await getRegulationsView({
			view: 'group',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
		});
		expect(view.external).toEqual({ url: 'https://www.ecfr.gov/current/title-14', label: 'eCFR' });
	});

	it('CFR Part group cards each carry a canonical eCFR `external` URL', async () => {
		const view = await getRegulationsView({
			view: 'group',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
		});
		const testPart = view.groups.find((g) => g.groupKey === CFR14_PART);
		expect(testPart?.external?.label).toBe('eCFR');
		expect(testPart?.external?.url).toContain(`title-14`);
		expect(testPart?.external?.url).toContain(`part-${CFR14_PART}`);
	});

	it('AC and AIM kinds do not have an eCFR `external` URL', async () => {
		const acView = await getRegulationsView({ view: 'group', kind: LIBRARY_REGULATIONS_KINDS.AC });
		expect(acView.external).toBeNull();
		const aimView = await getRegulationsView({ view: 'group', kind: LIBRARY_REGULATIONS_KINDS.AIM });
		expect(aimView.external).toBeNull();
	});
});

describe('getRegulationsView (section)', () => {
	it('returns the section TOC when one reference resolves with chapter rows', async () => {
		const view = await getRegulationsView({
			view: 'section',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
			group: CFR14_PART,
		});
		expect(view.view).toBe('section');
		expect(view.group).toBe(CFR14_PART);
		expect(view.groupLabel).toBe(`14 CFR Part ${CFR14_PART}`);
		expect(view.umbrellas).toHaveLength(1);
		expect(view.umbrellas[0]?.id).toBe(CFR14_REF_ID);
		// One chapter row in the fixture (`91`).
		expect(view.sections).toHaveLength(1);
		expect(view.sections[0]?.code).toBe('91');
	});

	it('throws RegulationsViewNotFoundError when no reference matches', async () => {
		await expect(
			getRegulationsView({
				view: 'section',
				kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
				group: '999999', // shape-valid but no matching reference
			}),
		).rejects.toBeInstanceOf(RegulationsViewNotFoundError);
	});

	it('preserves NTSB umbrella shape', async () => {
		const view = await getRegulationsView({
			view: 'section',
			kind: LIBRARY_REGULATIONS_KINDS.NTSB,
			group: NTSB_SLUG,
		});
		expect(view.umbrellas).toHaveLength(1);
		expect(view.umbrellas[0]?.id).toBe(NTSB_REF_ID);
		// NTSB has no chapter rows in the fixture; the section TOC should be
		// empty rather than missing.
		expect(view.sections).toEqual([]);
	});

	it('CFR section view exposes a canonical eCFR Part URL via `external` (chapter context falls back to null when the part is not in the nav-tree)', async () => {
		const view = await getRegulationsView({
			view: 'section',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
			group: CFR14_PART,
		});
		// Out-of-band test part has no chapter mapping, so the URL falls back
		// to the eCFR shortcut form (still resolvable by eCFR server-side).
		expect(view.external?.label).toBe('eCFR');
		expect(view.external?.url).toContain(`title-14`);
		expect(view.external?.url).toContain(`part-${CFR14_PART}`);
		// chapterId is null because the synthetic part isn't in the nav-tree YAML.
		expect(view.chapterId).toBeNull();
	});
});

describe('getRegulationsView (detail)', () => {
	it('hydrates the full section payload', async () => {
		const view = await getRegulationsView({
			view: 'detail',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
			group: CFR14_PART,
			section: { chapterCode: '91', sectionCode: '103' },
			userId: TEST_USER_ID,
		});

		expect(view.view).toBe('detail');
		expect(view.reference.id).toBe(CFR14_REF_ID);
		expect(view.reference.edition).toBe('current');
		// The CFR14 row is the latest -- not superseded itself -- so the
		// supersededByEdition flag is null on the latest reference.
		expect(view.reference.supersededByEdition).toBeNull();
		expect(view.section.id).toBe(CFR14_SECTION_103_ID);
		expect(view.section.code).toBe('91.103');
		expect(view.chapter.code).toBe('91');
		expect(view.figures).toHaveLength(1);
		expect(view.figures[0]?.id).toBe(CFR14_FIGURE_ID);
		// Two sibling sections under chapter 91 (§103 + §107), in ordinal order.
		expect(view.siblings.map((s) => s.code)).toEqual(['91.103', '91.107']);
		// Default read-state when the user hasn't opened the section yet.
		expect(view.readState.status).toBe(HANDBOOK_READ_STATUSES.UNREAD);
		expect(view.readState.comprehended).toBe(false);
		expect(view.readState.notesMd).toBe('');
		// Exactly one citing knowledge node from the fixture.
		const citing = view.citingNodes.find((n) => n.id === CITING_NODE_ID);
		expect(citing).toBeDefined();
		expect(view.errata).toEqual([]);
		// CFR section detail carries the canonical eCFR section URL.
		expect(view.external?.label).toBe('eCFR');
		expect(view.external?.url).toContain('section-91.103');
		// Sibling rows each carry their own canonical URL.
		expect(view.siblings.every((s) => s.external?.label === 'eCFR')).toBe(true);
	});

	it('throws RegulationsViewNotFoundError when no reference matches the (kind, group)', async () => {
		await expect(
			getRegulationsView({
				view: 'detail',
				kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
				group: '999999',
				section: { chapterCode: '91', sectionCode: '103' },
				userId: TEST_USER_ID,
			}),
		).rejects.toBeInstanceOf(RegulationsViewNotFoundError);
	});

	it('throws RegulationsViewNotFoundError when the section code does not exist', async () => {
		await expect(
			getRegulationsView({
				view: 'detail',
				kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
				group: CFR14_PART,
				section: { chapterCode: '91', sectionCode: '999' },
				userId: TEST_USER_ID,
			}),
		).rejects.toBeInstanceOf(RegulationsViewNotFoundError);
	});
});

describe('resolveRegulationsSectionId', () => {
	it('returns the section id without hydrating the rest of the payload', async () => {
		const id = await resolveRegulationsSectionId({
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
			group: CFR14_PART,
			section: { chapterCode: '91', sectionCode: '103' },
		});
		expect(id).toBe(CFR14_SECTION_103_ID);
	});

	it('throws RegulationsViewNotFoundError on missing reference', async () => {
		await expect(
			resolveRegulationsSectionId({
				kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
				group: '999999',
				section: { chapterCode: '91', sectionCode: '103' },
			}),
		).rejects.toBeInstanceOf(RegulationsViewNotFoundError);
	});

	it('throws RegulationsViewNotFoundError on missing section', async () => {
		await expect(
			resolveRegulationsSectionId({
				kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
				group: CFR14_PART,
				section: { chapterCode: '91', sectionCode: '999' },
			}),
		).rejects.toBeInstanceOf(RegulationsViewNotFoundError);
	});
});

// ---------------------------------------------------------------------------
// Flat-shape CFR Part: covers the buildSectionListView / buildDetailView
// fallback path when the matching reference has no chapter row -- sections
// sit directly under the reference at depth 0 with `parent_id = null`. This
// is the production WP-CFR seeder shape; the hierarchical fixture above
// does NOT exercise it. Without these tests, any regression that breaks
// the flat fallback (e.g. `listFlatTopLevelSections` removed, or the
// `getHandbookSection` failure no longer cascades to `getFlatSection`)
// silently falls through to the umbrella card and ships an external link.
// ---------------------------------------------------------------------------

describe('getRegulationsView (section) -- flat-shape CFR Part', () => {
	it('returns the flat section TOC when the reference has no chapter row', async () => {
		const view = await getRegulationsView({
			view: 'section',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
			group: CFR14_FLAT_PART,
		});
		expect(view.view).toBe('section');
		expect(view.group).toBe(CFR14_FLAT_PART);
		expect(view.umbrellas).toHaveLength(1);
		expect(view.umbrellas[0]?.id).toBe(CFR14_FLAT_REF_ID);
		// Two flat sections under the reference; chapter probe returns zero
		// so the flat fallback wins. Codes are bare `<part>.<section>`.
		expect(view.sections.map((s) => s.code).sort()).toEqual(
			[`${CFR14_FLAT_PART}.103`, `${CFR14_FLAT_PART}.107`].sort(),
		);
	});

	it('flat section codes match the URL slug shape (no `§` prefix, parser-compatible)', async () => {
		// Regression guard: the production WP-CFR seeder once wrote codes with
		// a `§` prefix (`§91.103`). The URL slug parser in
		// libs/aviation/src/slugs.ts rejects `§` (SECTION_SHAPE matches only
		// `[a-z0-9]+(?:\.[a-z0-9]+)?`), which silently 404s every detail-page
		// link. Lock the contract here: every flat-section row's `code` MUST
		// be slug-parser-compatible.
		const view = await getRegulationsView({
			view: 'section',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
			group: CFR14_FLAT_PART,
		});
		const SECTION_SHAPE = /^[a-z0-9]+(?:\.[a-z0-9]+)?(?:-[a-z0-9]+(?:\.[a-z0-9]+)?)?$/i;
		for (const section of view.sections) {
			expect(section.code, `code "${section.code}" must match URL slug shape`).toMatch(SECTION_SHAPE);
		}
	});
});

describe('getRegulationsView (detail) -- flat-shape CFR Part', () => {
	it('hydrates the section payload via the flat fallback', async () => {
		// The URL `/library/regulations/14-cfr/<flat-part>/<flat-part>.103`
		// parses to `chapterCode: '<flat-part>', sectionCode: '103'`. The
		// hierarchical probe (`getHandbookSection`) cannot find a chapter row
		// matching `<flat-part>` at level=chapter, so the loader falls
		// through to `getFlatSection` with the joined `fullCode`.
		const view = await getRegulationsView({
			view: 'detail',
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
			group: CFR14_FLAT_PART,
			section: { chapterCode: CFR14_FLAT_PART, sectionCode: '103' },
			userId: TEST_USER_ID,
		});

		expect(view.view).toBe('detail');
		expect(view.reference.id).toBe(CFR14_FLAT_REF_ID);
		expect(view.section.id).toBe(CFR14_FLAT_SECTION_103_ID);
		expect(view.section.code).toBe(`${CFR14_FLAT_PART}.103`);
		// Synthesized "virtual chapter" -- carries the reference id + the
		// part group code + the labelForGroup label so the breadcrumb +
		// chrome render unchanged. Wave 2 (subpart hierarchy) replaces this.
		expect(view.chapter.id).toBe(CFR14_FLAT_REF_ID);
		expect(view.chapter.code).toBe(CFR14_FLAT_PART);
		expect(view.chapter.title).toBe(`14 CFR Part ${CFR14_FLAT_PART}`);
		// Siblings come from listFlatTopLevelSections -- both flat sections.
		expect(view.siblings.map((s) => s.code).sort()).toEqual(
			[`${CFR14_FLAT_PART}.103`, `${CFR14_FLAT_PART}.107`].sort(),
		);
		// No figures on the flat fixture.
		expect(view.figures).toEqual([]);
	});

	it('throws RegulationsViewNotFoundError when the flat section code does not exist', async () => {
		await expect(
			getRegulationsView({
				view: 'detail',
				kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
				group: CFR14_FLAT_PART,
				section: { chapterCode: CFR14_FLAT_PART, sectionCode: '999' },
				userId: TEST_USER_ID,
			}),
		).rejects.toBeInstanceOf(RegulationsViewNotFoundError);
	});
});

describe('resolveRegulationsSectionId -- flat-shape CFR Part', () => {
	it('returns the flat section id without hydrating the rest of the payload', async () => {
		const id = await resolveRegulationsSectionId({
			kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
			group: CFR14_FLAT_PART,
			section: { chapterCode: CFR14_FLAT_PART, sectionCode: '103' },
		});
		expect(id).toBe(CFR14_FLAT_SECTION_103_ID);
	});

	it('throws on missing flat section', async () => {
		await expect(
			resolveRegulationsSectionId({
				kind: LIBRARY_REGULATIONS_KINDS.CFR_14,
				group: CFR14_FLAT_PART,
				section: { chapterCode: CFR14_FLAT_PART, sectionCode: '999' },
			}),
		).rejects.toBeInstanceOf(RegulationsViewNotFoundError);
	});
});
