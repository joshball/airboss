/**
 * Knowledge node phase-progress BC tests.
 *
 * Exercises getNodeProgress / recordPhaseVisited / recordPhaseCompleted against
 * the real DB. Progress is a per-user per-node row with two string[] columns
 * (visited + completed) and a `lastPhase` pointer. The functions must be
 * idempotent on repeated calls for the same phase.
 *
 * Every `it` block uses its own node id (allocated via `freshNodeId`) so
 * progress writes from one test never feed into another. The shared test
 * user persists for the suite (cheap to seed once) but every progress row
 * is keyed by both user and node, and the node id is unique per test, so
 * there is no cross-test state leakage on `knowledge_node_progress`.
 */

import { bauthUser } from '@ab/auth/schema';
import { DOMAINS, KNOWLEDGE_PHASES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { createId, generateAuthId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getNodeProgress, recordPhaseCompleted, recordPhaseVisited } from './knowledge';
import { knowledgeNode, knowledgeNodeProgress } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `progress-test-${TEST_USER_ID}@example.com`;

// Track every node id we mint so afterAll can clean them up. Each test
// allocates its own id via `freshNodeId` to keep progress writes scoped.
const seededNodeIds: string[] = [];

async function freshNodeId(label: string): Promise<string> {
	const id = `progress-test-${label}-${createId('x').slice(0, 8)}`;
	const now = new Date();
	await db.insert(knowledgeNode).values({
		id,
		title: `Progress ${id}`,
		domain: DOMAINS.AIRSPACE,
		crossDomains: [],
		knowledgeTypes: ['factual'],
		technicalDepth: null,
		stability: null,
		minimumCert: null,
		studyPriority: null,
		modalities: [],
		estimatedTimeMinutes: null,
		reviewTimeMinutes: null,
		references: [],
		assessable: true,
		assessmentMethods: [],
		masteryCriteria: null,
		contentMd: '',
		createdAt: now,
		updatedAt: now,
	});
	seededNodeIds.push(id);
	return id;
}

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Progress Test',
		firstName: 'Progress',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	await db.delete(knowledgeNodeProgress).where(eq(knowledgeNodeProgress.userId, TEST_USER_ID));
	if (seededNodeIds.length > 0) {
		await db.delete(knowledgeNode).where(inArray(knowledgeNode.id, seededNodeIds));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('getNodeProgress', () => {
	it('returns an empty snapshot when the user has never visited a node', async () => {
		const nodeId = await freshNodeId('get-empty');
		const progress = await getNodeProgress(TEST_USER_ID, nodeId);
		expect(progress.visitedPhases).toEqual([]);
		expect(progress.completedPhases).toEqual([]);
		expect(progress.lastPhase).toBeNull();
	});
});

describe('recordPhaseVisited', () => {
	it('inserts a new row with the phase in visited + lastPhase', async () => {
		const nodeId = await freshNodeId('visit-insert');
		await recordPhaseVisited(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.CONTEXT);
		const progress = await getNodeProgress(TEST_USER_ID, nodeId);
		expect(progress.visitedPhases).toEqual([KNOWLEDGE_PHASES.CONTEXT]);
		expect(progress.completedPhases).toEqual([]);
		expect(progress.lastPhase).toBe(KNOWLEDGE_PHASES.CONTEXT);
	});

	it('appends to visitedPhases without duplicating on repeat visits', async () => {
		const nodeId = await freshNodeId('visit-dedupe');
		// Seed an initial CONTEXT visit so we can prove later writes append
		// (rather than overwrite) and that duplicates collapse.
		await recordPhaseVisited(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.CONTEXT);
		await recordPhaseVisited(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.PROBLEM);
		await recordPhaseVisited(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.PROBLEM);

		const progress = await getNodeProgress(TEST_USER_ID, nodeId);
		const problemOccurrences = progress.visitedPhases.filter((p) => p === KNOWLEDGE_PHASES.PROBLEM).length;
		expect(problemOccurrences).toBe(1);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.CONTEXT);
		expect(progress.lastPhase).toBe(KNOWLEDGE_PHASES.PROBLEM);
	});

	it('updates lastPhase to reflect the most recent visit', async () => {
		const nodeId = await freshNodeId('visit-last');
		// Walk CONTEXT -> PROBLEM -> DISCOVER and assert all three remain in
		// visitedPhases while lastPhase tracks the tail.
		await recordPhaseVisited(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.CONTEXT);
		await recordPhaseVisited(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.PROBLEM);
		await recordPhaseVisited(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.DISCOVER);

		const progress = await getNodeProgress(TEST_USER_ID, nodeId);
		expect(progress.lastPhase).toBe(KNOWLEDGE_PHASES.DISCOVER);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.CONTEXT);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.PROBLEM);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.DISCOVER);
	});
});

describe('recordPhaseCompleted', () => {
	it('inserts with both visited + completed + lastPhase set when no row exists', async () => {
		const nodeId = await freshNodeId('complete-insert');
		await recordPhaseCompleted(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.CONTEXT);
		const progress = await getNodeProgress(TEST_USER_ID, nodeId);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.CONTEXT);
		expect(progress.completedPhases).toContain(KNOWLEDGE_PHASES.CONTEXT);
		expect(progress.lastPhase).toBe(KNOWLEDGE_PHASES.CONTEXT);
	});

	it('dedupes completedPhases on repeat completions', async () => {
		const nodeId = await freshNodeId('complete-dedupe');
		await recordPhaseCompleted(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.PROBLEM);
		await recordPhaseCompleted(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.PROBLEM);
		const progress = await getNodeProgress(TEST_USER_ID, nodeId);
		const completions = progress.completedPhases.filter((p) => p === KNOWLEDGE_PHASES.PROBLEM).length;
		expect(completions).toBe(1);
	});

	it('visited + completed together survive mixed operations', async () => {
		const nodeId = await freshNodeId('complete-mixed');
		// Visit REVEAL without completing; complete DISCOVER.
		await recordPhaseVisited(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.REVEAL);
		await recordPhaseCompleted(TEST_USER_ID, nodeId, KNOWLEDGE_PHASES.DISCOVER);

		const progress = await getNodeProgress(TEST_USER_ID, nodeId);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.REVEAL);
		expect(progress.completedPhases).not.toContain(KNOWLEDGE_PHASES.REVEAL);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.DISCOVER);
		expect(progress.completedPhases).toContain(KNOWLEDGE_PHASES.DISCOVER);
	});
});
