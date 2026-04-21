/**
 * Knowledge BC tests -- focused on the dual-gate mastery computation.
 *
 * Pure-helper suites (computeCardGate / computeRepGate / isMastered /
 * computeDisplayScore) cover the rule table exhaustively without a DB. The
 * integration suite writes a knowledge node, a handful of cards + scenarios,
 * and a few attempts, then exercises getNodeMastery against the real DB so
 * the SQL aggregations (in particular the `stability > threshold` mastered-
 * count and the per-node filter on card + scenario) are verified end-to-end.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CARD_MASTERY_RATIO_THRESHOLD,
	CARD_MIN,
	CARD_TYPES,
	CONTENT_SOURCES,
	DIFFICULTIES,
	DOMAINS,
	REP_ACCURACY_THRESHOLD,
	REP_MIN,
	STABILITY_MASTERED_DAYS,
} from '@ab/constants';
import { db } from '@ab/db';
import { createId, generateAuthId, generateRepAttemptId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCard } from './cards';
import {
	computeCardGate,
	computeDisplayScore,
	computeRepGate,
	getNodeMastery,
	isMastered,
	isNodeMastered,
} from './knowledge';
import { createScenario, submitAttempt } from './scenarios';
import { card, cardState, knowledgeNode, repAttempt, scenario } from './schema';

describe('computeCardGate', () => {
	it('not_applicable when no cards are attached', () => {
		expect(computeCardGate(0, 0)).toBe('not_applicable');
	});

	it('insufficient_data when below CARD_MIN but above zero', () => {
		expect(computeCardGate(1, 1)).toBe('insufficient_data');
		expect(computeCardGate(CARD_MIN - 1, 1)).toBe('insufficient_data');
	});

	it('pass at CARD_MIN with ratio >= threshold', () => {
		expect(computeCardGate(CARD_MIN, CARD_MASTERY_RATIO_THRESHOLD)).toBe('pass');
		expect(computeCardGate(CARD_MIN, 1)).toBe('pass');
	});

	it('fail at CARD_MIN when ratio is below threshold', () => {
		expect(computeCardGate(CARD_MIN, CARD_MASTERY_RATIO_THRESHOLD - 0.01)).toBe('fail');
		expect(computeCardGate(10, 0)).toBe('fail');
	});
});

describe('computeRepGate', () => {
	it('not_applicable when no scenarios are attached at all', () => {
		expect(computeRepGate(0, 0, 0)).toBe('not_applicable');
	});

	it('insufficient_data when scenarios exist but no attempts yet', () => {
		expect(computeRepGate(0, 0, 1)).toBe('insufficient_data');
	});

	it('insufficient_data when attempts are below REP_MIN', () => {
		expect(computeRepGate(REP_MIN - 1, 1, 5)).toBe('insufficient_data');
	});

	it('pass at REP_MIN with accuracy >= threshold', () => {
		expect(computeRepGate(REP_MIN, REP_ACCURACY_THRESHOLD, 5)).toBe('pass');
		expect(computeRepGate(100, 1, 10)).toBe('pass');
	});

	it('fail at REP_MIN when accuracy is below threshold', () => {
		expect(computeRepGate(REP_MIN, REP_ACCURACY_THRESHOLD - 0.01, 5)).toBe('fail');
		expect(computeRepGate(10, 0, 10)).toBe('fail');
	});
});

describe('isMastered', () => {
	it('true when both gates pass', () => {
		expect(isMastered('pass', 'pass')).toBe(true);
	});

	it('true when card gate passes and rep gate is not_applicable', () => {
		expect(isMastered('pass', 'not_applicable')).toBe(true);
	});

	it('true when rep gate passes and card gate is not_applicable', () => {
		expect(isMastered('not_applicable', 'pass')).toBe(true);
	});

	it('false when either gate fails', () => {
		expect(isMastered('fail', 'pass')).toBe(false);
		expect(isMastered('pass', 'fail')).toBe(false);
	});

	it('false when either gate is insufficient_data', () => {
		expect(isMastered('insufficient_data', 'pass')).toBe(false);
		expect(isMastered('pass', 'insufficient_data')).toBe(false);
	});

	it('false when both gates are not_applicable (empty node)', () => {
		// A node with nothing attached is never mastered -- per PRD "Nodes with
		// no attached content are never mastered".
		expect(isMastered('not_applicable', 'not_applicable')).toBe(false);
	});
});

describe('computeDisplayScore', () => {
	it('averages both pillars when both have data', () => {
		expect(computeDisplayScore(10, 0.6, 10, 0.8)).toBeCloseTo(0.7);
	});

	it('falls back to cards when only cards are present', () => {
		expect(computeDisplayScore(10, 0.75, 0, 0)).toBeCloseTo(0.75);
	});

	it('falls back to reps when only reps are present', () => {
		expect(computeDisplayScore(0, 0, 10, 0.5)).toBeCloseTo(0.5);
	});

	it('is 0 when nothing is attached', () => {
		expect(computeDisplayScore(0, 0, 0, 0)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Integration: exercises the SQL path end-to-end.
// ---------------------------------------------------------------------------

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `knowledge-test-${TEST_USER_ID}@airboss.test`;

// A couple of real graph nodes for the integration block. Slug-style ids so
// they don't collide with the ULID-prefixed scheme used elsewhere.
const NODE_BOTH = `test-kg-both-${createId('x').slice(0, 6)}`;
const NODE_CARDS_ONLY = `test-kg-cards-only-${createId('x').slice(0, 6)}`;
const NODE_REPS_ONLY = `test-kg-reps-only-${createId('x').slice(0, 6)}`;
const NODE_EMPTY = `test-kg-empty-${createId('x').slice(0, 6)}`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Knowledge Test',
		firstName: 'Knowledge',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	for (const id of [NODE_BOTH, NODE_CARDS_ONLY, NODE_REPS_ONLY, NODE_EMPTY]) {
		await db.insert(knowledgeNode).values({
			id,
			title: `Test Node ${id}`,
			domain: DOMAINS.AIRSPACE,
			crossDomains: [],
			knowledgeTypes: ['factual'],
			technicalDepth: null,
			stability: null,
			relevance: [],
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
	// Restrict delete orders: attempts -> scenarios, reviews (none created)
	// -> cards -> cardState auto-cascade, then nodes, then user. bauthUser
	// cascades to card/scenario on userId so the node removal is safe once
	// those are gone.
	await db.delete(repAttempt).where(eq(repAttempt.userId, TEST_USER_ID));
	await db.delete(scenario).where(eq(scenario.userId, TEST_USER_ID));
	await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
	await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	for (const id of [NODE_BOTH, NODE_CARDS_ONLY, NODE_REPS_ONLY, NODE_EMPTY]) {
		await db.delete(knowledgeNode).where(eq(knowledgeNode.id, id));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

/**
 * Force a card's FSRS stability to the given value by patching cardState
 * directly. Tests need to land on specific "mastered / not mastered" buckets
 * without waiting real calendar days for FSRS to promote them.
 */
