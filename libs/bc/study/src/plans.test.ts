/**
 * Plan BC tests. Uses the live dev Postgres connection, creates a test user
 * for isolation, and cleans up via cascade on the bauthUser row in afterAll.
 */

import { bauthUser } from '@ab/auth/schema';
import { CERTS, DEPTH_PREFERENCES, DOMAINS, PLAN_STATUSES, SESSION_MODES } from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KnowledgeNodeNotFoundError } from './knowledge';
import {
	activatePlan,
	addSkipDomain,
	addSkipNode,
	archivePlan,
	createPlan,
	getActivePlan,
	getPlan,
	getPlans,
	NoActivePlanError,
	PlanNotFoundError,
	removeSkipNode,
	updatePlan,
} from './plans';
import { knowledgeNode } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `plans-test-${TEST_USER_ID}@airboss.test`;

// Test-only knowledge node used by the skip-list mutation suite. addSkipNode
// now validates the id against the graph, so the test must seed a real row.
// Slug is unique to this test run so it cleans up cleanly without colliding
// with any authored node.
const TEST_NODE_ID = `plans-test-node-${TEST_USER_ID}`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Plans Test',
		firstName: 'Plans',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(knowledgeNode).values({
		id: TEST_NODE_ID,
		title: 'Plans Test Node',
		domain: 'airspace',
		contentMd: '# plans test node',
	});
});

afterAll(async () => {
	await db.delete(knowledgeNode).where(eq(knowledgeNode.id, TEST_NODE_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('createPlan', () => {
	it('creates an active plan with defaults filled in', async () => {
		const p = await createPlan({
			userId: TEST_USER_ID,
			certGoals: [CERTS.PPL, CERTS.IR],
		});
		expect(p.status).toBe(PLAN_STATUSES.ACTIVE);
		expect(p.certGoals).toEqual([CERTS.PPL, CERTS.IR]);
		expect(p.defaultMode).toBe(SESSION_MODES.MIXED);
		expect(p.depthPreference).toBe(DEPTH_PREFERENCES.WORKING);
		expect(p.sessionLength).toBeGreaterThanOrEqual(3);
		// Cleanup after each assertion block via archive so subsequent test
		// cases can create their own active plan.
		await archivePlan(p.id, TEST_USER_ID);
	});

	it('second create archives the first', async () => {
		const first = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.PPL] });
		const second = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.CFI] });
		expect(second.status).toBe(PLAN_STATUSES.ACTIVE);
		const firstRefetched = await getPlan(first.id, TEST_USER_ID);
		expect(firstRefetched?.status).toBe(PLAN_STATUSES.ARCHIVED);
		await archivePlan(second.id, TEST_USER_ID);
	});

	it('accepts an empty cert_goals array (cert-agnostic plan)', async () => {
		const p = await createPlan({ userId: TEST_USER_ID, certGoals: [] });
		expect(p.status).toBe(PLAN_STATUSES.ACTIVE);
		expect(p.certGoals).toEqual([]);
		await archivePlan(p.id, TEST_USER_ID);
	});

	it('creates a cert-agnostic plan with focus domains', async () => {
		const p = await createPlan({
			userId: TEST_USER_ID,
			certGoals: [],
			focusDomains: [DOMAINS.WEATHER],
		});
		expect(p.certGoals).toEqual([]);
		expect(p.focusDomains).toEqual([DOMAINS.WEATHER]);
		await archivePlan(p.id, TEST_USER_ID);
	});
});

describe('getActivePlan', () => {
	it('returns null when the user has no active plan', async () => {
		const p = await getActivePlan(TEST_USER_ID);
		expect(p).toBeNull();
	});
});

describe('updatePlan', () => {
	it('patches focus_domains in place', async () => {
		const p = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.PPL] });
		const updated = await updatePlan(p.id, TEST_USER_ID, { focusDomains: [DOMAINS.WEATHER] });
		expect(updated.focusDomains).toEqual([DOMAINS.WEATHER]);
		await archivePlan(p.id, TEST_USER_ID);
	});

	it('rejects overlapping focus and skip', async () => {
		const p = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.PPL], focusDomains: [DOMAINS.WEATHER] });
		await expect(updatePlan(p.id, TEST_USER_ID, { skipDomains: [DOMAINS.WEATHER] })).rejects.toThrow();
		await archivePlan(p.id, TEST_USER_ID);
	});

	it('throws PlanNotFoundError on unknown id', async () => {
		await expect(updatePlan('plan_missing', TEST_USER_ID, { sessionLength: 10 })).rejects.toBeInstanceOf(
			PlanNotFoundError,
		);
	});
});

