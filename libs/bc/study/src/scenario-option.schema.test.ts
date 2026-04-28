/**
 * Storage-layer invariants for `study.scenario_option`.
 *
 * The BC's zod-level validation (covered by scenarios.test.ts) catches
 * mis-shaped writes through `createScenario`. These tests bypass the BC and
 * hit the table directly so a future BC method, a script, or the seeder
 * cannot violate the invariants without the DB raising. They assert on the
 * exact constraint names the migration creates so a rename surfaces here.
 */

import { bauthUser } from '@ab/auth/schema';
import {
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
	createId,
	generateAuthId,
	generateScenarioId,
	generateSessionId,
	generateSessionItemResultId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scenario, scenarioOption, session, sessionItemResult, studyPlan } from './schema';
import { seedRepTestPlan } from './test-support';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `scen-option-schema-${TEST_USER_ID}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Scenario Option Schema Test',
		firstName: 'Scenario',
		lastName: 'Option',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, TEST_USER_ID));
	await db.delete(session).where(eq(session.userId, TEST_USER_ID));
	await db.delete(studyPlan).where(eq(studyPlan.userId, TEST_USER_ID));
	await db.delete(scenario).where(eq(scenario.userId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

/** Create a bare scenario row directly (bypasses createScenario). */
async function insertBareScenario(): Promise<string> {
	const id = generateScenarioId();
	const now = new Date();
	await db.insert(scenario).values({
		id,
		userId: TEST_USER_ID,
		title: `bare scenario ${id}`,
		situation: 'situation text',
		teachingPoint: 'teaching point text',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.TAKEOFF,
		sourceType: CONTENT_SOURCES.PERSONAL,
		regReferences: [],
		status: SCENARIO_STATUSES.ACTIVE,
		createdAt: now,
	});
	return id;
}

interface PgError {
	code?: string;
	constraint?: string;
	constraint_name?: string;
	message?: string;
}

/**
 * Drizzle wraps postgres-js errors; the SQLSTATE + constraint name live on
 * `err.cause`. Walk to the deepest object that carries `code` so callers see
 * the Postgres error payload rather than the wrapper.
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

describe('scenario_option -- partial UNIQUE on (scenario_id) WHERE is_correct = true', () => {
	it('rejects two is_correct=true rows for the same scenario', async () => {
		const scenarioId = await insertBareScenario();
		await db.insert(scenarioOption).values({
			id: createId('opt'),
			scenarioId,
			text: 'first correct',
			isCorrect: true,
			outcome: 'good',
			whyNot: '',
			position: 0,
		});
		const err = await captureError(
			db.insert(scenarioOption).values({
				id: createId('opt'),
				scenarioId,
				text: 'second correct',
				isCorrect: true,
				outcome: 'also good',
				whyNot: '',
				position: 1,
			}),
		);
		expect(err.code).toBe(PG_UNIQUE_VIOLATION);
		const ctx = `${err.constraint ?? err.constraint_name ?? ''} ${err.message ?? ''}`;
		expect(ctx).toContain('scenario_option_correct_unique');
	});

	it('permits multiple is_correct=false rows for the same scenario', async () => {
		const scenarioId = await insertBareScenario();
		await db.insert(scenarioOption).values([
			{
				id: createId('opt'),
				scenarioId,
				text: 'wrong a',
				isCorrect: false,
				outcome: 'bad',
				whyNot: 'reason a',
				position: 0,
			},
			{
				id: createId('opt'),
				scenarioId,
				text: 'wrong b',
				isCorrect: false,
				outcome: 'bad',
				whyNot: 'reason b',
				position: 1,
			},
		]);
		const rows = await db.select().from(scenarioOption).where(eq(scenarioOption.scenarioId, scenarioId));
		expect(rows).toHaveLength(2);
	});
});

describe('scenario_option -- UNIQUE on (scenario_id, position)', () => {
	it('rejects two rows at the same position on the same scenario', async () => {
		const scenarioId = await insertBareScenario();
		await db.insert(scenarioOption).values({
			id: createId('opt'),
			scenarioId,
			text: 'first',
			isCorrect: true,
			outcome: 'ok',
			whyNot: '',
			position: 0,
		});
		const err = await captureError(
			db.insert(scenarioOption).values({
				id: createId('opt'),
				scenarioId,
				text: 'collision at 0',
				isCorrect: false,
				outcome: 'bad',
				whyNot: 'overlapping position',
				position: 0,
			}),
		);
		expect(err.code).toBe(PG_UNIQUE_VIOLATION);
		const ctx = `${err.constraint ?? err.constraint_name ?? ''} ${err.message ?? ''}`;
		expect(ctx).toContain('scenario_option_scenario_position_unique');
	});
});

describe('scenario_option -- CHECK why_not required when is_correct=false', () => {
	it('rejects is_correct=false with empty why_not', async () => {
		const scenarioId = await insertBareScenario();
		const err = await captureError(
			db.insert(scenarioOption).values({
				id: createId('opt'),
				scenarioId,
				text: 'wrong with no reason',
				isCorrect: false,
				outcome: 'bad',
				whyNot: '',
				position: 0,
			}),
		);
		expect(err.code).toBe(PG_CHECK_VIOLATION);
		const ctx = `${err.constraint ?? err.constraint_name ?? ''} ${err.message ?? ''}`;
		expect(ctx).toContain('scenario_option_why_not_required_check');
	});

	it('rejects is_correct=false with spaces-only why_not (length(trim(...)) = 0)', async () => {
		// Postgres `trim()` strips spaces by default, so a spaces-only string
		// trims to length zero and fails the CHECK. Tabs/newlines are not in
		// the default trim set, which is fine for the constraint's intent.
		const scenarioId = await insertBareScenario();
		const err = await captureError(
			db.insert(scenarioOption).values({
				id: createId('opt'),
				scenarioId,
				text: 'wrong with spaces reason',
				isCorrect: false,
				outcome: 'bad',
				whyNot: '     ',
				position: 0,
			}),
		);
		expect(err.code).toBe(PG_CHECK_VIOLATION);
	});

	it('permits is_correct=true with empty why_not', async () => {
		const scenarioId = await insertBareScenario();
		await db.insert(scenarioOption).values({
			id: createId('opt'),
			scenarioId,
			text: 'correct with no why_not',
			isCorrect: true,
			outcome: 'good',
			whyNot: '',
			position: 0,
		});
		const rows = await db.select().from(scenarioOption).where(eq(scenarioOption.scenarioId, scenarioId));
		expect(rows).toHaveLength(1);
	});
});

describe('session_item_result.chosen_option_id FK to scenario_option.id', () => {
	/**
	 * Seed a session + slot manually so we can vary chosen_option_id beyond
	 * what test-support.seedRepAttempt accepts. The slot row carries the FK
	 * to scenario_option that this suite asserts on.
	 */
	async function insertSessionWithSlot(opts: {
		scenarioId: string;
		chosenOptionId: string | null;
		isCorrect: boolean;
	}): Promise<{ sessionId: string; sirId: string }> {
		const planId = await seedRepTestPlan(TEST_USER_ID);
		const sessionId = generateSessionId();
		const now = new Date();
		await db.insert(session).values({
			id: sessionId,
			userId: TEST_USER_ID,
			planId,
			mode: SESSION_MODES.MIXED,
			focusOverride: null,
			certOverride: null,
			sessionLength: 3,
			items: [
				{
					kind: SESSION_ITEM_KINDS.REP,
					scenarioId: opts.scenarioId,
					slice: SESSION_SLICES.CONTINUE,
					reasonCode: SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN,
				},
			],
			seed: `test-seed-${sessionId}`,
			startedAt: now,
			completedAt: now,
		});
		const sirId = generateSessionItemResultId();
		await db.insert(sessionItemResult).values({
			id: sirId,
			sessionId,
			userId: TEST_USER_ID,
			slotIndex: 0,
			itemKind: SESSION_ITEM_KINDS.REP,
			slice: SESSION_SLICES.CONTINUE,
			reasonCode: SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN,
			cardId: null,
			scenarioId: opts.scenarioId,
			nodeId: null,
			reviewId: null,
			skipKind: null,
			reasonDetail: null,
			chosenOptionId: opts.chosenOptionId,
			isCorrect: opts.isCorrect,
			confidence: null,
			answerMs: null,
			presentedAt: now,
			completedAt: now,
		});
		return { sessionId, sirId };
	}

	it('rejects an SIR insert with a chosen_option_id that does not exist', async () => {
		const scenarioId = await insertBareScenario();
		const err = await captureError(
			insertSessionWithSlot({
				scenarioId,
				chosenOptionId: createId('opt'),
				isCorrect: false,
			}),
		);
		expect(err.code).toBe(PG_FOREIGN_KEY_VIOLATION);
		const ctx = `${err.constraint ?? err.constraint_name ?? ''} ${err.message ?? ''}`;
		expect(ctx).toContain('session_item_result_chosen_option_id_scenario_option_id_fk');
	});

	it('SET NULL on option delete -- SIR row survives with chosen_option_id = NULL', async () => {
		const scenarioId = await insertBareScenario();
		const optionId = createId('opt');
		await db.insert(scenarioOption).values({
			id: optionId,
			scenarioId,
			text: 'about to be deleted',
			isCorrect: true,
			outcome: 'doesnt matter',
			whyNot: '',
			position: 0,
		});
		const { sirId } = await insertSessionWithSlot({
			scenarioId,
			chosenOptionId: optionId,
			isCorrect: true,
		});

		await db.delete(scenarioOption).where(eq(scenarioOption.id, optionId));

		const [row] = await db.select().from(sessionItemResult).where(eq(sessionItemResult.id, sirId));
		expect(row).toBeDefined();
		expect(row?.chosenOptionId).toBeNull();
		// scenario_id is independent of chosen_option_id and stays put.
		expect(row?.scenarioId).toBe(scenarioId);
	});
});

describe('scenario_option -- CASCADE on scenario delete', () => {
	it('deleting a scenario removes all its options; historical SIRs survive with chosen_option_id = NULL', async () => {
		const scenarioId = await insertBareScenario();
		const optionId = createId('opt');
		await db.insert(scenarioOption).values([
			{ id: optionId, scenarioId, text: 'correct', isCorrect: true, outcome: 'ok', whyNot: '', position: 0 },
			{
				id: createId('opt'),
				scenarioId,
				text: 'wrong',
				isCorrect: false,
				outcome: 'bad',
				whyNot: 'reason',
				position: 1,
			},
		]);

		// Build an SIR so we can prove its chosen_option_id falls back to NULL.
		const planId = await seedRepTestPlan(TEST_USER_ID);
		const sessionId = generateSessionId();
		const now = new Date();
		await db.insert(session).values({
			id: sessionId,
			userId: TEST_USER_ID,
			planId,
			mode: SESSION_MODES.MIXED,
			focusOverride: null,
			certOverride: null,
			sessionLength: 3,
			items: [
				{
					kind: SESSION_ITEM_KINDS.REP,
					scenarioId,
					slice: SESSION_SLICES.CONTINUE,
					reasonCode: SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN,
				},
			],
			seed: `test-seed-${sessionId}`,
			startedAt: now,
			completedAt: now,
		});
		const sirId = generateSessionItemResultId();
		await db.insert(sessionItemResult).values({
			id: sirId,
			sessionId,
			userId: TEST_USER_ID,
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
			chosenOptionId: optionId,
			isCorrect: true,
			confidence: null,
			answerMs: null,
			presentedAt: now,
			completedAt: now,
		});

		await db.delete(scenario).where(eq(scenario.id, scenarioId));

		const remainingOptions = await db.select().from(scenarioOption).where(eq(scenarioOption.scenarioId, scenarioId));
		expect(remainingOptions).toHaveLength(0);

		const [survivingSir] = await db.select().from(sessionItemResult).where(eq(sessionItemResult.id, sirId));
		expect(survivingSir).toBeDefined();
		// scenario_id FK is set null on scenario delete.
		expect(survivingSir?.scenarioId).toBeNull();
		// chosen_option_id FK is set null on option delete (cascade reached it).
		expect(survivingSir?.chosenOptionId).toBeNull();
	});
});