async function seedCardStability(cardId: string, stability: number): Promise<void> {
	await db.update(cardState).set({ stability }).where(eq(cardState.cardId, cardId));
}

async function seedAttachedCards(nodeId: string, count: number, masteredCount: number): Promise<string[]> {
	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		const c = await createCard({
			userId: TEST_USER_ID,
			front: `Front ${nodeId}-${i}`,
			back: `Back ${nodeId}-${i}`,
			domain: DOMAINS.AIRSPACE,
			cardType: CARD_TYPES.BASIC,
			nodeId,
		});
		ids.push(c.id);
		const stability = i < masteredCount ? STABILITY_MASTERED_DAYS + 10 : 1;
		await seedCardStability(c.id, stability);
	}
	return ids;
}

async function seedAttachedRepsAndAttempts(nodeId: string, attemptCount: number, correctCount: number): Promise<void> {
	// One scenario, N attempts -- spec's rep gate only cares about attempt
	// totals and accuracy, so a single scenario + N attempts is enough.
	const sc = await createScenario({
		userId: TEST_USER_ID,
		title: `Test scenario ${nodeId}`,
		situation: 'Situation',
		options: [
			{ id: 'a', text: 'A', isCorrect: true, outcome: 'ok', whyNot: '' },
			{ id: 'b', text: 'B', isCorrect: false, outcome: 'bad', whyNot: 'wrong' },
		],
		teachingPoint: 'tp',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		sourceType: CONTENT_SOURCES.PERSONAL,
		nodeId,
	});

	// Insert directly, sidestepping submitAttempt's idempotency window.
	// The test spaces attempts by 1ms so each is a distinct row; the BC
	// dedupe fold is a production safeguard, not a model constraint for
	// mastery math.
	const now = Date.now();
	for (let i = 0; i < attemptCount; i++) {
		await db.insert(repAttempt).values({
			id: generateRepAttemptId(),
			scenarioId: sc.id,
			userId: TEST_USER_ID,
			chosenOption: i < correctCount ? 'a' : 'b',
			isCorrect: i < correctCount,
			confidence: null,
			answerMs: null,
			attemptedAt: new Date(now + i),
		});
	}
}

