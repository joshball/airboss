/**
 * Sessions BC integration tests.
 *
 * Targets the hot path the session runner walks for every rep slot: the
 * `commitSession`-pre-inserted slot row, then a `recordItemResult` UPDATE to
 * record the learner's answer. Runs against the local dev Postgres so the
 * full check / FK / unique-index stack is exercised the same way the runtime
 * exercises it.
 *
 * Coverage:
 *   - happy path (UPDATE against the pre-inserted slot)
 *   - missing slot -> SessionSlotNotFoundError (no ghost row inserted)
 *   - missing session -> SessionNotFoundError
 *   - foreign reviewId -> ReviewNotFoundError (NOT SessionNotFoundError)
 *   - audit row emitted on every successful update
 */

import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import {
	AUDIT_TARGETS,
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CONFIDENCE_LEVELS,
	CONTENT_SOURCES,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	DIFFICULTIES,
	DOMAINS,
	MIN_SESSION_LENGTH,
	PLAN_STATUSES,
	REVIEW_RATINGS,
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
	generateReviewId,
	generateScenarioId,
	generateSessionId,
	generateSessionItemResultId,
	generateStudyPlanId,
} from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	card,
	cardState,
	review,
	type ScenarioOption,
	scenario,
	scenarioOption,
	session,
	sessionItemResult,
	studyPlan,
} from './schema';
import { ReviewNotFoundError, recordItemResult, SessionNotFoundError, SessionSlotNotFoundError } from './sessions';

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
	// FK order: audit rows reference actor_id (set null on user delete, but we
	// remove explicitly so test rows don't pollute the audit explorer)
	// -> review (restrict on card delete) -> card_state (cascade on card)
	// -> session_item_result (cascade on session, set null on scenario)
	// -> session -> plan -> card -> scenario -> user.
	await db.delete(auditLog).where(eq(auditLog.actorId, TEST_USER_ID));
	await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, TEST_USER_ID));
	await db.delete(session).where(eq(session.userId, TEST_USER_ID));
	await db.delete(studyPlan).where(eq(studyPlan.userId, TEST_USER_ID));
	await db.delete(review).where(eq(review.userId, TEST_USER_ID));
	await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
	await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	await db.delete(scenario).where(eq(scenario.userId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

function twoOptions(): ScenarioOption[] {
	return [
		{ id: 'opt0', text: 'A', isCorrect: false, outcome: 'wrong', whyNot: 'incorrect' },
		{ id: 'opt1', text: 'B', isCorrect: true, outcome: 'right', whyNot: '' },
	];
}

async function seedRepSlot(opts: { reasonDetail?: string | null }): Promise<{
	sessionId: string;
	scenarioId: string;
	planId: string;
}> {
	const now = new Date();

	// Archive any prior active plan for this user so the partial-UNIQUE
	// `plan_user_active_uniq` (one ACTIVE plan per user) doesn't reject the
	// new insert when this helper runs across multiple tests in the suite.
	await db
		.update(studyPlan)
		.set({ status: PLAN_STATUSES.ARCHIVED })
		.where(and(eq(studyPlan.userId, TEST_USER_ID), eq(studyPlan.status, PLAN_STATUSES.ACTIVE)));

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
		teachingPoint: 'tp',
		domain: DOMAINS.AERODYNAMICS,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		sourceType: CONTENT_SOURCES.PERSONAL,
		regReferences: [],
		status: SCENARIO_STATUSES.ACTIVE,
		createdAt: now,
	});
	await db.insert(scenarioOption).values(
		twoOptions().map((o, idx) => ({
			id: `${scenarioId}__${o.id}`,
			scenarioId,
			text: o.text,
			isCorrect: o.isCorrect,
			outcome: o.outcome,
			whyNot: o.whyNot,
			position: idx,
		})),
	);

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
		chosenOptionId: null,
		isCorrect: null,
		confidence: null,
		answerMs: null,
		presentedAt: now,
		completedAt: null,
	});

	return { sessionId, scenarioId, planId };
}

/**
 * Seed a card-rated review owned by `TEST_USER_ID`. Used by the foreign /
 * stale review-id tests. Returns the review id so callers can reference it
 * without exposing the internal review-row shape.
 */
async function seedReview(): Promise<string> {
	const now = new Date();
	const cardId = generateCardId();
	await db.insert(card).values({
		id: cardId,
		userId: TEST_USER_ID,
		front: 'q',
		back: 'a',
		domain: DOMAINS.AERODYNAMICS,
		cardType: CARD_TYPES.BASIC,
		sourceType: CONTENT_SOURCES.PERSONAL,
		status: CARD_STATUSES.ACTIVE,
	});
	const reviewId = generateReviewId();
	await db.insert(review).values({
		id: reviewId,
		cardId,
		userId: TEST_USER_ID,
		rating: REVIEW_RATINGS.GOOD,
		stability: 1,
		difficulty: 5,
		elapsedDays: 0,
		scheduledDays: 1,
		state: CARD_STATES.REVIEW,
		dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
		reviewedAt: now,
	});
	return reviewId;
}

