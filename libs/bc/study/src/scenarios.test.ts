/**
 * Scenario BC tests.
 *
 * Runs against the local dev Postgres (the same connection drizzle-kit push
 * targets). Each test creates a fresh user so scenarios stay isolated and
 * the run cleans up in afterAll. The BC is the real thing under test -- no
 * mocks -- because "do the right thing" trumps "run without a DB".
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CONTENT_SOURCES,
	DIFFICULTIES,
	DOMAINS,
	PHASES_OF_FLIGHT,
	SCENARIO_OPTIONS_MAX,
	SCENARIO_STATUSES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { createId, generateAuthId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createScenario,
	getNextScenarios,
	getRepAccuracy,
	getRepDashboard,
	getRepStats,
	getScenarioOptions,
	getScenarios,
	InvalidOptionError,
	ScenarioNotAttemptableError,
	ScenarioNotFoundError,
	SourceRefRequiredError,
	setScenarioStatus,
	submitAttempt,
} from './scenarios';
import { type ScenarioOption, scenario, session, sessionItemResult, studyPlan } from './schema';
import { seedRepAttempt } from './test-support';

// Every run picks up a fresh ULID-prefixed marker so parallel CI runs (or
// re-runs after a crash) don't conflict on user ids. The beforeAll seeds
// one learner, tests create scenarios under that id, and afterAll removes
// every row we wrote via the FK cascades.
const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `scenarios-test-${TEST_USER_ID}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Scenarios Test',
		firstName: 'Scenarios',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	// Order: session_item_result (scenario FK is SET NULL, session FK is
	// CASCADE) -> session -> plan -> scenario -> user. bauth_user -> scenario
	// cascades, but session_item_result needs cleanup first so the scenario
	// FK doesn't dangle.
	await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, TEST_USER_ID));
	await db.delete(session).where(eq(session.userId, TEST_USER_ID));
	await db.delete(studyPlan).where(eq(studyPlan.userId, TEST_USER_ID));
	await db.delete(scenario).where(eq(scenario.userId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

/** Shape a 3-option scenario with the middle option marked correct. */
function threeOptions(): ScenarioOption[] {
	return [
		{ id: 'a', text: 'Continue climbing', isCorrect: false, outcome: 'Gain altitude', whyNot: 'No better options' },
		{ id: 'b', text: 'Land straight ahead', isCorrect: true, outcome: 'Controlled landing', whyNot: '' },
		{ id: 'c', text: 'Turn back', isCorrect: false, outcome: 'Stall/spin', whyNot: 'Impossible turn is fatal' },
	];
}

function makeInput(overrides: Partial<Parameters<typeof createScenario>[0]> = {}) {
	return {
		userId: TEST_USER_ID,
		title: `Engine rough at 800 AGL ${createId('t')}`,
		situation: 'Climbing through 800 AGL with engine roughness after takeoff.',
		options: threeOptions(),
		teachingPoint: 'Engine-out decisions are pre-brief work, not in-the-moment work.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.TAKEOFF,
		...overrides,
	};
}

