/**
 * Lens framework tests. Pure rollup math runs without a DB; integration
 * tests use a synthetic small syllabus + goal + knowledge nodes for the
 * realistic projection paths.
 */

import { bauthUser } from '@ab/auth/schema';
import { CREDENTIAL_STATUSES, GOAL_STATUSES, SYLLABUS_PRIMACY, SYLLABUS_STATUSES } from '@ab/constants';
import { db } from '@ab/db';
import {
	generateAuthId,
	generateCredentialId,
	generateGoalId,
	generateSyllabusId,
	generateSyllabusNodeId,
	generateSyllabusNodeLinkId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acsLens, computeMasteryRollup, domainLens } from './lenses';
import {
	credential,
	credentialSyllabus,
	goal,
	goalNode,
	goalSyllabus,
	knowledgeNode,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
} from './schema';

// -- Pure-function tests ----------------------------------------------------

describe('computeMasteryRollup', () => {
	it('returns zero rollup for an empty input', () => {
		const r = computeMasteryRollup([]);
		expect(r.totalLeaves).toBe(0);
		expect(r.coveredLeaves).toBe(0);
		expect(r.masteredLeaves).toBe(0);
		expect(r.masteryFraction).toBe(0);
		expect(r.coverageFraction).toBe(0);
	});

	it('rolls up unweighted leaves correctly', () => {
		const r = computeMasteryRollup([
			{ mastery: { mastered: true, covered: true }, weight: 1 },
			{ mastery: { mastered: false, covered: true }, weight: 1 },
			{ mastery: { mastered: false, covered: false }, weight: 1 },
		]);
		expect(r.totalLeaves).toBe(3);
		expect(r.coveredLeaves).toBe(2);
		expect(r.masteredLeaves).toBe(1);
		expect(r.masteryFraction).toBeCloseTo(1 / 3);
		expect(r.coverageFraction).toBeCloseTo(2 / 3);
	});

	it('respects weights', () => {
		const r = computeMasteryRollup([
			{ mastery: { mastered: true, covered: true }, weight: 3 },
			{ mastery: { mastered: false, covered: false }, weight: 1 },
		]);
		// Weighted mastery: 3 * 1 / (3 + 1) = 0.75
		expect(r.masteryFraction).toBeCloseTo(0.75);
	});

	it('returns 0 fractions when all weights are zero', () => {
		const r = computeMasteryRollup([{ mastery: { mastered: true, covered: true }, weight: 0 }]);
		expect(r.masteryFraction).toBe(0);
		expect(r.coverageFraction).toBe(0);
	});
});

// -- DB-backed integration tests --------------------------------------------