describe('recordItemResult', () => {
	it('records a rep submission against a pre-inserted slot row (B4 regression)', async () => {
		// This payload mirrors the one the session runner sends from `submitRep`
		// when a learner answers a strengthen-low-rep-accuracy slot. Before the
		// fix this UPSERT failed -- the bug ticket B4 in the 2026-04-25 walkthrough.
		const { sessionId, scenarioId } = await seedRepSlot({
			reasonDetail: 'Accuracy 0% over last attempts',
		});

		const chosenOptionId = `${scenarioId}__opt0`;
		const row = await recordItemResult(sessionId, TEST_USER_ID, {
			slotIndex: 0,
			itemKind: SESSION_ITEM_KINDS.REP,
			slice: SESSION_SLICES.STRENGTHEN,
			reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
			scenarioId,
			chosenOptionId,
			isCorrect: false,
			confidence: CONFIDENCE_LEVELS.UNCERTAIN,
			answerMs: 2,
			reasonDetail: 'Accuracy 0% over last attempts',
		});

		expect(row.scenarioId).toBe(scenarioId);
		expect(row.chosenOptionId).toBe(chosenOptionId);
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

	it('throws SessionSlotNotFoundError when the slot row was never inserted (no ghost row created)', async () => {
		// Convergent root-cause finding (correctness review): pre-fix the BC
		// upserted into a slot that didn't exist, fabricating a ghost row with
		// caller-controlled itemKind / slice and presentedAt = now. Callers
		// must now see a typed error and the underlying table must remain
		// untouched.
		const { sessionId } = await seedRepSlot({});

		// slotIndex = 99 -- well outside the seeded slot count of 1.
		await expect(
			recordItemResult(sessionId, TEST_USER_ID, {
				slotIndex: 99,
				itemKind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.STRENGTHEN,
				reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
			}),
		).rejects.toBeInstanceOf(SessionSlotNotFoundError);

		// No phantom row was created at slotIndex=99.
		const ghosts = await db
			.select({ id: sessionItemResult.id })
			.from(sessionItemResult)
			.where(and(eq(sessionItemResult.sessionId, sessionId), eq(sessionItemResult.slotIndex, 99)));
		expect(ghosts).toHaveLength(0);
	});

	it('throws SessionNotFoundError when the session id is unknown', async () => {
		// Stable cohort with `ses_` prefix so the BC's session lookup runs;
		// the row is absent so the assertion before any write fires.
		const fakeSessionId = generateSessionId();
		await expect(
			recordItemResult(fakeSessionId, TEST_USER_ID, {
				slotIndex: 0,
				itemKind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.STRENGTHEN,
				reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
			}),
		).rejects.toBeInstanceOf(SessionNotFoundError);
	});

	it('throws ReviewNotFoundError (NOT SessionNotFoundError) when reviewId does not belong to the user', async () => {
		// Convergent root-cause finding (backend + dx reviews): pre-fix the BC
		// threw `SessionNotFoundError` here, sending a 2am operator chasing
		// session data when the actual mismatch was on the review id. The
		// typed boundary now identifies the failing entity correctly.
		const { sessionId } = await seedRepSlot({});

		const foreignReviewId = generateReviewId(); // not in `review` for this user
		await expect(
			recordItemResult(sessionId, TEST_USER_ID, {
				slotIndex: 0,
				itemKind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.STRENGTHEN,
				reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
				reviewId: foreignReviewId,
			}),
		).rejects.toBeInstanceOf(ReviewNotFoundError);
	});

	it('accepts a reviewId that belongs to the user (happy path with review handoff)', async () => {
		const { sessionId, scenarioId } = await seedRepSlot({});
		const reviewId = await seedReview();

		const row = await recordItemResult(sessionId, TEST_USER_ID, {
			slotIndex: 0,
			itemKind: SESSION_ITEM_KINDS.REP,
			slice: SESSION_SLICES.STRENGTHEN,
			reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
			scenarioId,
			reviewId,
		});

		expect(row.reviewId).toBe(reviewId);
	});

	it('emits one audit row per successful update with before/after snapshots', async () => {
		// Atomicity check: the audit row writes inside the same transaction as
		// the slot UPDATE. Reading audit_log immediately after the call must
		// surface the row with the matching slotId target.
		const { sessionId, scenarioId } = await seedRepSlot({});

		const row = await recordItemResult(sessionId, TEST_USER_ID, {
			slotIndex: 0,
			itemKind: SESSION_ITEM_KINDS.REP,
			slice: SESSION_SLICES.STRENGTHEN,
			reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
			scenarioId,
			chosenOptionId: `${scenarioId}__opt1`,
			isCorrect: true,
			confidence: CONFIDENCE_LEVELS.CONFIDENT,
			answerMs: 1500,
		});

		const audits = await db
			.select()
			.from(auditLog)
			.where(
				and(
					eq(auditLog.actorId, TEST_USER_ID),
					eq(auditLog.targetType, AUDIT_TARGETS.STUDY_SESSION_ITEM),
					eq(auditLog.targetId, row.id),
				),
			);
		expect(audits.length).toBe(1);

		const audit = audits[0];
		expect(audit?.targetId).toBe(row.id);
		expect(audit?.actorId).toBe(TEST_USER_ID);
		// `before` snapshot captures the pre-update slot (no answer yet).
		expect((audit?.before as { isCorrect: boolean | null } | null)?.isCorrect ?? null).toBeNull();
		// `after` snapshot reflects the committed write.
		expect((audit?.after as { isCorrect: boolean | null }).isCorrect).toBe(true);
		expect((audit?.metadata as { sessionId: string }).sessionId).toBe(sessionId);
	});
});
