/**
 * Composite-FK enforcement on `card_state` and `session_item_result`.
 *
 * The migration ties (card_id, user_id) on `card_state` to `card.(id, user_id)`
 * and (session_id, user_id) on `session_item_result` to `session.(id, user_id)`.
 * The composite FKs lock the denormalized user_id to the owning row; without
 * them a write could land a card_state row whose user_id disagrees with the
 * owning card. These tests bypass the BC and assert the storage layer raises.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CONTENT_SOURCES,
	DIFFICULTIES,
	DOMAINS,
	PHASES_OF_FLIGHT,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_MODES,
	SESSION_REASON_CODES,
	SESSION_SLICES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import {
	generateAuthId,
	generateCardId,
	generateScenarioId,
	generateSessionId,
	generateSessionItemResultId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { card, cardState, scenario, session, sessionItemResult, studyPlan } from './schema';
import { seedRepTestPlan } from './test-support';

const PG_FOREIGN_KEY_VIOLATION = '23503';

const USER_A = generateAuthId();
const USER_B = generateAuthId();
const EMAIL_A = `composite-fk-a-${USER_A}@airboss.test`;
const EMAIL_B = `composite-fk-b-${USER_B}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values([
		{
			id: USER_A,
			email: EMAIL_A,
			name: 'Composite FK A',
			firstName: 'Composite',
			lastName: 'A',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: USER_B,
			email: EMAIL_B,
			name: 'Composite FK B',
			firstName: 'Composite',
			lastName: 'B',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
	]);
});

afterAll(async () => {
	for (const userId of [USER_A, USER_B]) {
		await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, userId));
		await db.delete(session).where(eq(session.userId, userId));
		await db.delete(studyPlan).where(eq(studyPlan.userId, userId));
		await db.delete(cardState).where(eq(cardState.userId, userId));
		await db.delete(card).where(eq(card.userId, userId));
		await db.delete(scenario).where(eq(scenario.userId, userId));
		await db.delete(bauthUser).where(eq(bauthUser.id, userId));
	}
});

interface PgError {
	code?: string;
	constraint?: string;
	constraint_name?: string;
	message?: string;
}

/**
 * Drizzle wraps postgres-js errors; the SQLSTATE + constraint name live on
 * `err.cause`. Walk to the deepest object that carries `code`.
 */
async function captureError(p: Promise<unknown>): Promise<PgError> {
	try {
		await p;
	} catch (err) {
		let current: unknown = err;
		while (current && typeof current === 'object') {
			const candidate = current as PgError & { cause?: unknown };
			if (typeof candidate.code === 'string') return candidate;
			if (!candidate.cause || candidate.cause === current) break;
			current = candidate.cause;
		}
		return (err as PgError) ?? {};
	}
	throw new Error('expected promise to reject, but it resolved');
}

async function insertCard(userId: string): Promise<string> {
	const id = generateCardId();
	await db.insert(card).values({
		id,
		userId,
		front: `front ${id}`,
		back: `back ${id}`,
		domain: DOMAINS.WEATHER,
		tags: [],
		cardType: CARD_TYPES.BASIC,
		sourceType: CONTENT_SOURCES.PERSONAL,
		isEditable: true,
		status: CARD_STATUSES.ACTIVE,
	});
	return id;
}

async function insertScenario(userId: string): Promise<string> {
	const id = generateScenarioId();
	await db.insert(scenario).values({
		id,
		userId,
		title: `scenario ${id}`,
		situation: 'situation',
		teachingPoint: 'teach',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.TAKEOFF,
		sourceType: CONTENT_SOURCES.PERSONAL,
		regReferences: [],
		status: SCENARIO_STATUSES.ACTIVE,
	});
	return id;
}

async function insertSession(userId: string): Promise<string> {
	const planId = await seedRepTestPlan(userId);
	const id = generateSessionId();
	const now = new Date();
	await db.insert(session).values({
		id,
		userId,
		planId,
		mode: SESSION_MODES.MIXED,
		focusOverride: null,
		certOverride: null,
		sessionLength: 3,
		items: [],
		seed: `test-seed-${id}`,
		startedAt: now,
	});
	return id;
}

