/**
 * Goals BC tests. Real Postgres -- the partial UNIQUE on
 * `goal (user_id) WHERE is_primary=true` is enforced by the DB, so the
 * `setPrimaryGoal` transactional swap test would not catch a regression
 * without a real database round-trip.
 */

import { bauthUser } from '@ab/auth/schema';
import { CREDENTIAL_STATUSES, GOAL_STATUSES, SYLLABUS_PRIMACY, SYLLABUS_STATUSES } from '@ab/constants';
import { db } from '@ab/db';
import {
	generateAuthId,
	generateCredentialId,
	generateSyllabusId,
	generateSyllabusNodeId,
	generateSyllabusNodeLinkId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	addGoalNode,
	addGoalSyllabus,
	archiveGoal,
	createGoal,
	GoalNotFoundError,
	GoalNotOwnedError,
	getActiveGoals,
	getDerivedCertGoals,
	getGoalById,
	getGoalNodes,
	getGoalNodeUnion,
	getGoalSyllabi,
	getOwnedGoal,
	getPrimaryGoal,
	listGoals,
	removeGoalNode,
	removeGoalSyllabus,
	setPrimaryGoal,
	updateGoal,
} from './goals';
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

const SUITE_TAG = `goal-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const slug = (s: string): string => `${s}-${SUITE_TOKEN}`;

const TEST_USER_ID = generateAuthId();
const OTHER_USER_ID = generateAuthId();

const PPL_CRED_ID = generateCredentialId();
const PPL_CRED_SLUG = slug('private');
const PPL_SYL_ID = generateSyllabusId();
const PPL_SYL_SLUG = slug('ppl-acs');

const AREA_ID = generateSyllabusNodeId();
const TASK_ID = generateSyllabusNodeId();
const K1_ID = generateSyllabusNodeId();
const KN_NODE_ID = `kn-${SUITE_TAG}-1`;
const ADHOC_NODE_ID = `kn-${SUITE_TAG}-adhoc`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values([
		{
			id: TEST_USER_ID,
			email: `${SUITE_TAG}@airboss.test`,
			name: 'Goal BC Test',
			firstName: 'Goal',
			lastName: 'Test',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: OTHER_USER_ID,
			email: `other-${SUITE_TAG}@airboss.test`,
			name: 'Other User',
			firstName: 'Other',
			lastName: 'User',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
	]);

	// One credential + primary syllabus so getDerivedCertGoals has something to walk.
	await db.insert(credential).values({
		id: PPL_CRED_ID,
		slug: PPL_CRED_SLUG,
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
		slug: PPL_SYL_SLUG,
		kind: 'acs',
		title: 'Test PPL ACS',
		edition: 'faa-s-acs-25',
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

	// Tree with one leaf so getGoalNodeUnion has something to find.
	await db.insert(syllabusNode).values([
		{
			id: AREA_ID,
			syllabusId: PPL_SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 1,
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
			id: TASK_ID,
			syllabusId: PPL_SYL_ID,
			parentId: AREA_ID,
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
			parentId: TASK_ID,
			level: 'element',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V.A.K1`,
			title: 'Aerodynamics',
			description: '',
			triad: 'knowledge',
			requiredBloom: 'understand',
			isLeaf: true,
			airbossRef: 'airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a/element-k1',
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(knowledgeNode).values([
		{
			id: KN_NODE_ID,
			title: 'kn-1',
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
			id: ADHOC_NODE_ID,
			title: 'adhoc',
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
	]);

	await db.insert(syllabusNodeLink).values({
		id: generateSyllabusNodeLinkId(),
		syllabusNodeId: K1_ID,
		knowledgeNodeId: KN_NODE_ID,
		weight: 1.0,
		notes: '',
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});
});