describe('skip-list mutations', () => {
	it('addSkipNode is idempotent', async () => {
		const p = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.PPL] });
		const a = await addSkipNode(p.id, TEST_USER_ID, TEST_NODE_ID);
		const b = await addSkipNode(p.id, TEST_USER_ID, TEST_NODE_ID);
		expect(a.skipNodes).toEqual([TEST_NODE_ID]);
		expect(b.skipNodes).toEqual([TEST_NODE_ID]);
		await archivePlan(p.id, TEST_USER_ID);
	});

	it('addSkipNode rejects unknown node ids', async () => {
		const p = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.PPL] });
		await expect(addSkipNode(p.id, TEST_USER_ID, 'does-not-exist-in-graph')).rejects.toBeInstanceOf(
			KnowledgeNodeNotFoundError,
		);
		await archivePlan(p.id, TEST_USER_ID);
	});

	it('addSkipDomain drops the domain from focus_domains if present', async () => {
		const p = await createPlan({
			userId: TEST_USER_ID,
			certGoals: [CERTS.PPL],
			focusDomains: [DOMAINS.WEATHER, DOMAINS.REGULATIONS],
		});
		const updated = await addSkipDomain(p.id, TEST_USER_ID, DOMAINS.WEATHER);
		expect(updated.skipDomains).toEqual([DOMAINS.WEATHER]);
		expect(updated.focusDomains).toEqual([DOMAINS.REGULATIONS]);
		await archivePlan(p.id, TEST_USER_ID);
	});

	it('removeSkipNode removes the requested id', async () => {
		const p = await createPlan({
			userId: TEST_USER_ID,
			certGoals: [CERTS.PPL],
			skipNodes: ['a', 'b', 'c'],
		});
		const updated = await removeSkipNode(p.id, TEST_USER_ID, 'b');
		expect(updated.skipNodes).toEqual(['a', 'c']);
		await archivePlan(p.id, TEST_USER_ID);
	});
});

describe('archivePlan + activatePlan', () => {
	it('archive removes active status; activate restores it', async () => {
		const p = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.PPL] });
		const archived = await archivePlan(p.id, TEST_USER_ID);
		expect(archived.status).toBe(PLAN_STATUSES.ARCHIVED);
		expect(await getActivePlan(TEST_USER_ID)).toBeNull();

		const re = await activatePlan(p.id, TEST_USER_ID);
		expect(re.status).toBe(PLAN_STATUSES.ACTIVE);
		await archivePlan(p.id, TEST_USER_ID);
	});

	it('activate archives other active plans', async () => {
		const first = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.PPL] });
		await archivePlan(first.id, TEST_USER_ID);
		const second = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.CFI] });
		// Activating the first archives the second.
		await activatePlan(first.id, TEST_USER_ID);
		const activeNow = await getActivePlan(TEST_USER_ID);
		expect(activeNow?.id).toBe(first.id);
		const refetchedSecond = await getPlan(second.id, TEST_USER_ID);
		expect(refetchedSecond?.status).toBe(PLAN_STATUSES.ARCHIVED);
		await archivePlan(first.id, TEST_USER_ID);
	});
});

describe('getPlans', () => {
	it('lists all plans regardless of status', async () => {
		const p1 = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.PPL] });
		await archivePlan(p1.id, TEST_USER_ID);
		const p2 = await createPlan({ userId: TEST_USER_ID, certGoals: [CERTS.IR] });
		const plans = await getPlans(TEST_USER_ID);
		const ids = plans.map((p) => p.id);
		expect(ids).toContain(p1.id);
		expect(ids).toContain(p2.id);
		await archivePlan(p2.id, TEST_USER_ID);
	});
});

// NoActivePlanError is defined but not thrown by the plan BC directly; it's
// thrown by the session BC when the session engine has nothing to run. Kept
// here as a sanity import so a future rename doesn't silently drop it.
describe('error classes exist', () => {
	it('imports NoActivePlanError', () => {
		expect(NoActivePlanError).toBeDefined();
	});
});
