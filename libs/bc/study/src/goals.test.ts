/**
 * Goals BC tests. Real Postgres -- the partial UNIQUE on
 * `goal (user_id) WHERE is_primary=true` is enforced by the DB, so the
 * `setPrimaryGoal` transactional swap test would not catch a regression
 * without a real database round-trip.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CREDENTIAL_STATUSES,
	GOAL_NODE_NOTES_MAX_LENGTH,
	GOAL_NOTES_MAX_LENGTH,
	GOAL_STATUSES,
	GOAL_SYLLABUS_WEIGHT_MAX,
	GOAL_SYLLABUS_WEIGHT_MIN,
	GOAL_TITLE_MAX_LENGTH,
	SYLLABUS_PRIMACY,
	SYLLABUS_STATUSES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import {
	generateAuthId,
	generateCredentialId,
	generateSyllabusId,
	generateSyllabusNodeId,
	generateSyllabusNodeLinkId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	addGoalNode,
	addGoalSyllabus,
	applyCertGoalsToPrimaryGoal,
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
	setGoalFocusDomains,
	setGoalNodeWeight,
	setGoalSkipDomains,
	setGoalSkipNodes,
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
// Dedicated user for applyCertGoalsToPrimaryGoal tests so primary-goal
// state doesn't collide with the broader createGoal/setPrimaryGoal suite.
const APPLY_USER_ID = generateAuthId();

const PPL_CRED_ID = generateCredentialId();
const PPL_CRED_SLUG = slug('private');
const PPL_SYL_ID = generateSyllabusId();
const PPL_SYL_SLUG = slug('ppl-acs');

// Second credential with a primary syllabus -- exercises the batched
// applyCertGoalsToPrimaryGoal path with two found certs in one query.
const IFR_CRED_ID = generateCredentialId();
const IFR_CRED_SLUG = slug('instrument');
const IFR_SYL_ID = generateSyllabusId();
const IFR_SYL_SLUG = slug('ifr-acs');

// Third credential WITHOUT a primary syllabus -- exercises the "credential
// resolves but no primary syllabus" skip branch.
const ORPHAN_CRED_ID = generateCredentialId();
const ORPHAN_CRED_SLUG = slug('orphan-cred');

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
		{
			id: APPLY_USER_ID,
			email: `apply-${SUITE_TAG}@airboss.test`,
			name: 'Apply Cert Goals',
			firstName: 'Apply',
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
		edition: `faa-s-acs-25-${SUITE_TOKEN}`,
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

	// Second cert with a primary syllabus -- gives applyCertGoalsToPrimaryGoal
	// a multi-cert success path through the batched reads.
	await db.insert(credential).values({
		id: IFR_CRED_ID,
		slug: IFR_CRED_SLUG,
		kind: 'pilot-cert',
		title: 'Instrument Rating',
		category: 'airplane',
		class: 'single-engine-land',
		regulatoryBasis: [],
		status: CREDENTIAL_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(syllabus).values({
		id: IFR_SYL_ID,
		slug: IFR_SYL_SLUG,
		kind: 'acs',
		title: 'Test IFR ACS',
		edition: `faa-s-acs-8-${SUITE_TOKEN}`,
		status: SYLLABUS_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(credentialSyllabus).values({
		credentialId: IFR_CRED_ID,
		syllabusId: IFR_SYL_ID,
		primacy: SYLLABUS_PRIMACY.PRIMARY,
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});

	// Third cert without any primary syllabus -- exercises the "credential
	// resolves but primary syllabus is missing" skip branch.
	await db.insert(credential).values({
		id: ORPHAN_CRED_ID,
		slug: ORPHAN_CRED_SLUG,
		kind: 'pilot-cert',
		title: 'Orphan Cert',
		category: 'airplane',
		class: 'single-engine-land',
		regulatoryBasis: [],
		status: CREDENTIAL_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
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
			airbossRef: 'airboss-ref:acs/ppl-airplane-6c/area-05/task-a/elem-k01',
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
	await db.delete(goal).where(eq(goal.userId, APPLY_USER_ID));
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNode).where(eq(syllabusNode.seedOrigin, SUITE_TAG));
	await db.delete(credentialSyllabus).where(eq(credentialSyllabus.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(credential).where(eq(credential.seedOrigin, SUITE_TAG));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, OTHER_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, APPLY_USER_ID));
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

describe('setGoalNodeWeight', () => {
	it('updates the weight on an existing goal_node row without touching notes', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'weight test', notesMd: '', isPrimary: false });
		await addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: ADHOC_NODE_ID, weight: 1.0, notes: 'original notes' });
		await setGoalNodeWeight(g.id, TEST_USER_ID, ADHOC_NODE_ID, 0.25);
		const rows = await getGoalNodes(g.id);
		expect(rows.length).toBe(1);
		expect(rows[0]?.weight).toBeCloseTo(0.25);
		expect(rows[0]?.notes).toBe('original notes');
	});

	it('throws when the goal is not owned by the user', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'owner test', notesMd: '', isPrimary: false });
		await addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: ADHOC_NODE_ID, weight: 1.0, notes: '' });
		await expect(setGoalNodeWeight(g.id, 'auth_other-user', ADHOC_NODE_ID, 0.5)).rejects.toThrow(GoalNotOwnedError);
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

describe('applyCertGoalsToPrimaryGoal', () => {
	it('returns the existing primary unchanged for an empty cert list', async () => {
		const result = await applyCertGoalsToPrimaryGoal(APPLY_USER_ID, [], { goalTitle: 'apply empty' });
		expect(result.created).toBe(true);
		expect(result.skippedCerts).toEqual([]);
		const primary = await getPrimaryGoal(APPLY_USER_ID);
		expect(primary?.id).toBe(result.goalId);
		expect(primary?.title).toBe('apply empty');
		const linked = await getGoalSyllabi(result.goalId);
		expect(linked.length).toBe(0);

		// Re-running with [] is a no-op (no new primary, no new links).
		const second = await applyCertGoalsToPrimaryGoal(APPLY_USER_ID, []);
		expect(second.created).toBe(false);
		expect(second.goalId).toBe(result.goalId);
		expect(second.skippedCerts).toEqual([]);
	});

	it('batches mixed found / missing certs and reports skips', async () => {
		// Cast the test slugs through `unknown` -- the DB treats `cert` as a
		// free-form text column at this layer, so the runtime accepts any
		// string. The Cert type alias keeps the production call sites honest;
		// the test fixture seeds slugs that aren't in the constant set.
		const certs = [PPL_CRED_SLUG, IFR_CRED_SLUG, ORPHAN_CRED_SLUG, slug('does-not-exist')] as unknown as Array<
			Parameters<typeof applyCertGoalsToPrimaryGoal>[1][number]
		>;
		const result = await applyCertGoalsToPrimaryGoal(APPLY_USER_ID, certs);
		expect(result.created).toBe(false); // primary already exists from prior test
		expect(result.skippedCerts.sort()).toEqual([ORPHAN_CRED_SLUG, slug('does-not-exist')].sort());

		const linked = await getGoalSyllabi(result.goalId);
		const linkedSyllabusIds = linked.map((r) => r.syllabusId).sort();
		expect(linkedSyllabusIds).toEqual([PPL_SYL_ID, IFR_SYL_ID].sort());
		expect(linked.every((r) => r.weight === 1.0)).toBe(true);
	});

	it('is idempotent on re-run', async () => {
		const certs = [PPL_CRED_SLUG, IFR_CRED_SLUG] as unknown as Array<
			Parameters<typeof applyCertGoalsToPrimaryGoal>[1][number]
		>;
		const before = await getGoalSyllabi((await getPrimaryGoal(APPLY_USER_ID))?.id ?? '');
		const beforeIds = before.map((r) => r.syllabusId).sort();
		const result = await applyCertGoalsToPrimaryGoal(APPLY_USER_ID, certs);
		expect(result.created).toBe(false);
		expect(result.skippedCerts).toEqual([]);
		const after = await getGoalSyllabi(result.goalId);
		const afterIds = after.map((r) => r.syllabusId).sort();
		expect(afterIds).toEqual(beforeIds);
		expect(after.length).toBe(before.length);
	});

	it('dedupes repeated cert slugs in the input', async () => {
		const certs = [PPL_CRED_SLUG, PPL_CRED_SLUG, IFR_CRED_SLUG] as unknown as Array<
			Parameters<typeof applyCertGoalsToPrimaryGoal>[1][number]
		>;
		const result = await applyCertGoalsToPrimaryGoal(APPLY_USER_ID, certs);
		expect(result.skippedCerts).toEqual([]);
		const linked = await getGoalSyllabi(result.goalId);
		// Same two unique syllabi as the prior test -- duplicates collapse.
		expect(linked.map((r) => r.syllabusId).sort()).toEqual([PPL_SYL_ID, IFR_SYL_ID].sort());
	});

	// -------------------------------------------------------------------
	// Atomicity: the targeting patch + per-cert upserts + the create-
	// primary-goal path must all share a single transaction. A mid-loop
	// failure that left the targeting patch landed but only the first M
	// of N cert links attached used to drive `getDerivedCertGoals` to a
	// wrong cert filter while the user is mid-action. The forced-rollback
	// proxy proves every write rides the BC's transaction.
	// -------------------------------------------------------------------
	it('rolls back the targeting patch + cert links + create-primary atomically when the surrounding transaction fails', async () => {
		// Dedicated user so no goal exists -- exercises the "create
		// primary inside the transaction" branch alongside the multi-cert
		// upsert phase.
		const ATOMIC_USER_ID = generateAuthId();
		const now = new Date();
		await db.insert(bauthUser).values({
			id: ATOMIC_USER_ID,
			email: `atomic-${SUITE_TAG}@airboss.test`,
			name: 'Atomic Apply Cert',
			firstName: 'Atomic',
			lastName: 'User',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		});

		try {
			const certs = [PPL_CRED_SLUG, IFR_CRED_SLUG] as unknown as Array<
				Parameters<typeof applyCertGoalsToPrimaryGoal>[1][number]
			>;
			const wrapped = dbWithForcedRollback(db);

			await applyCertGoalsToPrimaryGoal(
				ATOMIC_USER_ID,
				certs,
				{ goalTitle: 'should not persist', focusDomains: ['airspace'] },
				wrapped,
			);

			// No primary goal landed -- the create-goal call ran inside the
			// rolled-back transaction.
			const goals = await db.select().from(goal).where(eq(goal.userId, ATOMIC_USER_ID));
			expect(goals).toHaveLength(0);

			// No cert links landed -- they rode the same transaction.
			const links = await db
				.select()
				.from(goalSyllabus)
				.innerJoin(goal, eq(goal.id, goalSyllabus.goalId))
				.where(eq(goal.userId, ATOMIC_USER_ID));
			expect(links).toHaveLength(0);
		} finally {
			await db.delete(goal).where(eq(goal.userId, ATOMIC_USER_ID));
			await db.delete(bauthUser).where(eq(bauthUser.id, ATOMIC_USER_ID));
		}
	});
});

// ---------------------------------------------------------------------------
// Zod validation at the BC boundary
//
// Mirrors the cards/scenarios pattern: the BC parses each write input against
// the matching schema in `credentials.validation.ts` so a cross-BC caller or
// script that bypasses the route layer cannot inject oversized titles,
// oversized notes, out-of-range weights, malformed dates, or unknown domain
// slugs. These tests pin that the BC throws `ZodError` BEFORE any DB I/O so a
// regression that drops the `.parse(...)` call surfaces here.
// Closes chunk-2 security MAJOR (`docs/work/reviews/2026-05-01-study-bc-domain-security.md`).
// ---------------------------------------------------------------------------
describe('BC-boundary Zod validation -- chunk-2 security MAJOR', () => {
	describe('createGoal', () => {
		it('round-trips a valid input', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'valid create',
				notesMd: 'short notes',
				isPrimary: false,
			});
			expect(g.title).toBe('valid create');
			expect(g.notesMd).toBe('short notes');
		});

		it('rejects an oversized title with ZodError before any DB write', async () => {
			const oversized = 'x'.repeat(GOAL_TITLE_MAX_LENGTH + 1);
			await expect(
				createGoal({ userId: TEST_USER_ID, title: oversized, notesMd: '', isPrimary: false }),
			).rejects.toThrow(z.ZodError);
			// Symmetric post-condition: nothing landed.
			const goals = await db.select().from(goal).where(eq(goal.userId, TEST_USER_ID));
			expect(goals.some((row) => row.title === oversized)).toBe(false);
		});

		it('rejects an oversized notesMd with ZodError', async () => {
			const oversizedNotes = 'n'.repeat(GOAL_NOTES_MAX_LENGTH + 1);
			await expect(
				createGoal({ userId: TEST_USER_ID, title: 'oversized notes', notesMd: oversizedNotes, isPrimary: false }),
			).rejects.toThrow(z.ZodError);
		});

		it('rejects a malformed targetDate with ZodError', async () => {
			await expect(
				createGoal({
					userId: TEST_USER_ID,
					title: 'bad date',
					notesMd: '',
					isPrimary: false,
					targetDate: 'not-a-date',
				}),
			).rejects.toThrow(z.ZodError);
		});
	});

	describe('updateGoal', () => {
		it('round-trips a valid partial update', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'pre-update',
				notesMd: '',
				isPrimary: false,
			});
			const updated = await updateGoal(g.id, TEST_USER_ID, { notesMd: 'updated notes' });
			expect(updated.notesMd).toBe('updated notes');
			expect(updated.title).toBe('pre-update');
		});

		it('rejects an oversized title with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'pre-update oversized',
				notesMd: '',
				isPrimary: false,
			});
			const oversized = 'x'.repeat(GOAL_TITLE_MAX_LENGTH + 1);
			await expect(updateGoal(g.id, TEST_USER_ID, { title: oversized })).rejects.toThrow(z.ZodError);
			// Symmetric post-condition: prior title preserved (no partial write).
			const refreshed = await getGoalById(g.id);
			expect(refreshed.title).toBe('pre-update oversized');
		});

		it('rejects an oversized notesMd with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'pre-update notes',
				notesMd: 'before',
				isPrimary: false,
			});
			const oversizedNotes = 'n'.repeat(GOAL_NOTES_MAX_LENGTH + 1);
			await expect(updateGoal(g.id, TEST_USER_ID, { notesMd: oversizedNotes })).rejects.toThrow(z.ZodError);
			const refreshed = await getGoalById(g.id);
			expect(refreshed.notesMd).toBe('before');
		});

		it('rejects an unknown status enum with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'pre-update status',
				notesMd: '',
				isPrimary: false,
			});
			await expect(
				updateGoal(g.id, TEST_USER_ID, {
					status: 'not-a-real-status' as unknown as (typeof GOAL_STATUSES)[keyof typeof GOAL_STATUSES],
				}),
			).rejects.toThrow(z.ZodError);
		});
	});

	describe('addGoalSyllabus', () => {
		it('round-trips a valid input', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'syllabus valid',
				notesMd: '',
				isPrimary: false,
			});
			const row = await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: PPL_SYL_ID, weight: 0.5 });
			expect(row.weight).toBeCloseTo(0.5);
		});

		it('rejects a weight above the GOAL_SYLLABUS_WEIGHT bound with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'syllabus over weight',
				notesMd: '',
				isPrimary: false,
			});
			await expect(
				addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: PPL_SYL_ID, weight: GOAL_SYLLABUS_WEIGHT_MAX + 1 }),
			).rejects.toThrow(z.ZodError);
			// Symmetric post-condition: no syllabus link landed.
			const rows = await getGoalSyllabi(g.id);
			expect(rows.length).toBe(0);
		});

		it('rejects a weight below the GOAL_SYLLABUS_WEIGHT bound with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'syllabus neg weight',
				notesMd: '',
				isPrimary: false,
			});
			await expect(
				addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: PPL_SYL_ID, weight: GOAL_SYLLABUS_WEIGHT_MIN - 0.1 }),
			).rejects.toThrow(z.ZodError);
		});

		it('rejects an empty syllabusId with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'syllabus empty id',
				notesMd: '',
				isPrimary: false,
			});
			await expect(addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: '', weight: 1.0 })).rejects.toThrow(z.ZodError);
		});
	});

	describe('addGoalNode', () => {
		it('round-trips a valid input', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'node valid',
				notesMd: '',
				isPrimary: false,
			});
			const row = await addGoalNode(g.id, TEST_USER_ID, {
				knowledgeNodeId: ADHOC_NODE_ID,
				weight: 0.75,
				notes: 'short',
			});
			expect(row.weight).toBeCloseTo(0.75);
			expect(row.notes).toBe('short');
		});

		it('rejects a weight above the GOAL_SYLLABUS_WEIGHT bound with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'node over weight',
				notesMd: '',
				isPrimary: false,
			});
			await expect(
				addGoalNode(g.id, TEST_USER_ID, {
					knowledgeNodeId: ADHOC_NODE_ID,
					weight: GOAL_SYLLABUS_WEIGHT_MAX + 1,
					notes: '',
				}),
			).rejects.toThrow(z.ZodError);
			const rows = await getGoalNodes(g.id);
			expect(rows.length).toBe(0);
		});

		it('rejects oversized notes with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'node oversized notes',
				notesMd: '',
				isPrimary: false,
			});
			const oversizedNotes = 'n'.repeat(GOAL_NODE_NOTES_MAX_LENGTH + 1);
			await expect(
				addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: ADHOC_NODE_ID, weight: 1.0, notes: oversizedNotes }),
			).rejects.toThrow(z.ZodError);
		});

		it('rejects an empty knowledgeNodeId with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'node empty id',
				notesMd: '',
				isPrimary: false,
			});
			await expect(addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: '', weight: 1.0, notes: '' })).rejects.toThrow(
				z.ZodError,
			);
		});
	});

	describe('setGoalFocusDomains / setGoalSkipDomains / setGoalSkipNodes', () => {
		it('round-trips a valid focus-domain list', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'focus valid',
				notesMd: '',
				isPrimary: false,
			});
			await setGoalFocusDomains(g.id, TEST_USER_ID, ['aerodynamics', 'airspace']);
			const refreshed = await getGoalById(g.id);
			expect(refreshed.focusDomains.sort()).toEqual(['aerodynamics', 'airspace']);
		});

		it('rejects an unknown domain slug on focus-domains with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'focus bad slug',
				notesMd: '',
				isPrimary: false,
			});
			await expect(
				setGoalFocusDomains(g.id, TEST_USER_ID, ['aerodynamics', 'not-a-real-domain' as unknown as 'aerodynamics']),
			).rejects.toThrow(z.ZodError);
			// Symmetric post-condition: focus list unchanged (still empty).
			const refreshed = await getGoalById(g.id);
			expect(refreshed.focusDomains).toEqual([]);
		});

		it('rejects an unknown domain slug on skip-domains with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'skip bad slug',
				notesMd: '',
				isPrimary: false,
			});
			await expect(
				setGoalSkipDomains(g.id, TEST_USER_ID, ['not-a-real-domain' as unknown as 'aerodynamics']),
			).rejects.toThrow(z.ZodError);
		});

		it('rejects an empty-string node id on skip-nodes with ZodError', async () => {
			const g = await createGoal({
				userId: TEST_USER_ID,
				title: 'skip empty node',
				notesMd: '',
				isPrimary: false,
			});
			await expect(setGoalSkipNodes(g.id, TEST_USER_ID, [''])).rejects.toThrow(z.ZodError);
		});
	});

	describe('applyCertGoalsToPrimaryGoal', () => {
		it('rejects an oversized goalTitle option with ZodError', async () => {
			const oversized = 't'.repeat(GOAL_TITLE_MAX_LENGTH + 1);
			await expect(applyCertGoalsToPrimaryGoal(TEST_USER_ID, [], { goalTitle: oversized })).rejects.toThrow(z.ZodError);
		});

		it('rejects an unknown focusDomains option with ZodError', async () => {
			await expect(
				applyCertGoalsToPrimaryGoal(TEST_USER_ID, [], {
					focusDomains: ['not-a-real-domain' as unknown as 'aerodynamics'],
				}),
			).rejects.toThrow(z.ZodError);
		});
	});
});

/**
 * Wrap `db.transaction(cb)` so the SQL transaction rolls back after
 * `cb` resolves. If the BC under test ran any write outside its own
 * transaction, that write would survive the rollback and the
 * post-condition assertion would fail. The wrapper preserves the BC's
 * return value so the success-path code path still runs.
 */
function dbWithForcedRollback(realDb: typeof db): typeof db {
	return new Proxy(realDb, {
		get(target, prop, receiver) {
			if (prop === 'transaction') {
				return async <T>(cb: (tx: typeof db) => Promise<T>): Promise<T> => {
					let resolved: { value: T } | null = null;
					try {
						await target.transaction(async (tx) => {
							resolved = { value: await cb(tx as unknown as typeof db) };
							throw new ForcedRollback();
						});
					} catch (err) {
						if (!(err instanceof ForcedRollback)) throw err;
					}
					if (resolved === null) {
						throw new Error('forced-rollback wrapper never observed BC return');
					}
					return resolved.value;
				};
			}
			return Reflect.get(target, prop, receiver);
		},
	}) as typeof db;
}

class ForcedRollback extends Error {
	constructor() {
		super('forced-rollback');
		this.name = 'ForcedRollback';
	}
}