afterAll(async () => {
	// Delete user's goals (cascades to goal_syllabus + goal_node).
	await db.delete(goalNode).where(eq(goalNode.knowledgeNodeId, ADHOC_NODE_ID));
	await db.delete(goalNode).where(eq(goalNode.knowledgeNodeId, KN_NODE_ID));
	await db.delete(goalSyllabus).where(eq(goalSyllabus.syllabusId, PPL_SYL_ID));
	await db.delete(goal).where(eq(goal.userId, TEST_USER_ID));
	await db.delete(goal).where(eq(goal.userId, OTHER_USER_ID));
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNode).where(eq(syllabusNode.seedOrigin, SUITE_TAG));
	await db.delete(credentialSyllabus).where(eq(credentialSyllabus.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(credential).where(eq(credential.seedOrigin, SUITE_TAG));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, OTHER_USER_ID));
});

describe('createGoal', () => {
	it('creates a non-primary goal', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'first goal', notesMd: 'notes', isPrimary: false });
		expect(g.title).toBe('first goal');
		expect(g.isPrimary).toBe(false);
		expect(g.status).toBe(GOAL_STATUSES.ACTIVE);
		expect(g.userId).toBe(TEST_USER_ID);
	});

	it('creates a primary goal and clears any prior primary', async () => {
		// Existing first goal is non-primary; create a primary.
		const g1 = await createGoal({ userId: TEST_USER_ID, title: 'primary 1', notesMd: '', isPrimary: true });
		const g2 = await createGoal({ userId: TEST_USER_ID, title: 'primary 2', notesMd: '', isPrimary: true });
		const refreshed = await getGoalById(g1.id);
		expect(refreshed.isPrimary).toBe(false);
		expect(g2.isPrimary).toBe(true);
	});
});

describe('listGoals / getActiveGoals / getPrimaryGoal', () => {
	it('lists every goal for a user', async () => {
		const goals = await listGoals(TEST_USER_ID);
		expect(goals.length).toBeGreaterThanOrEqual(2);
	});

	it('orders by is_primary desc', async () => {
		const goals = await listGoals(TEST_USER_ID);
		const primaryIdx = goals.findIndex((g) => g.isPrimary);
		expect(primaryIdx).toBe(0);
	});

	it('getActiveGoals filters by status', async () => {
		const active = await getActiveGoals(TEST_USER_ID);
		expect(active.every((g) => g.status === GOAL_STATUSES.ACTIVE)).toBe(true);
	});

	it('getPrimaryGoal resolves the primary', async () => {
		const primary = await getPrimaryGoal(TEST_USER_ID);
		expect(primary).not.toBeNull();
		expect(primary?.isPrimary).toBe(true);
	});

	it('getPrimaryGoal returns null when no primary exists', async () => {
		const primary = await getPrimaryGoal(OTHER_USER_ID);
		expect(primary).toBeNull();
	});
});

describe('getGoalById / getOwnedGoal', () => {
	it('throws NotFound for unknown id', async () => {
		await expect(getGoalById('goal_does_not_exist')).rejects.toBeInstanceOf(GoalNotFoundError);
	});

	it('throws NotOwned when the user does not own the goal', async () => {
		const primary = await getPrimaryGoal(TEST_USER_ID);
		if (primary === null) throw new Error('expected a primary goal');
		await expect(getOwnedGoal(primary.id, OTHER_USER_ID)).rejects.toBeInstanceOf(GoalNotOwnedError);
	});
});

describe('updateGoal / archiveGoal', () => {
	it('updates fields', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'to update', notesMd: '', isPrimary: false });
		const updated = await updateGoal(g.id, TEST_USER_ID, { title: 'updated title', notesMd: 'updated notes' });
		expect(updated.title).toBe('updated title');
		expect(updated.notesMd).toBe('updated notes');
	});

	it('archives a goal', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'to archive', notesMd: '', isPrimary: false });
		const archived = await archiveGoal(g.id, TEST_USER_ID);
		expect(archived.status).toBe(GOAL_STATUSES.ABANDONED);
	});
});

describe('setPrimaryGoal', () => {
	it('clears the prior primary and sets the target', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'set-primary candidate', notesMd: '', isPrimary: false });
		const before = await getPrimaryGoal(TEST_USER_ID);
		await setPrimaryGoal(g.id, TEST_USER_ID);
		const after = await getPrimaryGoal(TEST_USER_ID);
		expect(after?.id).toBe(g.id);
		expect(after?.id).not.toBe(before?.id);
		// Prior primary cleared.
		if (before !== null) {
			const refreshed = await getGoalById(before.id);
			expect(refreshed.isPrimary).toBe(false);
		}
	});
});