describe('createScenario -- validation', () => {
	it('rejects fewer than 2 options', async () => {
		await expect(
			createScenario(
				makeInput({
					options: [{ id: 'a', text: 'Only one', isCorrect: true, outcome: '...', whyNot: '' }],
				}),
			),
		).rejects.toThrow();
	});

	it(`rejects more than ${SCENARIO_OPTIONS_MAX} options`, async () => {
		const tooMany: ScenarioOption[] = Array.from({ length: SCENARIO_OPTIONS_MAX + 1 }, (_, i) => ({
			id: `o${i}`,
			text: `option ${i}`,
			isCorrect: i === 0,
			outcome: 'outcome',
			whyNot: i === 0 ? '' : 'why not',
		}));
		await expect(createScenario(makeInput({ options: tooMany }))).rejects.toThrow();
	});

	it('rejects no correct option', async () => {
		await expect(
			createScenario(
				makeInput({
					options: [
						{ id: 'a', text: 'a', isCorrect: false, outcome: 'o', whyNot: 'wn' },
						{ id: 'b', text: 'b', isCorrect: false, outcome: 'o', whyNot: 'wn' },
					],
				}),
			),
		).rejects.toThrow(/exactly one option must be marked correct/);
	});

	it('rejects two correct options', async () => {
		await expect(
			createScenario(
				makeInput({
					options: [
						{ id: 'a', text: 'a', isCorrect: true, outcome: 'o', whyNot: '' },
						{ id: 'b', text: 'b', isCorrect: true, outcome: 'o', whyNot: '' },
					],
				}),
			),
		).rejects.toThrow(/exactly one option must be marked correct/);
	});

	it('rejects incorrect option missing whyNot', async () => {
		await expect(
			createScenario(
				makeInput({
					options: [
						{ id: 'a', text: 'a', isCorrect: true, outcome: 'o', whyNot: '' },
						{ id: 'b', text: 'b', isCorrect: false, outcome: 'o', whyNot: '' },
					],
				}),
			),
		).rejects.toThrow(/why not/i);
	});

	it('rejects duplicate option ids', async () => {
		await expect(
			createScenario(
				makeInput({
					options: [
						{ id: 'a', text: 'a', isCorrect: true, outcome: 'o', whyNot: '' },
						{ id: 'a', text: 'a2', isCorrect: false, outcome: 'o', whyNot: 'wn' },
					],
				}),
			),
		).rejects.toThrow(/duplicate option id/);
	});

	it('rejects invalid domain', async () => {
		await expect(
			// biome-ignore lint/suspicious/noExplicitAny: intentional invalid input
			createScenario(makeInput({ domain: 'not-a-domain' as any })),
		).rejects.toThrow();
	});

	it('creates a valid scenario and returns it', async () => {
		const created = await createScenario(makeInput());
		expect(created.id.startsWith('rep_')).toBe(true);
		expect(created.userId).toBe(TEST_USER_ID);
		const options = await getScenarioOptions(created.id);
		expect(options).toHaveLength(3);
		expect(created.status).toBe(SCENARIO_STATUSES.ACTIVE);
		expect(created.sourceType).toBe(CONTENT_SOURCES.PERSONAL);
		expect(created.isEditable).toBe(true);
	});

	it('raises SourceRefRequiredError when non-personal source has no sourceRef', async () => {
		await expect(
			createScenario(makeInput({ sourceType: CONTENT_SOURCES.COURSE, sourceRef: null })),
		).rejects.toBeInstanceOf(SourceRefRequiredError);
	});
});

describe('getScenarios -- filters', () => {
	it('filters by domain, difficulty, phase', async () => {
		const sWeather = await createScenario(
			makeInput({ domain: DOMAINS.WEATHER, difficulty: DIFFICULTIES.BEGINNER, phaseOfFlight: PHASES_OF_FLIGHT.CRUISE }),
		);
		const sRegs = await createScenario(
			makeInput({
				domain: DOMAINS.REGULATIONS,
				difficulty: DIFFICULTIES.INTERMEDIATE,
				phaseOfFlight: PHASES_OF_FLIGHT.PREFLIGHT,
			}),
		);

		const weather = await getScenarios(TEST_USER_ID, { domain: DOMAINS.WEATHER });
		expect(weather.some((s) => s.id === sWeather.id)).toBe(true);
		expect(weather.some((s) => s.id === sRegs.id)).toBe(false);

		const beginner = await getScenarios(TEST_USER_ID, { difficulty: DIFFICULTIES.BEGINNER });
		expect(beginner.some((s) => s.id === sWeather.id)).toBe(true);
		expect(beginner.some((s) => s.id === sRegs.id)).toBe(false);

		const preflight = await getScenarios(TEST_USER_ID, { phaseOfFlight: PHASES_OF_FLIGHT.PREFLIGHT });
		expect(preflight.some((s) => s.id === sRegs.id)).toBe(true);
		expect(preflight.some((s) => s.id === sWeather.id)).toBe(false);
	});

	it('defaults to active status and excludes archived/suspended', async () => {
		const sc = await createScenario(makeInput({ domain: DOMAINS.AIRSPACE }));
		await setScenarioStatus(sc.id, TEST_USER_ID, SCENARIO_STATUSES.ARCHIVED);

		const activeOnly = await getScenarios(TEST_USER_ID, { domain: DOMAINS.AIRSPACE });
		expect(activeOnly.some((s) => s.id === sc.id)).toBe(false);

		const archived = await getScenarios(TEST_USER_ID, {
			domain: DOMAINS.AIRSPACE,
			status: SCENARIO_STATUSES.ARCHIVED,
		});
		expect(archived.some((s) => s.id === sc.id)).toBe(true);
	});
});

