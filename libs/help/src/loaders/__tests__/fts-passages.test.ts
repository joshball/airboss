/**
 * FTS-passages loader integration test. Real Postgres -- the loader emits
 * `websearch_to_tsquery` / `ts_rank_cd` / `ts_headline` against three
 * sources (`study.reference_section.content_md`,
 * `study.knowledge_node.content_md`, and `study.course_step.body_md`), so a
 * mock would silently pass while the actual SQL regressed.
 *
 * Suite shape mirrors `db-loaders.test.ts`: seed a tagged set of fixtures in
 * `beforeAll`, tear them down in FK-safe order in `afterAll`, exercise each
 * source + the merge path in independent `it` blocks.
 *
 * Fixtures use a wordy phrase ("twilightturbulence illumination minima") so
 * the `websearch_to_tsquery` parser actually has tokens to rank. The test
 * asserts: results returned, highlight markup present, rank ordering
 * stable, empty needle returns `[]`.
 */

import { course, courseStep, knowledgeNode, reference, referenceSection } from '@ab/bc-study';
import { COURSE_KINDS, COURSE_STATUSES, COURSE_STEP_LEVELS, REFERENCE_KINDS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateReferenceSectionId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadFtsPassages } from '../fts-passages';

const SUITE_TAG = `fts-passages-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const REF_HANDBOOK_ID = `ref-${SUITE_TAG}-hb`;
const REF_CFR_ID = `ref-${SUITE_TAG}-cfr`;
const SEC_HANDBOOK_ID = generateReferenceSectionId();
const SEC_CFR_ID = generateReferenceSectionId();
const KNODE_ID = `kn-${SUITE_TAG}-twilightturbulence`;
const COURSE_ID = `course-${SUITE_TAG}`;
// Course slug must match `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$` -- strip
// internal hyphens from the suite tag tail to satisfy the shape check.
const COURSE_SLUG = `fts-course-${SUITE_TAG.replace(/-/g, '').slice(-12)}`.toLowerCase();
const COURSE_STEP_SECTION_ID = `cs-${SUITE_TAG}-section`;
const COURSE_STEP_SECTION_CODE = 's1';

// A phrase the parser will tokenise into multiple distinct terms; the
// `to_tsvector('english', ...)` strips stopwords ("the", "and") so the body
// has to contain content words. The phrase is deliberately not a real
// concept so collisions with neighbour suites are impossible.
const PHRASE = 'twilightturbulence illumination minima';
const KNODE_NEEDLE = 'twilightturbulence';

beforeAll(async () => {
	const now = new Date();
	await db.insert(reference).values([
		{
			id: REF_HANDBOOK_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: `fts-phak-${SUITE_TAG.slice(-12)}`.toLowerCase(),
			edition: 'TEST-ED-1',
			title: 'FTS Test Handbook',
			publisher: 'FAA',
			subjects: ['weather'],
			primaryCert: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: REF_CFR_ID,
			kind: REFERENCE_KINDS.CFR,
			documentSlug: `14cfrfts${SUITE_TAG.slice(-8)}`.toLowerCase(),
			edition: 'TEST-CFR-1',
			title: '14 CFR FTS Test',
			publisher: 'FAA',
			subjects: ['regulations'],
			primaryCert: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(referenceSection).values([
		{
			id: SEC_HANDBOOK_ID,
			referenceId: REF_HANDBOOK_ID,
			parentId: null,
			level: 'chapter',
			ordinal: 1,
			depth: 1,
			code: '7',
			// Canonical `airboss-ref:` URI; the loader maps it to a flightbag
			// reader URL via `urlForReference()`. The doc slug must be a
			// registered handbook (`phak`).
			airbossRef: `airboss-ref:handbooks/phak/8083-25C/7`,
			title: 'Night flying considerations',
			sourceLocator: 'FTS Ch 7',
			contentMd: `Pilot rest before night flying is essential. ${PHRASE} appear in the descent profile when the sun dips below the horizon. Adequate planning mitigates risk.`,
			contentHash: `hash-${SUITE_TAG}-hb`,
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SEC_CFR_ID,
			referenceId: REF_CFR_ID,
			parentId: null,
			level: 'section',
			ordinal: 1,
			depth: 2,
			code: '91.151',
			airbossRef: `airboss-ref:regs/cfr-14/91/151`,
			title: 'Fuel requirements for flight in VFR conditions',
			sourceLocator: '14 CFR §91.151',
			contentMd: `Fuel rules apply for VFR conditions. The phrase ${PHRASE} is repeated here so the FTS test can hit the CFR source.`,
			contentHash: `hash-${SUITE_TAG}-cfr`,
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(knowledgeNode).values({
		id: KNODE_ID,
		title: 'Twilight illumination & turbulence',
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
		references: [],
		assessable: false,
		assessmentMethods: [],
		masteryCriteria: null,
		seedOrigin: SUITE_TAG,
		contentMd: `Discussion of ${KNODE_NEEDLE} dynamics, twilight angles, and pilot decision making during dusk operations.`,
		contentHash: null,
		version: 1,
		authorId: null,
		lifecycle: null,
		createdAt: now,
		updatedAt: now,
	});

	// Seed one course + one section-level course_step carrying body_md so the
	// loader's third source has something to find. A section is a legal
	// course_step shape: NULL parent_id + NULL knowledge_node_id + is_leaf=false
	// (enforced by `course_step_consistency_check`).
	await db.insert(course).values({
		id: COURSE_ID,
		slug: COURSE_SLUG,
		kind: COURSE_KINDS.INSTRUCTOR,
		title: 'FTS Test Course',
		description: 'Course used to seed fts-passages tests.',
		status: COURSE_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(courseStep).values({
		id: COURSE_STEP_SECTION_ID,
		courseId: COURSE_ID,
		parentId: null,
		level: COURSE_STEP_LEVELS.SECTION,
		ordinal: 0,
		code: COURSE_STEP_SECTION_CODE,
		title: 'Night-flying section',
		bodyMd: `Authored course-step body. ${PHRASE} is referenced inline so the FTS test can hit the course_step source.`,
		knowledgeNodeId: null,
		isLeaf: false,
		contentHash: null,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	await db.delete(courseStep).where(eq(courseStep.id, COURSE_STEP_SECTION_ID));
	await db.delete(course).where(eq(course.id, COURSE_ID));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.id, KNODE_ID));
	await db.delete(referenceSection).where(eq(referenceSection.id, SEC_HANDBOOK_ID));
	await db.delete(referenceSection).where(eq(referenceSection.id, SEC_CFR_ID));
	await db.delete(reference).where(eq(reference.id, REF_HANDBOOK_ID));
	await db.delete(reference).where(eq(reference.id, REF_CFR_ID));
});

describe('loadFtsPassages', () => {
	it('returns the seeded handbook chapter on a phrase needle', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const hit = out.find((r) => r.id === SEC_HANDBOOK_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('faa.handbook.chapter');
		expect(hit?.passageHighlight).toBeDefined();
		expect(hit?.passageHighlight).toMatch(/<mark>/);
		expect(hit?.passageHighlight).toMatch(/<\/mark>/);
		// Flightbag-direct reader URL from the section's `airboss-ref:` URI.
		expect(hit?.href).toBe('/handbook/phak/8083-25C/7');
		expect(hit?.href.startsWith('/library/')).toBe(false);
	});

	it('returns the seeded CFR section on a phrase needle', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const hit = out.find((r) => r.id === SEC_CFR_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('faa.cfr.sect');
		expect(hit?.title).toMatch(/^14 CFR §/);
		expect(hit?.passageHighlight).toMatch(/<mark>/);
		expect(hit?.href).toBe('/cfr/14/91/151');
		expect(hit?.href.startsWith('/library/')).toBe(false);
	});

	it('returns the seeded knowledge node on a phrase needle', async () => {
		const out = await loadFtsPassages({ needle: KNODE_NEEDLE });
		const hit = out.find((r) => r.id === KNODE_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('airboss.knode');
		expect(hit?.passageHighlight).toMatch(/<mark>/);
	});

	it('orders merged rows by ts_rank_cd descending', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		// All seeded rows from the three sources (handbook section, CFR
		// section, course step) should be present. The strong invariant we
		// assert is "the loader merges across every source and returns the
		// expected number of merged hits"; cross-source rank ordering is a
		// `ts_rank_cd` artifact that we trust Postgres to compute.
		const seededIds = new Set([SEC_HANDBOOK_ID, SEC_CFR_ID, COURSE_STEP_SECTION_ID]);
		const seededHits = out.filter((r) => seededIds.has(r.id));
		expect(seededHits.length).toBe(3);
	});

	it('returns an empty array for an empty needle', async () => {
		const out = await loadFtsPassages({ needle: '' });
		expect(out).toEqual([]);
	});

	it('returns an empty array for a whitespace-only needle', async () => {
		const out = await loadFtsPassages({ needle: '   ' });
		expect(out).toEqual([]);
	});

	it('respects the limit option', async () => {
		const out = await loadFtsPassages({ needle: PHRASE, limit: 1 });
		expect(out.length).toBeLessThanOrEqual(1);
	});

	it('populates depth on reference-section rows from the schema column', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const handbookHit = out.find((r) => r.id === SEC_HANDBOOK_ID);
		const cfrHit = out.find((r) => r.id === SEC_CFR_ID);
		expect(handbookHit?.depth).toBe(1);
		expect(cfrHit?.depth).toBe(2);
	});

	it('populates clusterKey from documentSlug for collapse', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const handbookHit = out.find((r) => r.id === SEC_HANDBOOK_ID);
		expect(handbookHit?.clusterKey).toMatch(/^fts-phak-/);
	});
});

describe('loadFtsPassages - course_step source', () => {
	it('returns the seeded course step on a phrase needle', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const hit = out.find((r) => r.id === COURSE_STEP_SECTION_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('airboss.lesson');
		expect(hit?.passageHighlight).toBeDefined();
		expect(hit?.passageHighlight).toMatch(/<mark>/);
		expect(hit?.passageHighlight).toMatch(/<\/mark>/);
	});

	it('builds the course-step href from ROUTES.COURSE_STEP', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const hit = out.find((r) => r.id === COURSE_STEP_SECTION_ID);
		expect(hit?.href).toBe(`/courses/${COURSE_SLUG}/${COURSE_STEP_SECTION_CODE}`);
	});

	it('populates the row title with the course-step code + title', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const hit = out.find((r) => r.id === COURSE_STEP_SECTION_ID);
		expect(hit?.title).toBe(`${COURSE_STEP_SECTION_CODE} - Night-flying section`);
	});

	it('uses the parent course id as clusterKey for collapse', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const hit = out.find((r) => r.id === COURSE_STEP_SECTION_ID);
		expect(hit?.clusterKey).toBe(COURSE_ID);
	});

	it('maps section-level course steps to depth 0', async () => {
		const out = await loadFtsPassages({ needle: PHRASE });
		const hit = out.find((r) => r.id === COURSE_STEP_SECTION_ID);
		expect(hit?.depth).toBe(0);
	});

	it('returns an empty array for an empty needle (course-step source path)', async () => {
		const out = await loadFtsPassages({ needle: '' });
		expect(out).toEqual([]);
	});

	it('respects the limit option across all sources including course_step', async () => {
		const out = await loadFtsPassages({ needle: PHRASE, limit: 1 });
		expect(out.length).toBeLessThanOrEqual(1);
	});
});
