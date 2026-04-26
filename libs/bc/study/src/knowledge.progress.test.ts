/**
 * Knowledge node phase-progress BC tests.
 *
 * Exercises getNodeProgress / recordPhaseVisited / recordPhaseCompleted against
 * the real DB. Progress is a per-user per-node row with two string[] columns
 * (visited + completed) and a `lastPhase` pointer. The functions must be
 * idempotent on repeated calls for the same phase.
 */

import { bauthUser } from '@ab/auth/schema';
import { DOMAINS, KNOWLEDGE_PHASES } from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getNodeProgress, recordPhaseCompleted, recordPhaseVisited } from './knowledge';
import { knowledgeNode, knowledgeNodeProgress } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `progress-test-${TEST_USER_ID}@example.com`;
const NODE_A = 'progress-test-node-a';
const NODE_B = 'progress-test-node-b';

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
	for (const id of [NODE_A, NODE_B]) {
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
	}
});

afterAll(async () => {
	await db.delete(knowledgeNodeProgress).where(eq(knowledgeNodeProgress.userId, TEST_USER_ID));
	for (const id of [NODE_A, NODE_B]) {
		await db.delete(knowledgeNode).where(eq(knowledgeNode.id, id));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('getNodeProgress', () => {
	it('returns an empty snapshot when the user has never visited a node', async () => {
		const progress = await getNodeProgress(TEST_USER_ID, NODE_A);
		expect(progress.visitedPhases).toEqual([]);
		expect(progress.completedPhases).toEqual([]);
		expect(progress.lastPhase).toBeNull();
	});
});

describe('recordPhaseVisited', () => {
	it('inserts a new row with the phase in visited + lastPhase', async () => {
		await recordPhaseVisited(TEST_USER_ID, NODE_A, KNOWLEDGE_PHASES.CONTEXT);
		const progress = await getNodeProgress(TEST_USER_ID, NODE_A);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.CONTEXT);
		expect(progress.completedPhases).toEqual([]);
		expect(progress.lastPhase).toBe(KNOWLEDGE_PHASES.CONTEXT);
	});

	it('appends to visitedPhases without duplicating on repeat visits', async () => {
		await recordPhaseVisited(TEST_USER_ID, NODE_A, KNOWLEDGE_PHASES.PROBLEM);
		await recordPhaseVisited(TEST_USER_ID, NODE_A, KNOWLEDGE_PHASES.PROBLEM);
		const progress = await getNodeProgress(TEST_USER_ID, NODE_A);
		const problemOccurrences = progress.visitedPhases.filter((p) => p === KNOWLEDGE_PHASES.PROBLEM).length;
		expect(problemOccurrences).toBe(1);
		expect(progress.lastPhase).toBe(KNOWLEDGE_PHASES.PROBLEM);
	});

	it('updates lastPhase to reflect the most recent visit', async () => {
		await recordPhaseVisited(TEST_USER_ID, NODE_A, KNOWLEDGE_PHASES.DISCOVER);
		const progress = await getNodeProgress(TEST_USER_ID, NODE_A);
		expect(progress.lastPhase).toBe(KNOWLEDGE_PHASES.DISCOVER);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.CONTEXT);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.PROBLEM);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.DISCOVER);
	});
});

describe('recordPhaseCompleted', () => {
	it('inserts with both visited + completed + lastPhase set when no row exists', async () => {
		await recordPhaseCompleted(TEST_USER_ID, NODE_B, KNOWLEDGE_PHASES.CONTEXT);
		const progress = await getNodeProgress(TEST_USER_ID, NODE_B);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.CONTEXT);
		expect(progress.completedPhases).toContain(KNOWLEDGE_PHASES.CONTEXT);
		expect(progress.lastPhase).toBe(KNOWLEDGE_PHASES.CONTEXT);
	});

	it('dedupes completedPhases on repeat completions', async () => {
		await recordPhaseCompleted(TEST_USER_ID, NODE_B, KNOWLEDGE_PHASES.PROBLEM);
		await recordPhaseCompleted(TEST_USER_ID, NODE_B, KNOWLEDGE_PHASES.PROBLEM);
		const progress = await getNodeProgress(TEST_USER_ID, NODE_B);
		const completions = progress.completedPhases.filter((p) => p === KNOWLEDGE_PHASES.PROBLEM).length;
		expect(completions).toBe(1);
	});

	it('visited + completed together survive mixed operations', async () => {
		// Visit REVEAL without completing; complete DISCOVER.
		await recordPhaseVisited(TEST_USER_ID, NODE_B, KNOWLEDGE_PHASES.REVEAL);
		await recordPhaseCompleted(TEST_USER_ID, NODE_B, KNOWLEDGE_PHASES.DISCOVER);

		const progress = await getNodeProgress(TEST_USER_ID, NODE_B);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.REVEAL);
		expect(progress.completedPhases).not.toContain(KNOWLEDGE_PHASES.REVEAL);
		expect(progress.visitedPhases).toContain(KNOWLEDGE_PHASES.DISCOVER);
		expect(progress.completedPhases).toContain(KNOWLEDGE_PHASES.DISCOVER);
	});
});