describe('card_state_card_owner_fk', () => {
	it('rejects a card_state row whose user_id does not match the owning card.user_id', async () => {
		const cardOwnedByA = await insertCard(USER_A);

		// Try to write card_state pointing at A's card but claiming user_id = B.
		// The composite FK to card.(id, user_id) must reject this.
		const err = await captureError(
			db.insert(cardState).values({
				cardId: cardOwnedByA,
				userId: USER_B,
				stability: 1,
				difficulty: 5,
				state: CARD_STATES.NEW,
				dueAt: new Date(),
				lastReviewedAt: null,
				reviewCount: 0,
				lapseCount: 0,
			}),
		);
		expect(err.code).toBe(PG_FOREIGN_KEY_VIOLATION);
		const ctx = `${err.constraint ?? err.constraint_name ?? ''} ${err.message ?? ''}`;
		expect(ctx).toContain('card_state_card_owner_fk');
	});

	it('CASCADE through card -- deleting a card removes the matching card_state row', async () => {
		const cardId = await insertCard(USER_A);
		await db.insert(cardState).values({
			cardId,
			userId: USER_A,
			stability: 2,
			difficulty: 5,
			state: CARD_STATES.LEARNING,
			dueAt: new Date(),
			lastReviewedAt: null,
			reviewCount: 0,
			lapseCount: 0,
		});

		await db.delete(card).where(eq(card.id, cardId));

		const remaining = await db.select().from(cardState).where(eq(cardState.cardId, cardId));
		expect(remaining).toHaveLength(0);
	});
});

describe('session_item_result_session_owner_fk', () => {
	it('rejects a SIR row whose user_id does not match the owning session.user_id', async () => {
		const sessionOwnedByA = await insertSession(USER_A);
		const scenarioForA = await insertScenario(USER_A);
		const now = new Date();

		const err = await captureError(
			db.insert(sessionItemResult).values({
				id: generateSessionItemResultId(),
				sessionId: sessionOwnedByA,
				userId: USER_B,
				slotIndex: 0,
				itemKind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.CONTINUE,
				reasonCode: SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN,
				cardId: null,
				scenarioId: scenarioForA,
				nodeId: null,
				reviewId: null,
				skipKind: null,
				reasonDetail: null,
				chosenOptionId: null,
				isCorrect: true,
				confidence: null,
				answerMs: null,
				presentedAt: now,
				completedAt: now,
			}),
		);
		expect(err.code).toBe(PG_FOREIGN_KEY_VIOLATION);
		const ctx = `${err.constraint ?? err.constraint_name ?? ''} ${err.message ?? ''}`;
		expect(ctx).toContain('session_item_result_session_owner_fk');
	});

	it('CASCADE through session -- deleting a session removes its SIR rows', async () => {
		const sessionId = await insertSession(USER_A);
		const scenarioId = await insertScenario(USER_A);
		const now = new Date();
		const sirId = generateSessionItemResultId();
		await db.insert(sessionItemResult).values({
			id: sirId,
			sessionId,
			userId: USER_A,
			slotIndex: 0,
			itemKind: SESSION_ITEM_KINDS.REP,
			slice: SESSION_SLICES.CONTINUE,
			reasonCode: SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN,
			cardId: null,
			scenarioId,
			nodeId: null,
			reviewId: null,
			skipKind: null,
			reasonDetail: null,
			chosenOptionId: null,
			isCorrect: true,
			confidence: null,
			answerMs: null,
			presentedAt: now,
			completedAt: now,
		});

		await db.delete(session).where(eq(session.id, sessionId));

		const remaining = await db.select().from(sessionItemResult).where(eq(sessionItemResult.id, sirId));
		expect(remaining).toHaveLength(0);
	});
});
