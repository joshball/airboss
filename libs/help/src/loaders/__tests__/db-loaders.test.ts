/**
 * DB-backed palette loader integration tests. Real Postgres -- the loaders
 * use Drizzle ilike + joins through `study.reference` / `study.card` /
 * `study.review` / `study.study_plan` / `study.knowledge_node` / `study.course`
 * and the shape constraints (FK cascades, status CHECKs, unique indexes) are
 * DB-enforced. A pure unit mock would silently pass while the real query
 * shape regressed.
 *
 * Suite shape:
 *   1. Build per-test-suite users + reference rows.
 *   2. Each describe block exercises one loader: positive match, no-match
 *      empty needle, and user-scoping for the mine.* family.
 *   3. afterAll cleans up by suite tag so the suite is rerunnable + isolated
 *      from neighbour tests.
 */

import { bauthUser } from '@ab/auth/schema';
import { card, cardState, course, knowledgeNode, reference, referenceSection, review, studyPlan } from '@ab/bc-study';
import {
	CARD_KINDS,
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CONTENT_SOURCES,
	COURSE_KINDS,
	COURSE_STATUSES,
	DOMAINS,
	PLAN_STATUSES,
	REFERENCE_KINDS,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import {
	generateAuthId,
	generateCardId,
	generateReferenceSectionId,
	generateReviewId,
	generateStudyPlanId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseQuery } from '../../query-parser';
import type { PaletteHost } from '../../schema/result-types';
import { loadAimSections } from '../aim-sections';
import { loadCards } from '../cards';
import { loadCfrSections } from '../cfr-sections';
import { loadCourses } from '../courses';
import { loadHandbookSections } from '../handbook-sections';
import { loadKnowledgeNodes } from '../knowledge-nodes';
import { loadPlans } from '../plans';
import { loadReps } from '../reps';

const SUITE_TAG = `palette-loaders-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const TEST_USER_ID = generateAuthId();
const OTHER_USER_ID = generateAuthId();

// Tagged ids so cleanup can target without colliding with parallel suites.
const REF_HANDBOOK_ID = `ref-${SUITE_TAG}-hb`;
const REF_CFR_ID = `ref-${SUITE_TAG}-cfr`;
const REF_AIM_ID = `ref-${SUITE_TAG}-aim`;

const SEC_HANDBOOK_ID = generateReferenceSectionId();
const SEC_CFR_ID = generateReferenceSectionId();
const SEC_AIM_ID = generateReferenceSectionId();

const KNODE_ID = `kn-${SUITE_TAG}-zephyrlift`;
const COURSE_ID = `crs-${SUITE_TAG}-zephyrcourse`;
const COURSE_SLUG = `palette-zephyrcourse-${SUITE_TAG.slice(-12)}`.toLowerCase();

const CARD_OWN_ID = generateCardId();
const CARD_OTHER_ID = generateCardId();
const REVIEW_OWN_ID = generateReviewId();
const PLAN_ID = generateStudyPlanId();

// A non-collision needle that should only match seeded rows.
const NEEDLE = 'zephyrlift';

const HOST_AUTHED: PaletteHost = { surface: 'global', userId: TEST_USER_ID };
const HOST_ANON: PaletteHost = { surface: 'global', userId: undefined };

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values([
		{
			id: TEST_USER_ID,
			email: `${TEST_USER_ID}@airboss.test`,
			name: 'Palette Loader Test',
			firstName: 'Palette',
			lastName: 'TestUser',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: OTHER_USER_ID,
			email: `${OTHER_USER_ID}@airboss.test`,
			name: 'Other Palette User',
			firstName: 'Other',
			lastName: 'TestUser',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
	]);

	// Three reference rows: one handbook, one CFR, one AIM. Each has one
	// section row whose content_md contains the unique NEEDLE.
	await db.insert(reference).values([
		{
			id: REF_HANDBOOK_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: `palette-phak-${SUITE_TAG.slice(-12)}`.toLowerCase(),
			edition: 'TEST-ED-1',
			title: 'Test Handbook for Palette',
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
			documentSlug: `palette-cfr-${SUITE_TAG.slice(-12)}`.toLowerCase(),
			edition: 'TEST-CFR-1',
			title: '14 CFR Test Part',
			publisher: 'FAA',
			subjects: ['regulations'],
			primaryCert: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: REF_AIM_ID,
			kind: REFERENCE_KINDS.AIM,
			documentSlug: `palette-aim-${SUITE_TAG.slice(-12)}`.toLowerCase(),
			edition: 'TEST-AIM-1',
			title: 'AIM Test Edition',
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
			depth: 0,
			code: '12',
			airbossRef: `airboss-ref:handbook/palette-phak/12`,
			title: `Chapter 12 ${NEEDLE} content`,
			sourceLocator: 'Test Ch 12',
			contentMd: `# 12 ${NEEDLE} discussion\n\nBody includes ${NEEDLE} prose.`,
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
			depth: 0,
			code: '91.103',
			airbossRef: `airboss-ref:cfr/14-91/91.103`,
			title: `Preflight action ${NEEDLE}`,
			sourceLocator: '14 CFR §91.103',
			contentMd: `Each pilot in command shall, before beginning a flight, become familiar with all available information concerning that flight. ${NEEDLE} mention.`,
			contentHash: `hash-${SUITE_TAG}-cfr`,
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SEC_AIM_ID,
			referenceId: REF_AIM_ID,
			parentId: null,
			level: 'paragraph',
			ordinal: 1,
			depth: 0,
			code: '5-2-1',
			airbossRef: `airboss-ref:aim/5-2-1`,
			title: `AIM ${NEEDLE} paragraph`,
			sourceLocator: 'AIM 5-2-1',
			contentMd: `AIM body text with ${NEEDLE} keyword.`,
			contentHash: `hash-${SUITE_TAG}-aim`,
			hasFigures: false,
			hasTables: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(knowledgeNode).values({
		id: KNODE_ID,
		title: `${NEEDLE} knowledge concept`,
		domain: 'aerodynamics',
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
		contentMd: `Discovery body with ${NEEDLE} reasoning.`,
		contentHash: null,
		version: 1,
		authorId: null,
		lifecycle: null,
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(course).values({
		id: COURSE_ID,
		slug: COURSE_SLUG,
		kind: COURSE_KINDS.INSTRUCTOR,
		title: `${NEEDLE} Course`,
		description: `Course about ${NEEDLE} mechanics.`,
		status: COURSE_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});

	// Cards: one owned by TEST_USER_ID, one owned by OTHER_USER_ID. Both
	// match NEEDLE. The mine.* family must return only the owner's card.
	await db.insert(card).values([
		{
			id: CARD_OWN_ID,
			userId: TEST_USER_ID,
			front: `${NEEDLE} front`,
			back: 'card back text',
			domain: DOMAINS.AERODYNAMICS,
			tags: [],
			cardType: CARD_TYPES.BASIC,
			kind: CARD_KINDS.RECALL,
			sourceType: CONTENT_SOURCES.PERSONAL,
			sourceRef: null,
			nodeId: null,
			isEditable: true,
			status: CARD_STATUSES.ACTIVE,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CARD_OTHER_ID,
			userId: OTHER_USER_ID,
			front: `${NEEDLE} other-user card`,
			back: 'should-not-leak',
			domain: DOMAINS.AERODYNAMICS,
			tags: [],
			cardType: CARD_TYPES.BASIC,
			kind: CARD_KINDS.RECALL,
			sourceType: CONTENT_SOURCES.PERSONAL,
			sourceRef: null,
			nodeId: null,
			isEditable: true,
			status: CARD_STATUSES.ACTIVE,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(cardState).values([
		{
			cardId: CARD_OWN_ID,
			userId: TEST_USER_ID,
			stability: 1,
			difficulty: 5,
			state: CARD_STATES.NEW,
			dueAt: now,
			lastReviewId: null,
			lastReviewedAt: null,
			reviewCount: 0,
			lapseCount: 0,
		},
		{
			cardId: CARD_OTHER_ID,
			userId: OTHER_USER_ID,
			stability: 1,
			difficulty: 5,
			state: CARD_STATES.NEW,
			dueAt: now,
			lastReviewId: null,
			lastReviewedAt: null,
			reviewCount: 0,
			lapseCount: 0,
		},
	]);

	await db.insert(review).values({
		id: REVIEW_OWN_ID,
		cardId: CARD_OWN_ID,
		userId: TEST_USER_ID,
		rating: 3,
		confidence: null,
		stability: 2,
		difficulty: 5,
		elapsedDays: 1,
		scheduledDays: 5,
		state: CARD_STATES.LEARNING,
		dueAt: now,
		reviewedAt: now,
		answerMs: 1000,
		reviewSessionId: null,
		seedOrigin: SUITE_TAG,
	});

	await db.insert(studyPlan).values({
		id: PLAN_ID,
		userId: TEST_USER_ID,
		title: `${NEEDLE} study plan`,
		status: PLAN_STATUSES.ACTIVE,
		certGoals: [],
		focusDomains: [],
		skipDomains: [],
		skipNodes: [],
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	// Tear down in FK-safe order. Reviews, cards, plans, knowledge, sections,
	// references, courses, users.
	await db.delete(review).where(eq(review.id, REVIEW_OWN_ID));
	await db.delete(cardState).where(eq(cardState.cardId, CARD_OWN_ID));
	await db.delete(cardState).where(eq(cardState.cardId, CARD_OTHER_ID));
	await db.delete(card).where(eq(card.id, CARD_OWN_ID));
	await db.delete(card).where(eq(card.id, CARD_OTHER_ID));
	await db.delete(studyPlan).where(eq(studyPlan.id, PLAN_ID));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.id, KNODE_ID));
	await db.delete(course).where(eq(course.id, COURSE_ID));
	await db.delete(referenceSection).where(eq(referenceSection.id, SEC_HANDBOOK_ID));
	await db.delete(referenceSection).where(eq(referenceSection.id, SEC_CFR_ID));
	await db.delete(referenceSection).where(eq(referenceSection.id, SEC_AIM_ID));
	await db.delete(reference).where(eq(reference.id, REF_HANDBOOK_ID));
	await db.delete(reference).where(eq(reference.id, REF_CFR_ID));
	await db.delete(reference).where(eq(reference.id, REF_AIM_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, OTHER_USER_ID));
});

describe('loadHandbookSections', () => {
	it('returns the seeded handbook chapter on a free-text needle', async () => {
		const out = await loadHandbookSections(parseQuery(NEEDLE), HOST_AUTHED);
		const hit = out.find((r) => r.id === SEC_HANDBOOK_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('faa.handbook.chapter');
		expect(hit?.parentDocCode).toMatch(/^palette-phak-/);
		expect(hit?.title).toContain('12');
	});

	it('returns empty when needle is blank', async () => {
		const out = await loadHandbookSections(parseQuery(''), HOST_AUTHED);
		expect(out).toEqual([]);
	});

	it('does not leak CFR or AIM rows into handbook results', async () => {
		const out = await loadHandbookSections(parseQuery(NEEDLE), HOST_AUTHED);
		const ids = out.map((r) => r.id);
		expect(ids).not.toContain(SEC_CFR_ID);
		expect(ids).not.toContain(SEC_AIM_ID);
	});
});

describe('loadCfrSections', () => {
	it('returns the seeded CFR section on a free-text needle', async () => {
		const out = await loadCfrSections(parseQuery(NEEDLE), HOST_AUTHED);
		const hit = out.find((r) => r.id === SEC_CFR_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('faa.cfr.sect');
		expect(hit?.title).toContain('§');
	});

	it('returns empty when needle is blank', async () => {
		const out = await loadCfrSections(parseQuery(''), HOST_AUTHED);
		expect(out).toEqual([]);
	});
});

describe('loadAimSections', () => {
	it('returns the seeded AIM section on a free-text needle', async () => {
		const out = await loadAimSections(parseQuery(NEEDLE), HOST_AUTHED);
		const hit = out.find((r) => r.id === SEC_AIM_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('faa.aim');
		expect(hit?.title).toContain('5-2-1');
	});

	it('returns empty when needle is blank', async () => {
		const out = await loadAimSections(parseQuery(''), HOST_AUTHED);
		expect(out).toEqual([]);
	});
});

describe('loadKnowledgeNodes', () => {
	it('returns the seeded node on a free-text needle', async () => {
		const out = await loadKnowledgeNodes(parseQuery(NEEDLE), HOST_AUTHED);
		const hit = out.find((r) => r.id === KNODE_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('airboss.knode');
	});

	it('returns empty when needle is blank', async () => {
		const out = await loadKnowledgeNodes(parseQuery(''), HOST_AUTHED);
		expect(out).toEqual([]);
	});
});

describe('loadCards', () => {
	it('returns the owner card on a free-text needle', async () => {
		const out = await loadCards(parseQuery(NEEDLE), HOST_AUTHED);
		const hit = out.find((r) => r.id === CARD_OWN_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('mine.card');
	});

	it('never leaks another user card', async () => {
		const out = await loadCards(parseQuery(NEEDLE), HOST_AUTHED);
		const leak = out.find((r) => r.id === CARD_OTHER_ID);
		expect(leak).toBeUndefined();
	});

	it('returns empty when host has no userId', async () => {
		const out = await loadCards(parseQuery(NEEDLE), HOST_ANON);
		expect(out).toEqual([]);
	});
});

describe('loadReps', () => {
	it('returns the owner review row on a free-text needle', async () => {
		const out = await loadReps(parseQuery(NEEDLE), HOST_AUTHED);
		const hit = out.find((r) => r.id === REVIEW_OWN_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('mine.rep');
	});

	it('returns empty when host has no userId', async () => {
		const out = await loadReps(parseQuery(NEEDLE), HOST_ANON);
		expect(out).toEqual([]);
	});
});

describe('loadPlans', () => {
	it('returns the owner plan on a free-text needle', async () => {
		const out = await loadPlans(parseQuery(NEEDLE), HOST_AUTHED);
		const hit = out.find((r) => r.id === PLAN_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('mine.plan');
	});

	it('returns empty when host has no userId', async () => {
		const out = await loadPlans(parseQuery(NEEDLE), HOST_ANON);
		expect(out).toEqual([]);
	});
});

describe('loadCourses', () => {
	it('returns the seeded course on a free-text needle', async () => {
		const out = await loadCourses(parseQuery(NEEDLE), HOST_AUTHED);
		const hit = out.find((r) => r.id === COURSE_ID);
		expect(hit).toBeDefined();
		expect(hit?.type).toBe('airboss.course');
	});

	it('returns empty when needle is blank', async () => {
		const out = await loadCourses(parseQuery(''), HOST_AUTHED);
		expect(out).toEqual([]);
	});
});
