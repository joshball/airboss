/**
 * Shared test helpers for BC integration suites.
 *
 * Rep outcomes live on session_item_result (ADR 012). A rep attempt is the
 * completed state of a rep-kind slot in a real session; seeding an attempt
 * requires a plan + session + session_item_result trio, which is more setup
 * than any single test should repeat inline.
 *
 * `seedRepAttempt` and `seedRepTestPlan` collapse that setup into two calls:
 * one to get a plan the fixture user owns, and one to append a completed
 * rep slot to a session scoped to that plan. Both helpers are idempotent in
 * the sense that they never reuse ids -- every call produces a fresh row,
 * so tests can stack attempts without colliding on plan / session / slot ids.
 */

import {
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	MIN_SESSION_LENGTH,
	PLAN_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_MODES,
	SESSION_REASON_CODES,
	SESSION_SLICES,
} from '@ab/constants';
import { db } from '@ab/db';
import { generateSessionId, generateSessionItemResultId, generateStudyPlanId } from '@ab/utils';
import { and, desc, eq } from 'drizzle-orm';
import { session, sessionItemResult, studyPlan } from './schema';

/**
 * Return a plan id owned by `userId`, creating a minimal one if the user
 * doesn't have one yet. The plan stays `active` so the BC's one-active-plan
 * invariant (enforced by the partial UNIQUE index) doesn't bite when multiple
 * tests share a user id.
 */
export async function seedRepTestPlan(userId: string): Promise<string> {
	const [existing] = await db
		.select({ id: studyPlan.id })
		.from(studyPlan)
		.where(and(eq(studyPlan.userId, userId), eq(studyPlan.status, PLAN_STATUSES.ACTIVE)))
		.limit(1);
	if (existing) return existing.id;

	const id = generateStudyPlanId();
	const now = new Date();
	await db.insert(studyPlan).values({
		id,
		userId,
		title: `test plan ${id}`,
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
	return id;
}

/**
 * Seed one completed rep slot for a user against a scenario. Creates a fresh
 * session row per call so each attempt owns its own slot; the slot is at
 * slotIndex 0 because the session is single-slot.
 *
 * `confidence` and `answerMs` default to NULL -- callers that need them
 * pass explicit values. `completedAt` defaults to `now` so the row counts
 * immediately; callers backdating attempts (activity streak tests,
 * calibration trend tests) pass their own timestamp.
 */
export async function seedRepAttempt(opts: {
	userId: string;
	scenarioId: string;
	isCorrect: boolean;
	/**
	 * Id of the chosen option row in `scenario_option`. Defaults to `null`
	 * (the test cares about the rollup, not the specific option). Set when a
	 * test asserts on the `chosenOptionId` value of the resulting slot.
	 */
	chosenOptionId?: string | null;
	confidence?: number | null;
	answerMs?: number | null;
	completedAt?: Date;
	planId?: string;
}): Promise<void> {
	const planId = opts.planId ?? (await seedRepTestPlan(opts.userId));
	const completedAt = opts.completedAt ?? new Date();
	const sessionId = generateSessionId();
	await db.insert(session).values({
		id: sessionId,
		userId: opts.userId,
		planId,
		mode: SESSION_MODES.MIXED,
		focusOverride: null,
		certOverride: null,
		sessionLength: MIN_SESSION_LENGTH,
		items: [
			{
				kind: SESSION_ITEM_KINDS.REP,
				scenarioId: opts.scenarioId,
				slice: SESSION_SLICES.CONTINUE,
				reasonCode: SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN,
			},
		],
		seed: `test-seed-${sessionId}`,
		startedAt: completedAt,
		completedAt,
	});
	await db.insert(sessionItemResult).values({
		id: generateSessionItemResultId(),
		sessionId,
		userId: opts.userId,
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
		chosenOptionId: opts.chosenOptionId ?? null,
		isCorrect: opts.isCorrect,
		confidence: opts.confidence ?? null,
		answerMs: opts.answerMs ?? null,
		presentedAt: completedAt,
		completedAt,
	});
}

/**
 * Teardown helper: wipe every session + session_item_result + plan owned by
 * the user. Callers invoke this before deleting rows the slots reference
 * (cards / scenarios / knowledge nodes) so FK restrict constraints don't
 * block the teardown.
 */
export async function clearUserSessions(userId: string): Promise<void> {
	await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, userId));
	await db.delete(session).where(eq(session.userId, userId));
	await db.delete(studyPlan).where(eq(studyPlan.userId, userId));
}

/** Return the most-recent session id for a user, or null if none. */
export async function latestSessionId(userId: string): Promise<string | null> {
	const [row] = await db
		.select({ id: session.id })
		.from(session)
		.where(eq(session.userId, userId))
		.orderBy(desc(session.startedAt))
		.limit(1);
	return row?.id ?? null;
}