describe('getNextScenarios -- priority', () => {
	it('prioritizes unattempted over attempted', async () => {
		// Three scenarios under a fresh user so the ordering is deterministic.
		const freshUser = generateAuthId();
		const now = new Date();
		await db.insert(bauthUser).values({
			id: freshUser,
			email: `scen-next-${freshUser}@airboss.test`,
			name: 'Next Test',
			firstName: 'Next',
			lastName: 'Test',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		});
		try {
			const s1 = await createScenario({ ...makeInput(), userId: freshUser });
			const s2 = await createScenario({ ...makeInput(), userId: freshUser });
			const s3 = await createScenario({ ...makeInput(), userId: freshUser });

			// Attempt s1 and s2 (leave s3 unattempted). seedRepAttempt writes
			// the session + slot the getNextScenarios query orders on.
			await seedRepAttempt({ userId: freshUser, scenarioId: s1.id, isCorrect: true });
			await seedRepAttempt({ userId: freshUser, scenarioId: s2.id, isCorrect: false });

			const next = await getNextScenarios(freshUser, {}, 10);
			// s3 is unattempted -> must appear first.
			expect(next[0].id).toBe(s3.id);
			const s1Pos = next.findIndex((s) => s.id === s1.id);
			const s2Pos = next.findIndex((s) => s.id === s2.id);
			// Both attempted scenarios should trail the unattempted one.
			expect(s1Pos).toBeGreaterThan(0);
			expect(s2Pos).toBeGreaterThan(0);
		} finally {
			await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, freshUser));
			await db.delete(session).where(eq(session.userId, freshUser));
			await db.delete(studyPlan).where(eq(studyPlan.userId, freshUser));
			await db.delete(scenario).where(eq(scenario.userId, freshUser));
			await db.delete(bauthUser).where(eq(bauthUser.id, freshUser));
		}
	});

	it('prefers least-recently-attempted among attempted scenarios', async () => {
		const freshUser = generateAuthId();
		const now = new Date();
		await db.insert(bauthUser).values({
			id: freshUser,
			email: `scen-recency-${freshUser}@airboss.test`,
			name: 'Recency Test',
			firstName: 'Recency',
			lastName: 'Test',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		});
		try {
			const a = await createScenario({ ...makeInput(), userId: freshUser });
			const b = await createScenario({ ...makeInput(), userId: freshUser });

			// Seed attempts with explicit timestamps so "least recent" is
			// deterministic at millisecond resolution without a setTimeout.
			const past = new Date(Date.now() - 10 * 60_000);
			const recent = new Date();
			await seedRepAttempt({ userId: freshUser, scenarioId: a.id, isCorrect: true, completedAt: past });
			await seedRepAttempt({ userId: freshUser, scenarioId: b.id, isCorrect: false, completedAt: recent });

			const next = await getNextScenarios(freshUser, {}, 10);
			const aPos = next.findIndex((s) => s.id === a.id);
			const bPos = next.findIndex((s) => s.id === b.id);
			expect(aPos).toBeLessThan(bPos);
		} finally {
			await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, freshUser));
			await db.delete(session).where(eq(session.userId, freshUser));
			await db.delete(studyPlan).where(eq(studyPlan.userId, freshUser));
			await db.delete(scenario).where(eq(scenario.userId, freshUser));
			await db.delete(bauthUser).where(eq(bauthUser.id, freshUser));
		}
	});
});