const SUITE_TAG = `lens-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const slug = (s: string): string => `${s}-${SUITE_TOKEN}`;

const TEST_USER_ID = generateAuthId();
const PPL_CRED_ID = generateCredentialId();
const PPL_SYL_ID = generateSyllabusId();
const AREA_V_ID = generateSyllabusNodeId();
const TASK_A_ID = generateSyllabusNodeId();
const K1_ID = generateSyllabusNodeId();
const R1_ID = generateSyllabusNodeId();
const S1_ID = generateSyllabusNodeId();
const KN_AERO_ID = `kn-${SUITE_TAG}-aero`;
const KN_RM_ID = `kn-${SUITE_TAG}-rm`;
const KN_SKILL_ID = `kn-${SUITE_TAG}-skill`;
const KN_ADHOC_ID = `kn-${SUITE_TAG}-adhoc`;
const GOAL_ID = generateGoalId();

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: `${SUITE_TAG}@airboss.test`,
		name: 'Lens Test',
		firstName: 'Lens',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(credential).values({
		id: PPL_CRED_ID,
		slug: slug('private'),
		kind: 'pilot-cert',
		title: 'Private Pilot',
		category: 'airplane',
		class: 'single-engine-land',
		regulatoryBasis: [],
		status: CREDENTIAL_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(syllabus).values({
		id: PPL_SYL_ID,
		slug: slug('ppl-acs-lens'),
		kind: 'acs',
		title: 'PPL ACS lens test',
		edition: `faa-s-acs-lens-${SUITE_TOKEN}`,
		status: SYLLABUS_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(credentialSyllabus).values({
		credentialId: PPL_CRED_ID,
		syllabusId: PPL_SYL_ID,
		primacy: SYLLABUS_PRIMACY.PRIMARY,
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});

	// Area V -> Task A -> K1 / R1 / S1 leaves.
	await db.insert(syllabusNode).values([
		{
			id: AREA_V_ID,
			syllabusId: PPL_SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 5,
			code: `${SUITE_TOKEN}-V`,
			title: 'Performance Maneuvers',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: TASK_A_ID,
			syllabusId: PPL_SYL_ID,
			parentId: AREA_V_ID,
			level: 'task',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V.A`,
			title: 'Steep Turns',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: K1_ID,
			syllabusId: PPL_SYL_ID,
			parentId: TASK_A_ID,
			level: 'element',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V.A.K1`,
			title: 'Aerodynamics of steep turns',
			description: '',
			triad: 'knowledge',
			requiredBloom: 'understand',
			isLeaf: true,
			airbossRef: 'airboss-ref:acs/ppl-airplane-6c/area-05/task-a/elem-k01',
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: R1_ID,
			syllabusId: PPL_SYL_ID,
			parentId: TASK_A_ID,
			level: 'element',
			ordinal: 2,
			code: `${SUITE_TOKEN}-V.A.R1`,
			title: 'Failure to maintain coordinated flight',
			description: '',
			triad: 'risk_management',
			requiredBloom: 'apply',
			isLeaf: true,
			airbossRef: 'airboss-ref:acs/ppl-airplane-6c/area-05/task-a/elem-r01',
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: S1_ID,
			syllabusId: PPL_SYL_ID,
			parentId: TASK_A_ID,
			level: 'element',
			ordinal: 3,
			code: `${SUITE_TOKEN}-V.A.S1`,
			title: 'Demonstrate steep turns',
			description: '',
			triad: 'skill',
			requiredBloom: 'apply',
			isLeaf: true,
			airbossRef: 'airboss-ref:acs/ppl-airplane-6c/area-05/task-a/elem-s01',
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(knowledgeNode).values([
		{
			id: KN_AERO_ID,
			title: 'Aerodynamic forces',
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
			contentMd: 'test',
			contentHash: null,
			version: 1,
			authorId: null,
			lifecycle: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: KN_RM_ID,
			title: 'Coordinated flight',
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
			contentMd: 'test',
			contentHash: null,
			version: 1,
			authorId: null,
			lifecycle: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: KN_SKILL_ID,
			title: 'Steep turn execution',
			domain: 'flight-planning',
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
			contentMd: 'test',
			contentHash: null,
			version: 1,
			authorId: null,
			lifecycle: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: KN_ADHOC_ID,
			title: 'BFR currency item',
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
			references: [],
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
		},
	]);

	await db.insert(syllabusNodeLink).values([
		{
			id: generateSyllabusNodeLinkId(),
			syllabusNodeId: K1_ID,
			knowledgeNodeId: KN_AERO_ID,
			weight: 1.0,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			id: generateSyllabusNodeLinkId(),
			syllabusNodeId: R1_ID,
			knowledgeNodeId: KN_RM_ID,
			weight: 1.0,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			id: generateSyllabusNodeLinkId(),
			syllabusNodeId: S1_ID,
			knowledgeNodeId: KN_SKILL_ID,
			weight: 1.0,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
	]);

	await db.insert(goal).values({
		id: GOAL_ID,
		userId: TEST_USER_ID,
		title: 'Lens test goal',
		notesMd: '',
		status: GOAL_STATUSES.ACTIVE,
		isPrimary: true,
		targetDate: null,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(goalSyllabus).values({
		goalId: GOAL_ID,
		syllabusId: PPL_SYL_ID,
		weight: 1.0,
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});
	await db.insert(goalNode).values({
		goalId: GOAL_ID,
		knowledgeNodeId: KN_ADHOC_ID,
		weight: 1.0,
		notes: '',
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});
});

afterAll(async () => {
	await db.delete(goalNode).where(eq(goalNode.goalId, GOAL_ID));
	await db.delete(goalSyllabus).where(eq(goalSyllabus.goalId, GOAL_ID));
	await db.delete(goal).where(eq(goal.id, GOAL_ID));
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNode).where(eq(syllabusNode.seedOrigin, SUITE_TAG));
	await db.delete(credentialSyllabus).where(eq(credentialSyllabus.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(credential).where(eq(credential.seedOrigin, SUITE_TAG));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('acsLens', () => {
	it('returns the empty result for a null goal', async () => {
		const result = await acsLens(db, TEST_USER_ID, { goal: null });
		expect(result.tree).toEqual([]);
		expect(result.rollup.totalLeaves).toBe(0);
	});

	it('builds a cert -> area -> task -> element tree from the goal syllabi', async () => {
		const goalRow = (await db.select().from(goal).where(eq(goal.id, GOAL_ID)).limit(1))[0];
		if (!goalRow) throw new Error('expected seeded goal row');
		const result = await acsLens(db, TEST_USER_ID, { goal: goalRow });
		expect(result.tree.length).toBe(1);
		const cert = result.tree[0];
		expect(cert?.level).toBe('cert');
		expect(cert?.children.length).toBe(1);
		const area = cert?.children[0];
		expect(area?.level).toBe('area');
		expect(area?.children.length).toBe(1);
		const task = area?.children[0];
		expect(task?.level).toBe('task');
		expect(task?.children.length).toBe(3); // K1, R1, S1
		// Each leaf has 1 link, so leaves count = 3.
		expect(result.rollup.totalLeaves).toBe(3);
		// User has no cards / scenarios -> nothing covered or mastered.
		expect(result.rollup.coveredLeaves).toBe(0);
		expect(result.rollup.masteredLeaves).toBe(0);
	});

	it('respects areaCodes filter', async () => {
		const goalRow = (await db.select().from(goal).where(eq(goal.id, GOAL_ID)).limit(1))[0];
		if (!goalRow) throw new Error('expected seeded goal row');
		const result = await acsLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { areaCodes: ['nonexistent-code'] },
		});
		// Filter excludes our area; the cert has no children.
		expect(result.tree[0]?.children.length).toBe(0);
	});

	it('respects elementCodes filter', async () => {
		const goalRow = (await db.select().from(goal).where(eq(goal.id, GOAL_ID)).limit(1))[0];
		if (!goalRow) throw new Error('expected seeded goal row');
		const result = await acsLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { elementCodes: [`${SUITE_TOKEN}-V.A.K1`] },
		});
		const task = result.tree[0]?.children[0]?.children[0];
		// Only K1 element passes.
		expect(task?.children.length).toBe(1);
		expect(task?.children[0]?.title).toBe('Aerodynamics of steep turns');
	});

	it('class-agnostic nodes pass every class filter (default)', async () => {
		// The seeded fixture has classes=null on every node; any class filter
		// must let every row through.
		const goalRow = (await db.select().from(goal).where(eq(goal.id, GOAL_ID)).limit(1))[0];
		if (!goalRow) throw new Error('expected seeded goal row');
		const result = await acsLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { classes: ['amel', 'ames'] },
		});
		expect(result.tree[0]?.children.length).toBe(1); // area passes
		expect(result.tree[0]?.children[0]?.children.length).toBe(1); // task passes
	});

	it('classes filter excludes class-tagged nodes that do not intersect', async () => {
		// Insert a sibling task tagged AMEL/AMES only (the FAA's "Maneuvering
		// with One Engine Inoperative" pattern), then verify the ASEL filter
		// excludes it.
		const now = new Date();
		const TASK_B_ID = generateSyllabusNodeId();
		await db.insert(syllabusNode).values([
			{
				id: TASK_B_ID,
				syllabusId: PPL_SYL_ID,
				parentId: AREA_V_ID,
				level: 'task',
				ordinal: 2,
				code: `${SUITE_TOKEN}-V.B-mei`,
				title: 'Maneuvering with One Engine Inoperative',
				description: '',
				triad: null,
				requiredBloom: null,
				isLeaf: false,
				airbossRef: null,
				citations: [],
				classes: ['amel', 'ames'],
				contentHash: null,
				seedOrigin: SUITE_TAG,
				createdAt: now,
				updatedAt: now,
			},
		]);
		try {
			const goalRow = (await db.select().from(goal).where(eq(goal.id, GOAL_ID)).limit(1))[0];
			if (!goalRow) throw new Error('expected seeded goal row');
			const aselResult = await acsLens(db, TEST_USER_ID, {
				goal: goalRow,
				filters: { classes: ['asel'] },
			});
			const aselTaskCount = aselResult.tree[0]?.children[0]?.children.length ?? 0;
			expect(aselTaskCount).toBe(1); // class-agnostic task A passes; AMEL/AMES task B excluded.

			const meiResult = await acsLens(db, TEST_USER_ID, {
				goal: goalRow,
				filters: { classes: ['amel'] },
			});
			const meiTaskCount = meiResult.tree[0]?.children[0]?.children.length ?? 0;
			expect(meiTaskCount).toBe(2); // class-agnostic + AMEL/AMES task both pass.
		} finally {
			await db.delete(syllabusNode).where(eq(syllabusNode.id, TASK_B_ID));
		}
	});
});

describe('domainLens', () => {
	it('returns the empty result for a null goal', async () => {
		const result = await domainLens(db, TEST_USER_ID, { goal: null });
		expect(result.tree).toEqual([]);
	});

	it('groups every reachable knowledge node by domain', async () => {
		const goalRow = (await db.select().from(goal).where(eq(goal.id, GOAL_ID)).limit(1))[0];
		if (!goalRow) throw new Error('expected seeded goal row');
		const result = await domainLens(db, TEST_USER_ID, { goal: goalRow });
		// Reachable nodes: KN_AERO + KN_RM (aerodynamics), KN_SKILL (flight-planning),
		// KN_ADHOC (regulations).
		const domainNames = result.tree.map((d) => d.id);
		expect(domainNames).toContain('domain:aerodynamics');
		expect(domainNames).toContain('domain:flight-planning');
		expect(domainNames).toContain('domain:regulations');
		expect(result.rollup.totalLeaves).toBe(4);
	});

	it('respects domains filter', async () => {
		const goalRow = (await db.select().from(goal).where(eq(goal.id, GOAL_ID)).limit(1))[0];
		if (!goalRow) throw new Error('expected seeded goal row');
		const result = await domainLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { domains: ['aerodynamics'] },
		});
		expect(result.tree.map((d) => d.id)).toEqual(['domain:aerodynamics']);
		expect(result.rollup.totalLeaves).toBe(2); // KN_AERO + KN_RM
	});
});