describe('getNodeMastery -- integration', () => {
	it('both gates pass when cards mature and reps are accurate', async () => {
		// 5 cards, 4 mastered -> ratio 0.80 == threshold -> pass.
		// 4 attempts, 3 correct -> 0.75 >= 0.70 -> pass.
		await seedAttachedCards(NODE_BOTH, 5, 4);
		await seedAttachedRepsAndAttempts(NODE_BOTH, 4, 3);

		const stats = await getNodeMastery(TEST_USER_ID, NODE_BOTH);
		expect(stats.cardsTotal).toBe(5);
		expect(stats.cardsMastered).toBe(4);
		expect(stats.cardsMasteredRatio).toBeCloseTo(0.8);
		expect(stats.repsTotal).toBe(4);
		expect(stats.repsCorrect).toBe(3);
		expect(stats.cardGate).toBe('pass');
		expect(stats.repGate).toBe('pass');
		expect(stats.mastered).toBe(true);

		const masteredBool = await isNodeMastered(TEST_USER_ID, NODE_BOTH);
		expect(masteredBool).toBe(true);
	});

	it('cards-only node with mature ratio masters without reps (rep gate not_applicable)', async () => {
		// 4 cards, all mastered. No scenarios attached.
		await seedAttachedCards(NODE_CARDS_ONLY, 4, 4);

		const stats = await getNodeMastery(TEST_USER_ID, NODE_CARDS_ONLY);
		expect(stats.cardGate).toBe('pass');
		expect(stats.repGate).toBe('not_applicable');
		expect(stats.mastered).toBe(true);
		expect(stats.displayScore).toBeCloseTo(1);
	});

	it('reps-only node with enough correct attempts masters without cards', async () => {
		// No cards. 4 attempts on one scenario, all correct.
		await seedAttachedRepsAndAttempts(NODE_REPS_ONLY, 4, 4);

		const stats = await getNodeMastery(TEST_USER_ID, NODE_REPS_ONLY);
		expect(stats.cardGate).toBe('not_applicable');
		expect(stats.repGate).toBe('pass');
		expect(stats.mastered).toBe(true);
	});

	it('empty node (nothing attached) is never mastered', async () => {
		const stats = await getNodeMastery(TEST_USER_ID, NODE_EMPTY);
		expect(stats.cardGate).toBe('not_applicable');
		expect(stats.repGate).toBe('not_applicable');
		expect(stats.mastered).toBe(false);
		expect(stats.displayScore).toBe(0);
	});
});