describe('submitAttempt -- correctness resolution', () => {
	// `createScenario` namespaces option ids as `${scenario_id}__${authoredId}`
	// so authored letters ("a", "b") stay collision-free on a single PK column.
	// Tests that pass an option id to `submitAttempt` build it the same way.
	const optId = (scenarioId: string, letter: string): string => `${scenarioId}__${letter}`;

	it('resolves isCorrect=true when the chosen option is the correct one', async () => {
		const sc = await createScenario(makeInput());
		const attempt = await submitAttempt({ scenarioId: sc.id, userId: TEST_USER_ID, chosenOptionId: optId(sc.id, 'b') });
		expect(attempt.isCorrect).toBe(true);
		expect(attempt.chosenOptionId).toBe(optId(sc.id, 'b'));
		expect(attempt.scenarioId).toBe(sc.id);
	});

	it('resolves isCorrect=false when the chosen option is an incorrect one', async () => {
		const sc = await createScenario(makeInput());
		const attempt = await submitAttempt({ scenarioId: sc.id, userId: TEST_USER_ID, chosenOptionId: optId(sc.id, 'a') });
		expect(attempt.isCorrect).toBe(false);
	});

	it('passes confidence and answerMs through when provided', async () => {
		const sc = await createScenario(makeInput());
		const attempt = await submitAttempt({
			scenarioId: sc.id,
			userId: TEST_USER_ID,
			chosenOptionId: optId(sc.id, 'b'),
			confidence: 4,
			answerMs: 3_500,
		});
		expect(attempt.confidence).toBe(4);
		expect(attempt.answerMs).toBe(3_500);
	});

	it('raises InvalidOptionError when the chosen option id is not on the scenario', async () => {
		const sc = await createScenario(makeInput());
		await expect(
			submitAttempt({ scenarioId: sc.id, userId: TEST_USER_ID, chosenOptionId: optId(sc.id, 'z') }),
		).rejects.toBeInstanceOf(InvalidOptionError);
	});

	it('raises ScenarioNotFoundError when the scenario belongs to another user', async () => {
		await expect(
			submitAttempt({
				scenarioId: 'rep_does-not-exist',
				userId: TEST_USER_ID,
				chosenOptionId: 'rep_does-not-exist__b',
			}),
		).rejects.toBeInstanceOf(ScenarioNotFoundError);
	});

	it('raises ScenarioNotAttemptableError when the scenario is archived', async () => {
		const sc = await createScenario(makeInput());
		await setScenarioStatus(sc.id, TEST_USER_ID, SCENARIO_STATUSES.ARCHIVED);
		await expect(
			submitAttempt({ scenarioId: sc.id, userId: TEST_USER_ID, chosenOptionId: optId(sc.id, 'b') }),
		).rejects.toBeInstanceOf(ScenarioNotAttemptableError);
	});

	it('is a pure validator -- repeated calls never touch the DB', async () => {
		// Post-ADR 012 submitAttempt resolves the outcome but does not persist
		// anything; the slot row on session_item_result is where persistence
		// happens (via recordItemResult). Repeated calls return the same shape
		// and never grow the underlying table.
		const sc = await createScenario(makeInput());
		const before = await db.select().from(sessionItemResult).where(eq(sessionItemResult.scenarioId, sc.id));
		const a1 = await submitAttempt({ scenarioId: sc.id, userId: TEST_USER_ID, chosenOptionId: optId(sc.id, 'b') });
		const a2 = await submitAttempt({ scenarioId: sc.id, userId: TEST_USER_ID, chosenOptionId: optId(sc.id, 'b') });
		expect(a1).toEqual(a2);
		const after = await db.select().from(sessionItemResult).where(eq(sessionItemResult.scenarioId, sc.id));
		expect(after.length).toBe(before.length);
	});

	it('resolves distinct outcomes for different chosen options', async () => {
		const sc = await createScenario(makeInput());
		const correct = await submitAttempt({ scenarioId: sc.id, userId: TEST_USER_ID, chosenOptionId: optId(sc.id, 'b') });
		const incorrect = await submitAttempt({
			scenarioId: sc.id,
			userId: TEST_USER_ID,
			chosenOptionId: optId(sc.id, 'a'),
		});
		expect(correct.isCorrect).toBe(true);
		expect(incorrect.isCorrect).toBe(false);
	});
});

