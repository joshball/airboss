/**
 * Sessions BC integration tests.
 *
 * Targets the hot path the session runner walks for every rep slot: the
 * `commitSession`-pre-inserted slot row, then a `recordItemResult` UPSERT to
 * record the learner's answer. Runs against the local dev Postgres so the
 * full check / FK / unique-index stack is exercised the same way the runtime
 * exercises it.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CONFIDENCE_LEVELS,
	CONTENT_SOURCES,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	DIFFICULTIES,
	DOMAINS,
	MIN_SESSION_LENGTH,
	PLAN_STATUSES,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_MODES,
	SESSION_REASON_CODES,
	SESSION_SLICES,
} from '@ab/constants';
import { db } from '@ab/db';
import {
	generateAuthId,
	generateScenarioId,
	generateSessionId,
	generateSessionItemResultId,
	generateStudyPlanId,
} from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ScenarioOption, scenario, session, sessionItemResult, studyPlan } from './schema';
import { recordItemResult } from './sessions';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `sessions-test-${TEST_USER_ID}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Sessions Test',
		firstName: 'Sessions',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	// FK order: session_item_result (cascade on session, set null on scenario)
	// -> session -> plan -> scenario -> user.
	await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, TEST_USER_ID));
	await db.delete(session).where(eq(session.userId, TEST_USER_ID));
	await db.delete(studyPlan).where(eq(studyPlan.userId, TEST_USER_ID));
	await db.delete(scenario).where(eq(scenario.userId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

function twoOptions(): ScenarioOption[] {
	return [
		{ id: 'opt0', text: 'A', isCorrect: false },
		{ id: 'opt1', text: 'B', isCorrect: true },
	];
}

async function seedRepSlot(opts: { reasonDetail?: string | null }): Promise<{
	sessionId: string;
	scenarioId: string;
	planId: string;
}> {
	const now = new Date();

	const planId = generateStudyPlanId();
	await db.insert(studyPlan).values({
		id: planId,
		userId: TEST_USER_ID,
		title: 'plan',
		status: PLAN_STATUSES.ACTIVE,
		certGoals: [],
		focusDomains: [],
		skipDomains: [],
		skipNodes: [],
		depthPreference: DEPTH_PREFERENCES.WORKING,
		sessionLength: DEFAULT_SESSION_LENGTH,
		defaultMode: SESSION_MODES.MIXED,
		createdAt: now,
		updatedAt: now,
	});

	const scenarioId = generateScenarioId();
	await db.insert(scenario).values({
		id: scenarioId,
		userId: TEST_USER_ID,
		title: 'Test',
		situation: 'Sit',
		options: twoOptions(),
		teachingPoint: 'tp',
		domain: DOMAINS.AERODYNAMICS,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		sourceType: CONTENT_SOURCES.PERSONAL,
		regReferences: [],
		status: SCENARIO_STATUSES.ACTIVE,
		createdAt: now,
	});

	const sessionId = generateSessionId();
	await db.insert(session).values({
		id: sessionId,
		userId: TEST_USER_ID,
		planId,
		mode: SESSION_MODES.MIXED,
		focusOverride: null,
		certOverride: null,
		sessionLength: MIN_SESSION_LENGTH,
		items: [
			{
				kind: SESSION_ITEM_KINDS.REP,
				scenarioId,
				slice: SESSION_SLICES.STRENGTHEN,
				reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
				reasonDetail: opts.reasonDetail ?? undefined,
			},
		],
		seed: `seed-${sessionId}`,
		startedAt: now,
		completedAt: null,
	});

	// Mirrors what `commitSession` writes for a rep slot: scenarioId set, all
	// rep-outcome fields null, completedAt null.
	await db.insert(sessionItemResult).values({
		id: generateSessionItemResultId(),
		sessionId,
		userId: TEST_USER_ID,
		slotIndex: 0,
		itemKind: SESSION_ITEM_KINDS.REP,
		slice: SESSION_SLICES.STRENGTHEN,
		reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
		cardId: null,
		scenarioId,
		nodeId: null,
		reviewId: null,
		skipKind: null,
		reasonDetail: opts.reasonDetail ?? null,
		chosenOption: null,
		isCorrect: null,
		confidence: null,
		answerMs: null,
		presentedAt: now,
		completedAt: null,
	});

	return { sessionId, scenarioId, planId };
}

describe('recordItemResult (rep slot)', () => {
	it('records a rep submission against a pre-inserted slot row (B4 regression)', async () => {
		// This payload mirrors the one the session runner sends from `submitRep`
		// when a learner answers a strengthen-low-rep-accuracy slot. Before the
		// fix this UPSERT failed -- the bug ticket B4 in the 2026-04-25 walkthrough.
		const { sessionId, scenarioId } = await seedRepSlot({
			reasonDetail: 'Accuracy 0% over last attempts',
		});

		const row = await recordItemResult(sessionId, TEST_USER_ID, {
			slotIndex: 0,
			itemKind: SESSION_ITEM_KINDS.REP,
			slice: SESSION_SLICES.STRENGTHEN,
			reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
			scenarioId,
			chosenOption: 'opt0',
			isCorrect: false,
			confidence: CONFIDENCE_LEVELS.UNCERTAIN,
			answerMs: 2,
			reasonDetail: 'Accuracy 0% over last attempts',
		});

		expect(row.scenarioId).toBe(scenarioId);
		expect(row.chosenOption).toBe('opt0');
		expect(row.isCorrect).toBe(false);
		expect(row.confidence).toBe(CONFIDENCE_LEVELS.UNCERTAIN);
		expect(row.answerMs).toBe(2);
		expect(row.completedAt).not.toBeNull();

		// Confirm the FK relation to scenario actually resolves -- the row's
		// scenarioId must lead back to a scenario the user owns. Catches any
		// future regression where the FK target or prefix drift apart.
		const [linked] = await db
			.select({ id: scenario.id })
			.from(sessionItemResult)
			.innerJoin(scenario, eq(scenario.id, sessionItemResult.scenarioId))
			.where(and(eq(sessionItemResult.sessionId, sessionId), eq(sessionItemResult.slotIndex, 0)))
			.limit(1);
		expect(linked?.id).toBe(scenarioId);
	});
});