describe('addGoalSyllabus / removeGoalSyllabus / getGoalSyllabi', () => {
	it('adds and removes a syllabus on a goal', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'syllabus test', notesMd: '', isPrimary: false });
		await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: PPL_SYL_ID, weight: 0.7 });
		let rows = await getGoalSyllabi(g.id);
		expect(rows.length).toBe(1);
		expect(rows[0]?.weight).toBeCloseTo(0.7);
		// Idempotent reweight via add.
		await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: PPL_SYL_ID, weight: 1.5 });
		rows = await getGoalSyllabi(g.id);
		expect(rows.length).toBe(1);
		expect(rows[0]?.weight).toBeCloseTo(1.5);
		await removeGoalSyllabus(g.id, TEST_USER_ID, PPL_SYL_ID);
		rows = await getGoalSyllabi(g.id);
		expect(rows.length).toBe(0);
	});
});

describe('addGoalNode / removeGoalNode / getGoalNodes', () => {
	it('adds and removes an ad-hoc node', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'node test', notesMd: '', isPrimary: false });
		await addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: ADHOC_NODE_ID, weight: 1.0, notes: 'weak' });
		let rows = await getGoalNodes(g.id);
		expect(rows.length).toBe(1);
		expect(rows[0]?.notes).toBe('weak');
		await addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: ADHOC_NODE_ID, weight: 2.0, notes: 'updated' });
		rows = await getGoalNodes(g.id);
		expect(rows.length).toBe(1);
		expect(rows[0]?.notes).toBe('updated');
		await removeGoalNode(g.id, TEST_USER_ID, ADHOC_NODE_ID);
		rows = await getGoalNodes(g.id);
		expect(rows.length).toBe(0);
	});
});

describe('getGoalNodeUnion', () => {
	it('aggregates syllabus-walked nodes + ad-hoc nodes with weights', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'union test', notesMd: '', isPrimary: false });
		await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: PPL_SYL_ID, weight: 0.5 });
		await addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: ADHOC_NODE_ID, weight: 2.0, notes: '' });
		const union = await getGoalNodeUnion(g.id);
		// KN_NODE_ID found via syllabus link (goal weight 0.5 * link weight 1.0 = 0.5)
		// ADHOC_NODE_ID found ad-hoc with weight 2.0
		expect(union.knowledgeNodeIds.sort()).toEqual([ADHOC_NODE_ID, KN_NODE_ID].sort());
		expect(union.weights[KN_NODE_ID]).toBeCloseTo(0.5);
		expect(union.weights[ADHOC_NODE_ID]).toBeCloseTo(2.0);
	});

	it('takes the max weight when a node is reachable via multiple paths', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'max test', notesMd: '', isPrimary: false });
		await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: PPL_SYL_ID, weight: 1.0 });
		await addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: KN_NODE_ID, weight: 0.3, notes: '' });
		const union = await getGoalNodeUnion(g.id);
		// syllabus path: 1.0 * 1.0 = 1.0; adhoc path: 0.3. Max = 1.0.
		expect(union.weights[KN_NODE_ID]).toBeCloseTo(1.0);
	});
});

describe('getDerivedCertGoals', () => {
	it('projects the primary goal back to credential slugs', async () => {
		// Make a fresh primary goal that includes the test syllabus.
		const g = await createGoal({ userId: TEST_USER_ID, title: 'derive test', notesMd: '', isPrimary: true });
		await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: PPL_SYL_ID, weight: 1.0 });
		const slugs = await getDerivedCertGoals(TEST_USER_ID);
		expect(slugs).toContain(PPL_CRED_SLUG);
	});

	it('returns [] when the user has no primary goal', async () => {
		const slugs = await getDerivedCertGoals(OTHER_USER_ID);
		expect(slugs).toEqual([]);
	});
});
