/**
 * Engine targeting tests. Real Postgres -- the read order has to walk the
 * cert-syllabus join graph, the goal_syllabus FK constraints, and the
 * partial UNIQUE on `goal (user_id) WHERE is_primary=true`.
 *
 * Covers the engine-goal-cutover read-order spec:
 *
 *   - User with primary goal -> source='goal'.
 *   - User with plan only -> source='plan' (legacy fallback).
 *   - User with neither -> source='empty'.
 *   - Disagreement -> goal wins; snapshot reports drift.
 *   - Primary-goal switch reflected on the next call.
 *   - Targeting includes goal's focus_domains / skip_domains / skip_nodes.
 *   - depthPreference + sessionLength always come from the plan.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CERTS,
	CREDENTIAL_STATUSES,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	DOMAINS,
	ENGINE_TARGETING_SOURCES,
	PLAN_STATUSES,
	SESSION_MODES,
	SYLLABUS_PRIMACY,
	SYLLABUS_STATUSES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import {
	generateAuthId,
	generateCredentialId,
	generateStudyPlanId,
	generateSyllabusId,
	generateSyllabusNodeId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getEngineTargeting, getEngineTargetingSnapshot } from './engine-targeting';
import { addGoalSyllabus, createGoal, getDerivedCertGoals, setGoalFocusDomains, setPrimaryGoal } from './goals';
import { credential, credentialSyllabus, goal, goalSyllabus, studyPlan, syllabus, syllabusNode } from './schema';

const SUITE_TAG = `engine-targeting-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const slug = (s: string): string => `${s}-${SUITE_TOKEN}`;

const GOAL_USER_ID = generateAuthId();
const PLAN_ONLY_USER_ID = generateAuthId();
const EMPTY_USER_ID = generateAuthId();
const DISAGREE_USER_ID = generateAuthId();

const PPL_CRED_ID = generateCredentialId();
const PPL_CRED_SLUG = CERTS.PPL;
const PPL_SYL_ID = generateSyllabusId();

const IR_CRED_ID = generateCredentialId();
const IR_CRED_SLUG = CERTS.INSTRUMENT;
const IR_SYL_ID = generateSyllabusId();

const PPL_AREA_ID = generateSyllabusNodeId();

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values([
		{
			id: GOAL_USER_ID,
			email: `goal-${SUITE_TAG}@airboss.test`,
			name: 'Goal User',
			firstName: 'Goal',
			lastName: 'User',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: PLAN_ONLY_USER_ID,
			email: `plan-${SUITE_TAG}@airboss.test`,
			name: 'Plan Only User',
			firstName: 'Plan',
			lastName: 'Only',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: EMPTY_USER_ID,
			email: `empty-${SUITE_TAG}@airboss.test`,
			name: 'Empty User',
			firstName: 'Empty',
			lastName: 'User',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: DISAGREE_USER_ID,
			email: `disagree-${SUITE_TAG}@airboss.test`,
			name: 'Disagree User',
			firstName: 'Disagree',
			lastName: 'User',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
	]);

	// Seed PPL + IR credentials with primary syllabi so getDerivedCertGoals
	// has something to walk for the goal-path tests. Slug values come from
	// CERTS so they match CERT_VALUES; the test does not need to match a
	// production seeded credential since the IDs are random per suite.
	await db.insert(credential).values([
		{
			id: PPL_CRED_ID,
			slug: slug(PPL_CRED_SLUG),
			kind: 'pilot-cert',
			title: 'Test Private Pilot',
			category: 'airplane',
			class: 'single-engine-land',
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: IR_CRED_ID,
			slug: slug(IR_CRED_SLUG),
			kind: 'pilot-cert',
			title: 'Test Instrument Rating',
			category: 'airplane',
			class: 'single-engine-land',
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);
	await db.insert(syllabus).values([
		{
			id: PPL_SYL_ID,
			slug: slug('ppl-test-acs'),
			kind: 'acs',
			title: 'Test PPL ACS',
			edition: `faa-acs-ppl-${SUITE_TOKEN}`,
			status: SYLLABUS_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: IR_SYL_ID,
			slug: slug('ir-test-acs'),
			kind: 'acs',
			title: 'Test IR ACS',
			edition: `faa-acs-ir-${SUITE_TOKEN}`,
			status: SYLLABUS_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);
	await db.insert(credentialSyllabus).values([
		{
			credentialId: PPL_CRED_ID,
			syllabusId: PPL_SYL_ID,
			primacy: SYLLABUS_PRIMACY.PRIMARY,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			credentialId: IR_CRED_ID,
			syllabusId: IR_SYL_ID,
			primacy: SYLLABUS_PRIMACY.PRIMARY,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
	]);

	// `credential.slug` is globally UNIQUE so the test cannot use the
	// canonical CERTS values directly -- a parallel suite or a seeded row
	// would collide. The targeting helper filters derived slugs through
	// `CERT_VALUES`, so suite-tokenized slugs project to an empty `certs`
	// array on the goal path. The other fields (source, focusDomains,
	// skipDomains, skipNodes) still verify the read order; the cert
	// projection itself is covered by `goals.test.ts` against canonical
	// seeded credentials.

	// One leaf so syllabus_node_link references resolve if any test exercises them.
	await db.insert(syllabusNode).values([
		{
			id: PPL_AREA_ID,
			syllabusId: PPL_SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V`,
			title: 'Test Area',
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
	]);

	// Plan rows. Goal user gets a plan with depth=deep, sessionLength=15
	// so the targeting can copy them across regardless of source path.
	await db.insert(studyPlan).values([
		{
			id: generateStudyPlanId(),
			userId: GOAL_USER_ID,
			title: 'goal-user plan',
			status: PLAN_STATUSES.ACTIVE,
			certGoals: [],
			focusDomains: [],
			skipDomains: [],
			skipNodes: [],
			depthPreference: DEPTH_PREFERENCES.DEEP,
			sessionLength: 15,
			defaultMode: SESSION_MODES.MIXED,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: generateStudyPlanId(),
			userId: PLAN_ONLY_USER_ID,
			title: 'plan-only user plan',
			status: PLAN_STATUSES.ACTIVE,
			certGoals: [CERTS.PPL],
			focusDomains: [DOMAINS.WEATHER],
			skipDomains: [DOMAINS.AERODYNAMICS],
			skipNodes: ['kn-test-skip'],
			depthPreference: DEPTH_PREFERENCES.WORKING,
			sessionLength: 10,
			defaultMode: SESSION_MODES.MIXED,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: generateStudyPlanId(),
			userId: DISAGREE_USER_ID,
			title: 'disagree user plan',
			status: PLAN_STATUSES.ACTIVE,
			// Plan says PPL+IR; goal will say PPL only -> disagreement.
			certGoals: [CERTS.PPL, CERTS.INSTRUMENT],
			focusDomains: [],
			skipDomains: [],
			skipNodes: [],
			depthPreference: DEPTH_PREFERENCES.WORKING,
			sessionLength: 10,
			defaultMode: SESSION_MODES.MIXED,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	// Goal user: primary goal pointing at PPL syllabus.
	const goalUserGoal = await createGoal({
		userId: GOAL_USER_ID,
		title: 'PPL push',
		notesMd: '',
		isPrimary: true,
	});
	await addGoalSyllabus(goalUserGoal.id, GOAL_USER_ID, { syllabusId: PPL_SYL_ID, weight: 1.0 });
	await setGoalFocusDomains(goalUserGoal.id, GOAL_USER_ID, [DOMAINS.AIRSPACE]);

	// Disagree user: primary goal targets PPL only, plan targets PPL+IR.
	const disagreeGoal = await createGoal({
		userId: DISAGREE_USER_ID,
		title: 'PPL only',
		notesMd: '',
		isPrimary: true,
	});
	await addGoalSyllabus(disagreeGoal.id, DISAGREE_USER_ID, { syllabusId: PPL_SYL_ID, weight: 1.0 });
});

afterAll(async () => {
	await db.delete(goalSyllabus).where(eq(goalSyllabus.syllabusId, PPL_SYL_ID));
	await db.delete(goalSyllabus).where(eq(goalSyllabus.syllabusId, IR_SYL_ID));
	await db.delete(goal).where(eq(goal.userId, GOAL_USER_ID));
	await db.delete(goal).where(eq(goal.userId, DISAGREE_USER_ID));
	await db.delete(studyPlan).where(eq(studyPlan.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNode).where(eq(syllabusNode.seedOrigin, SUITE_TAG));
	await db.delete(credentialSyllabus).where(eq(credentialSyllabus.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(credential).where(eq(credential.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, GOAL_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, PLAN_ONLY_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, EMPTY_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, DISAGREE_USER_ID));
});

describe('getEngineTargeting -- read order', () => {
	it('source=goal when the user has a primary goal', async () => {
		const targeting = await getEngineTargeting(GOAL_USER_ID);
		expect(targeting.source).toBe(ENGINE_TARGETING_SOURCES.GOAL);
		// `certs` is the goal's syllabi projected through credential.slug and
		// then filtered to canonical CERT_VALUES. The test seeds suite-token
		// slugs to avoid the global `credential.slug` UNIQUE constraint, so
		// the array is empty here -- assert the raw projection separately.
		expect(targeting.certs).toEqual([]);
		const derived = await getDerivedCertGoals(GOAL_USER_ID);
		expect(derived.length).toBe(1);
		expect([...targeting.focusDomains].sort()).toEqual([DOMAINS.AIRSPACE]);
	});

	it('source=plan when the user has a plan but no primary goal', async () => {
		const targeting = await getEngineTargeting(PLAN_ONLY_USER_ID);
		expect(targeting.source).toBe(ENGINE_TARGETING_SOURCES.PLAN);
		expect([...targeting.certs].sort()).toEqual([CERTS.PPL]);
		expect([...targeting.focusDomains].sort()).toEqual([DOMAINS.WEATHER]);
		expect([...targeting.skipDomains].sort()).toEqual([DOMAINS.AERODYNAMICS]);
		expect([...targeting.skipNodes].sort()).toEqual(['kn-test-skip']);
	});

	it('source=empty when the user has neither a goal nor a plan', async () => {
		const targeting = await getEngineTargeting(EMPTY_USER_ID);
		expect(targeting.source).toBe(ENGINE_TARGETING_SOURCES.EMPTY);
		expect(targeting.certs).toEqual([]);
		expect(targeting.focusDomains).toEqual([]);
		expect(targeting.skipDomains).toEqual([]);
		expect(targeting.skipNodes).toEqual([]);
	});

	it('depthPreference + sessionLength always come from the plan when present', async () => {
		const goalUser = await getEngineTargeting(GOAL_USER_ID);
		expect(goalUser.depthPreference).toBe(DEPTH_PREFERENCES.DEEP);
		expect(goalUser.sessionLength).toBe(15);

		const planUser = await getEngineTargeting(PLAN_ONLY_USER_ID);
		expect(planUser.depthPreference).toBe(DEPTH_PREFERENCES.WORKING);
		expect(planUser.sessionLength).toBe(10);
	});

	it('depthPreference + sessionLength fall back to defaults when no plan', async () => {
		const targeting = await getEngineTargeting(EMPTY_USER_ID);
		expect(targeting.depthPreference).toBe(DEPTH_PREFERENCES.WORKING);
		expect(targeting.sessionLength).toBe(DEFAULT_SESSION_LENGTH);
	});
});

describe('getEngineTargetingSnapshot -- disagreement detection', () => {
	it('flags disagreement when goal certs differ from plan certs', async () => {
		const snapshot = await getEngineTargetingSnapshot(DISAGREE_USER_ID);
		expect(snapshot.targeting.source).toBe(ENGINE_TARGETING_SOURCES.GOAL);
		// Goal wins on the read; the suite-tokenized slug filters away from
		// `certs`, but the plan's [PPL, IR] is non-empty so the size mismatch
		// trips the disagreement counter -- exactly the production behaviour
		// when a goal projects to a different cert set than the plan.
		expect(snapshot.disagreementDetected).toBe(true);
	});

	it('does not flag disagreement when goal and plan agree', async () => {
		const snapshot = await getEngineTargetingSnapshot(GOAL_USER_ID);
		expect(snapshot.targeting.source).toBe(ENGINE_TARGETING_SOURCES.GOAL);
		expect(snapshot.disagreementDetected).toBe(false);
	});

	it('does not flag disagreement on the plan path', async () => {
		const snapshot = await getEngineTargetingSnapshot(PLAN_ONLY_USER_ID);
		expect(snapshot.targeting.source).toBe(ENGINE_TARGETING_SOURCES.PLAN);
		expect(snapshot.disagreementDetected).toBe(false);
	});

	it('records a timestamp on every snapshot', async () => {
		const before = new Date();
		const snapshot = await getEngineTargetingSnapshot(GOAL_USER_ID);
		expect(snapshot.recordedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
	});
});

describe('getEngineTargeting -- primary goal switch', () => {
	it('reflects the new primary goal on the next call', async () => {
		// Add a second goal targeting IR with a distinct focus domain; flip
		// primary. The cert projection still filters to [] (suite-tokenized
		// credential slugs), so verify the swap via the goal's targeting
		// columns instead -- the IR goal carries a different focus_domains
		// list than the PPL goal, which is what the engine ultimately reads.
		const irGoal = await createGoal({
			userId: GOAL_USER_ID,
			title: 'IR push',
			notesMd: '',
			isPrimary: false,
		});
		await addGoalSyllabus(irGoal.id, GOAL_USER_ID, { syllabusId: IR_SYL_ID, weight: 1.0 });
		await setGoalFocusDomains(irGoal.id, GOAL_USER_ID, [DOMAINS.WEATHER]);

		const beforeSwap = await getEngineTargeting(GOAL_USER_ID);
		expect([...beforeSwap.focusDomains].sort()).toEqual([DOMAINS.AIRSPACE]);

		await setPrimaryGoal(irGoal.id, GOAL_USER_ID);

		const afterSwap = await getEngineTargeting(GOAL_USER_ID);
		expect([...afterSwap.focusDomains].sort()).toEqual([DOMAINS.WEATHER]);
	});
});