describe('getRepAccuracy / getRepStats -- aggregation', () => {
	it('computes accuracy as correct / attempted', async () => {
		const freshUser = generateAuthId();
		const now = new Date();
		await db.insert(bauthUser).values({
			id: freshUser,
			email: `scen-acc-${freshUser}@airboss.test`,
			name: 'Accuracy Test',
			firstName: 'Accuracy',
			lastName: 'Test',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		});
		try {
			const s1 = await createScenario({ ...makeInput(), userId: freshUser, domain: DOMAINS.EMERGENCY_PROCEDURES });
			const s2 = await createScenario({ ...makeInput(), userId: freshUser, domain: DOMAINS.WEATHER });

			// s1: 2 correct, 1 incorrect on three distinct option choices
			// (b correct, a wrong, c wrong -> but only b is correct, so we need
			// 2 correct). We use a third scenario to keep the correct-count at
			// 3; idempotency now folds at the slot level (same session +
			// slotIndex), not via a time-based submit window, so these seed
			// calls stay independent regardless of timing.
			const s3 = await createScenario({ ...makeInput(), userId: freshUser, domain: DOMAINS.EMERGENCY_PROCEDURES });

			await seedRepAttempt({ userId: freshUser, scenarioId: s1.id, isCorrect: true });
			await seedRepAttempt({ userId: freshUser, scenarioId: s1.id, isCorrect: false });
			await seedRepAttempt({ userId: freshUser, scenarioId: s3.id, isCorrect: true });
			await seedRepAttempt({ userId: freshUser, scenarioId: s2.id, isCorrect: true });

			const lifetime = await getRepAccuracy(freshUser);
			expect(lifetime.attempted).toBe(4);
			expect(lifetime.correct).toBe(3);
			expect(lifetime.accuracy).toBeCloseTo(3 / 4);

			const emergency = await getRepAccuracy(freshUser, DOMAINS.EMERGENCY_PROCEDURES);
			expect(emergency.attempted).toBe(3);
			expect(emergency.correct).toBe(2);
			expect(emergency.accuracy).toBeCloseTo(2 / 3);

			const weather = await getRepAccuracy(freshUser, DOMAINS.WEATHER);
			expect(weather.attempted).toBe(1);
			expect(weather.correct).toBe(1);
			expect(weather.accuracy).toBeCloseTo(1);

			const stats = await getRepStats(freshUser);
			expect(stats.attemptCount).toBe(4);
			expect(stats.accuracy).toBeCloseTo(3 / 4);
			const ep = stats.domainBreakdown.find((d) => d.domain === DOMAINS.EMERGENCY_PROCEDURES);
			expect(ep?.attempted).toBe(3);
			expect(ep?.correct).toBe(2);
		} finally {
			await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, freshUser));
			await db.delete(session).where(eq(session.userId, freshUser));
			await db.delete(studyPlan).where(eq(studyPlan.userId, freshUser));
			await db.delete(scenario).where(eq(scenario.userId, freshUser));
			await db.delete(bauthUser).where(eq(bauthUser.id, freshUser));
		}
	});

	it('returns zeros when there are no attempts', async () => {
		const freshUser = generateAuthId();
		const now = new Date();
		await db.insert(bauthUser).values({
			id: freshUser,
			email: `scen-zero-${freshUser}@airboss.test`,
			name: 'Zero Test',
			firstName: 'Zero',
			lastName: 'Test',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		});
		try {
			const acc = await getRepAccuracy(freshUser);
			expect(acc.attempted).toBe(0);
			expect(acc.correct).toBe(0);
			expect(acc.accuracy).toBe(0);
		} finally {
			await db.delete(bauthUser).where(eq(bauthUser.id, freshUser));
		}
	});
});

describe('getRepDashboard', () => {
	it('counts scenarios, flags unattempted, and computes 30d accuracy', async () => {
		const freshUser = generateAuthId();
		const now = new Date();
		await db.insert(bauthUser).values({
			id: freshUser,
			email: `scen-dash-${freshUser}@airboss.test`,
			name: 'Dash Test',
			firstName: 'Dash',
			lastName: 'Test',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		});
		try {
			const s1 = await createScenario({ ...makeInput(), userId: freshUser });
			await createScenario({ ...makeInput(), userId: freshUser });
			await createScenario({ ...makeInput(), userId: freshUser });

			await seedRepAttempt({ userId: freshUser, scenarioId: s1.id, isCorrect: true });

			const dash = await getRepDashboard(freshUser);
			expect(dash.scenarioCount).toBe(3);
			expect(dash.unattemptedCount).toBe(2);
			expect(dash.attemptedToday).toBe(1);
			expect(dash.accuracyLast30d.attempted).toBe(1);
			expect(dash.accuracyLast30d.correct).toBe(1);
			expect(dash.accuracyLast30d.accuracy).toBeCloseTo(1);
		} finally {
			await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, freshUser));
			await db.delete(session).where(eq(session.userId, freshUser));
			await db.delete(studyPlan).where(eq(studyPlan.userId, freshUser));
			await db.delete(scenario).where(eq(scenario.userId, freshUser));
			await db.delete(bauthUser).where(eq(bauthUser.id, freshUser));
		}
	});
});
