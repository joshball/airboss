/**
 * Sessions BC integration tests.
 *
 * Runs against the local dev Postgres so the full check / FK / unique-index
 * stack is exercised the same way the runtime exercises it.
 *
 * Coverage:
 *   - `recordItemResult` (B4 regression suite, shared `TEST_USER_ID`)
 *   - `commitSession` -> `recordItemResult` round trip
 *   - `previewSession` plan / empty-pool path
 *   - `getResumableSession` status + recency rules
 *   - `startSession` happy path + missing-plan error
 *   - `getSession`, `getSessionItemResults`, `getSessionItemResult`,
 *     `getSessions`, `buildEnginePools` (cards + reps + nodes)
 */

import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import {
	AUDIT_TARGETS,
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CERTS,
	CONFIDENCE_LEVELS,
	CONTENT_SOURCES,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	DIFFICULTIES,
	DOMAINS,
	MIN_SESSION_LENGTH,
	MS_PER_MINUTE,
	PLAN_STATUSES,
	RESUME_WINDOW_MS,
	REVIEW_RATINGS,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_MODES,
	SESSION_REASON_CODES,
	SESSION_SLICES,
	STUDY_PRIORITIES,
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
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NoActivePlanError } from './plans';
import {
	card,
	cardState,
	knowledgeNode,
	review,
	type ScenarioOption,
	scenario,
	scenarioOption,
	session,
	sessionItemResult,
	studyPlan,
} from './schema';
import {
	buildEnginePools,
	commitSession,
	getResumableSession,
	getSession,
	getSessionItemResult,
	getSessionItemResults,
	getSessions,
	previewSession,
	ReviewNotFoundError,
	recordItemResult,
	SessionNotFoundError,
	SessionSlotNotFoundError,
	startSession,
} from './sessions';

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

// ---------------------------------------------------------------------------
// Per-test-isolated suites for the rest of `sessions.ts`. Each `it` block runs
// inside `withFreshUser`, which mints + cleans a dedicated user so no two
// tests share state -- closes the chunk-2 testing finding "sessions.test.ts
// exercises one function out of ten" (review 2026-05-01).
// ---------------------------------------------------------------------------

/**
 * Mint a dedicated user for the duration of the callback, then cascade-clean
 * everything the BC writes against that user. Mirrors the pattern in
 * `calibration.test.ts` and `review-sessions.test.ts`. Knowledge nodes are
 * global rows; tests that seed them clean their own ids inside `fn`.
 */
async function withFreshUser<T>(fn: (userId: string) => Promise<T>): Promise<T> {
	const userId = generateAuthId();
	const now = new Date();
	await db.insert(bauthUser).values({
		id: userId,
		email: `sessions-fresh-${userId}@airboss.test`,
		name: 'Fresh',
		firstName: 'Fresh',
		lastName: 'Sessions',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	try {
		return await fn(userId);
	} finally {
		// Same FK order as the file's afterAll for TEST_USER_ID. Audit rows
		// reference actor_id (set null on user delete; we drop them explicitly so
		// the audit explorer stays clean).
		await db.delete(auditLog).where(eq(auditLog.actorId, userId));
		await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, userId));
		await db.delete(session).where(eq(session.userId, userId));
		await db.delete(studyPlan).where(eq(studyPlan.userId, userId));
		await db.delete(review).where(eq(review.userId, userId));
		await db.delete(cardState).where(eq(cardState.userId, userId));
		await db.delete(card).where(eq(card.userId, userId));
		await db.delete(scenario).where(eq(scenario.userId, userId));
		await db.delete(bauthUser).where(eq(bauthUser.id, userId));
	}
}

/**
 * Seed an active plan for `userId` and return its id. Archives any prior
 * active plan first so the partial UNIQUE index can't reject the insert.
 */
async function seedPlan(
	userId: string,
	overrides: Partial<{ sessionLength: number; defaultMode: typeof SESSION_MODES.MIXED }> = {},
): Promise<string> {
	const now = new Date();
	await db
		.update(studyPlan)
		.set({ status: PLAN_STATUSES.ARCHIVED })
		.where(and(eq(studyPlan.userId, userId), eq(studyPlan.status, PLAN_STATUSES.ACTIVE)));

	const planId = generateStudyPlanId();
	await db.insert(studyPlan).values({
		id: planId,
		userId,
		title: 'plan',
		status: PLAN_STATUSES.ACTIVE,
		certGoals: [],
		focusDomains: [],
		skipDomains: [],
		skipNodes: [],
		depthPreference: DEPTH_PREFERENCES.WORKING,
		sessionLength: overrides.sessionLength ?? DEFAULT_SESSION_LENGTH,
		defaultMode: overrides.defaultMode ?? SESSION_MODES.MIXED,
		createdAt: now,
		updatedAt: now,
	});
	return planId;
}

/** Insert one session row directly. Caller controls every field that matters. */
async function insertSessionRow(opts: {
	userId: string;
	planId: string;
	startedAt: Date;
	completedAt: Date | null;
}): Promise<string> {
	const sessionId = generateSessionId();
	await db.insert(session).values({
		id: sessionId,
		userId: opts.userId,
		planId: opts.planId,
		mode: SESSION_MODES.MIXED,
		focusOverride: null,
		certOverride: null,
		sessionLength: MIN_SESSION_LENGTH,
		items: [],
		seed: `seed-${sessionId}`,
		startedAt: opts.startedAt,
		completedAt: opts.completedAt,
	});
	return sessionId;
}

/** Insert a scenario row + its two options. */
async function insertScenario(userId: string): Promise<string> {
	const scenarioId = generateScenarioId();
	await db.insert(scenario).values({
		id: scenarioId,
		userId,
		title: 'Test',
		situation: 'Sit',
		teachingPoint: 'tp',
		domain: DOMAINS.AERODYNAMICS,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		sourceType: CONTENT_SOURCES.PERSONAL,
		regReferences: [],
		status: SCENARIO_STATUSES.ACTIVE,
		createdAt: new Date(),
	});
	const opts: ScenarioOption[] = [
		{ id: 'opt0', text: 'A', isCorrect: false, outcome: 'wrong', whyNot: 'incorrect' },
		{ id: 'opt1', text: 'B', isCorrect: true, outcome: 'right', whyNot: '' },
	];
	await db.insert(scenarioOption).values(
		opts.map((o, idx) => ({
			id: `${scenarioId}__${o.id}`,
			scenarioId,
			text: o.text,
			isCorrect: o.isCorrect,
			outcome: o.outcome,
			whyNot: o.whyNot,
			position: idx,
		})),
	);
	return scenarioId;
}

describe('commitSession', () => {
	it('persists a session row + one slot per preview item, then recordItemResult flips the slot to completed', async () => {
		await withFreshUser(async (userId) => {
			// Round trip: drive a manually-constructed preview through commitSession,
			// then UPDATE the resulting slot via recordItemResult. Asserts that the
			// slot row commitSession inserts is the same one recordItemResult finds
			// (no ghost-row duplication, no slot_index drift).
			const planId = await seedPlan(userId);
			const scenarioId = await insertScenario(userId);

			const planRow = await db.select().from(studyPlan).where(eq(studyPlan.id, planId)).limit(1);
			expect(planRow[0]).toBeDefined();
			if (!planRow[0]) throw new Error('plan missing'); // type narrow

			const now = new Date('2026-04-30T15:00:00Z');
			const seed = 'seed-commit';

			const preview = {
				plan: planRow[0],
				mode: SESSION_MODES.MIXED,
				focus: null,
				cert: null,
				seed,
				sessionLength: MIN_SESSION_LENGTH,
				items: [
					{
						kind: SESSION_ITEM_KINDS.REP,
						scenarioId,
						slice: SESSION_SLICES.STRENGTHEN,
						reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
					},
				],
				short: false,
				allocation: {
					[SESSION_SLICES.CONTINUE]: 0,
					[SESSION_SLICES.STRENGTHEN]: 1,
					[SESSION_SLICES.EXPAND]: 0,
					[SESSION_SLICES.DIVERSIFY]: 0,
				},
			} as const;

			const sess = await commitSession(userId, preview, now);
			expect(sess.userId).toBe(userId);
			expect(sess.planId).toBe(planId);
			expect(sess.seed).toBe(seed);
			expect(sess.startedAt).toEqual(now);
			expect(sess.completedAt).toBeNull();

			const slots = await db
				.select()
				.from(sessionItemResult)
				.where(eq(sessionItemResult.sessionId, sess.id))
				.orderBy(sessionItemResult.slotIndex);
			expect(slots).toHaveLength(1);
			expect(slots[0]).toMatchObject({
				sessionId: sess.id,
				userId,
				slotIndex: 0,
				itemKind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.STRENGTHEN,
				reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
				scenarioId,
				cardId: null,
				nodeId: null,
				reviewId: null,
				skipKind: null,
				chosenOptionId: null,
				isCorrect: null,
				confidence: null,
				answerMs: null,
				completedAt: null,
			});
			expect(slots[0]?.presentedAt).toEqual(now);

			// Round-trip: recordItemResult lands on the SAME slot row.
			const updated = await recordItemResult(
				sess.id,
				userId,
				{
					slotIndex: 0,
					itemKind: SESSION_ITEM_KINDS.REP,
					slice: SESSION_SLICES.STRENGTHEN,
					reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
					scenarioId,
					chosenOptionId: `${scenarioId}__opt1`,
					isCorrect: true,
					confidence: CONFIDENCE_LEVELS.CONFIDENT,
					answerMs: 1234,
				},
				db,
				new Date('2026-04-30T15:01:00Z'),
			);
			expect(updated.id).toBe(slots[0]?.id);
			expect(updated.isCorrect).toBe(true);
			expect(updated.chosenOptionId).toBe(`${scenarioId}__opt1`);
			expect(updated.completedAt).toEqual(new Date('2026-04-30T15:01:00Z'));

			// And only ONE slot row exists for this session-slot pair (no ghost
			// duplicate from a fall-through INSERT path).
			const allSlots = await db
				.select({ id: sessionItemResult.id })
				.from(sessionItemResult)
				.where(eq(sessionItemResult.sessionId, sess.id));
			expect(allSlots).toHaveLength(1);
		});
	});

	it('writes zero slot rows when the preview produced an empty item list', async () => {
		await withFreshUser(async (userId) => {
			// Engine returns short/empty when no candidates are found. commitSession
			// must persist the session row anyway (caller expects an id back) but
			// must not emit a slot insert with values=[] -- pg rejects that.
			const planId = await seedPlan(userId);
			const planRow = await db.select().from(studyPlan).where(eq(studyPlan.id, planId)).limit(1);
			if (!planRow[0]) throw new Error('plan missing');

			const sess = await commitSession(
				userId,
				{
					plan: planRow[0],
					mode: SESSION_MODES.MIXED,
					focus: null,
					cert: null,
					seed: 'seed-empty',
					sessionLength: MIN_SESSION_LENGTH,
					items: [],
					short: true,
					allocation: {
						[SESSION_SLICES.CONTINUE]: 0,
						[SESSION_SLICES.STRENGTHEN]: 0,
						[SESSION_SLICES.EXPAND]: 0,
						[SESSION_SLICES.DIVERSIFY]: 0,
					},
				},
				new Date(),
			);

			const slots = await db.select().from(sessionItemResult).where(eq(sessionItemResult.sessionId, sess.id));
			expect(slots).toHaveLength(0);
		});
	});
});

describe('previewSession', () => {
	it('returns a structurally-valid preview against a plan with no user content (read-only, no persistence)', async () => {
		await withFreshUser(async (userId) => {
			// The fresh user owns no cards / scenarios; the dev DB does have
			// authored knowledge nodes globally so node_start slots may surface.
			// We pin the structural contract (mode / focus / cert / sessionLength
			// / seed / allocation keys) and the read-only invariant (no session
			// row written) -- both are stable regardless of what the engine
			// picks from the global node corpus.
			await seedPlan(userId);
			const now = new Date('2026-04-30T15:00:00Z');

			const preview = await previewSession(userId, { seed: 'seed-preview' }, now);

			expect(preview.mode).toBe(SESSION_MODES.MIXED);
			expect(preview.focus).toBeNull();
			expect(preview.cert).toBeNull();
			expect(preview.sessionLength).toBe(DEFAULT_SESSION_LENGTH);
			expect(preview.seed).toBe('seed-preview');
			// Allocation always carries a key for every slice.
			expect(Object.keys(preview.allocation).sort()).toEqual(
				[SESSION_SLICES.CONTINUE, SESSION_SLICES.STRENGTHEN, SESSION_SLICES.EXPAND, SESSION_SLICES.DIVERSIFY].sort(),
			);
			// items.length is bounded above by sessionLength.
			expect(preview.items.length).toBeLessThanOrEqual(preview.sessionLength);
			// `short` is the engine's "fewer items than requested" flag; tied
			// to items.length and sessionLength.
			expect(preview.short).toBe(preview.items.length < preview.sessionLength);
			// Every produced item carries the engine-authored fields downstream
			// commit / record paths key off.
			for (const item of preview.items) {
				expect(item.kind).toBeDefined();
				expect(item.slice).toBeDefined();
				expect(item.reasonCode).toBeDefined();
			}

			// previewSession must not write to session / sir.
			const sessions = await db.select({ id: session.id }).from(session).where(eq(session.userId, userId));
			expect(sessions).toEqual([]);
			const sirs = await db
				.select({ id: sessionItemResult.id })
				.from(sessionItemResult)
				.where(eq(sessionItemResult.userId, userId));
			expect(sirs).toEqual([]);
		});
	});

	it('throws NoActivePlanError when the user has no active plan', async () => {
		await withFreshUser(async (userId) => {
			// No seedPlan() call -- the user exists but owns no plan row.
			await expect(previewSession(userId, {}, new Date())).rejects.toBeInstanceOf(NoActivePlanError);
		});
	});

	it('honors caller-supplied options.mode + options.sessionLength overrides', async () => {
		await withFreshUser(async (userId) => {
			// Plan default is MIXED + DEFAULT_SESSION_LENGTH; the call overrides
			// both. Override precedence: options > goal > plan (per BC contract).
			await seedPlan(userId, { defaultMode: SESSION_MODES.MIXED });
			const now = new Date();

			const preview = await previewSession(
				userId,
				{ mode: SESSION_MODES.STRENGTHEN, sessionLength: MIN_SESSION_LENGTH, seed: 'seed-override' },
				now,
			);
			expect(preview.mode).toBe(SESSION_MODES.STRENGTHEN);
			expect(preview.sessionLength).toBe(MIN_SESSION_LENGTH);
			expect(preview.seed).toBe('seed-override');
		});
	});
});

describe('startSession', () => {
	it('previews + commits in one call and returns the persisted session row', async () => {
		await withFreshUser(async (userId) => {
			await seedPlan(userId);
			const { session: sess, preview } = await startSession(userId, { seed: 'seed-start' });

			expect(sess.userId).toBe(userId);
			expect(sess.seed).toBe('seed-start');
			// Items committed match the preview shape exactly. Whatever the
			// engine produced -- including any global knowledge_node picks --
			// must round-trip into the session row's `items` jsonb column.
			expect(sess.items).toEqual(preview.items);
			expect(sess.sessionLength).toBe(preview.sessionLength);

			// Persistence: a session row exists for the returned id.
			const reread = await getSession(sess.id, userId);
			expect(reread?.id).toBe(sess.id);

			// Slot rows are commitSession's responsibility; one per item.
			const slots = await db
				.select({ id: sessionItemResult.id })
				.from(sessionItemResult)
				.where(eq(sessionItemResult.sessionId, sess.id));
			expect(slots).toHaveLength(preview.items.length);
		});
	});

	it('throws NoActivePlanError when the user has no active plan (preview leg fails)', async () => {
		await withFreshUser(async (userId) => {
			await expect(startSession(userId)).rejects.toBeInstanceOf(NoActivePlanError);

			// And nothing was persisted.
			const sessions = await db.select({ id: session.id }).from(session).where(eq(session.userId, userId));
			expect(sessions).toHaveLength(0);
		});
	});
});

describe('getSession', () => {
	it('returns the session row when the id + userId match', async () => {
		await withFreshUser(async (userId) => {
			const planId = await seedPlan(userId);
			const sessionId = await insertSessionRow({
				userId,
				planId,
				startedAt: new Date(),
				completedAt: null,
			});

			const row = await getSession(sessionId, userId);
			expect(row?.id).toBe(sessionId);
			expect(row?.userId).toBe(userId);
		});
	});

	it('returns null when the session id is unknown', async () => {
		await withFreshUser(async (userId) => {
			const fakeId = generateSessionId();
			const row = await getSession(fakeId, userId);
			expect(row).toBeNull();
		});
	});

	it('returns null when a different user owns the session id', async () => {
		// Cross-user authz guard: the BC scopes by userId, so fetching another
		// user's session id must produce null even if the row exists.
		await withFreshUser(async (ownerId) => {
			const planId = await seedPlan(ownerId);
			const sessionId = await insertSessionRow({
				userId: ownerId,
				planId,
				startedAt: new Date(),
				completedAt: null,
			});

			await withFreshUser(async (otherId) => {
				const row = await getSession(sessionId, otherId);
				expect(row).toBeNull();
			});
		});
	});
});

describe('getSessionItemResults', () => {
	it('returns every slot for a session, ordered by slotIndex', async () => {
		await withFreshUser(async (userId) => {
			// Seed a session with three slots inserted out-of-order. The BC
			// orders by slotIndex on the way out so the caller can render items
			// without re-sorting.
			const planId = await seedPlan(userId);
			const scenarioId = await insertScenario(userId);
			const sessionId = await insertSessionRow({
				userId,
				planId,
				startedAt: new Date(),
				completedAt: null,
			});

			const indices = [2, 0, 1];
			for (const idx of indices) {
				await db.insert(sessionItemResult).values({
					id: generateSessionItemResultId(),
					sessionId,
					userId,
					slotIndex: idx,
					itemKind: SESSION_ITEM_KINDS.REP,
					slice: SESSION_SLICES.STRENGTHEN,
					reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
					cardId: null,
					scenarioId,
					nodeId: null,
					reviewId: null,
					skipKind: null,
					reasonDetail: null,
					chosenOptionId: null,
					isCorrect: null,
					confidence: null,
					answerMs: null,
					presentedAt: new Date(),
					completedAt: null,
				});
			}

			const slots = await getSessionItemResults(sessionId, userId);
			expect(slots.map((s) => s.slotIndex)).toEqual([0, 1, 2]);
			for (const s of slots) {
				expect(s.userId).toBe(userId);
				expect(s.sessionId).toBe(sessionId);
			}
		});
	});

	it('returns an empty array when the session has no slots', async () => {
		await withFreshUser(async (userId) => {
			const planId = await seedPlan(userId);
			const sessionId = await insertSessionRow({
				userId,
				planId,
				startedAt: new Date(),
				completedAt: null,
			});

			const slots = await getSessionItemResults(sessionId, userId);
			expect(slots).toEqual([]);
		});
	});
});

describe('getSessionItemResult', () => {
	it('returns the single slot at the requested index', async () => {
		await withFreshUser(async (userId) => {
			const planId = await seedPlan(userId);
			const scenarioId = await insertScenario(userId);
			const sessionId = await insertSessionRow({
				userId,
				planId,
				startedAt: new Date(),
				completedAt: null,
			});

			const ids: Record<number, string> = {};
			for (const idx of [0, 1]) {
				const slotId = generateSessionItemResultId();
				ids[idx] = slotId;
				await db.insert(sessionItemResult).values({
					id: slotId,
					sessionId,
					userId,
					slotIndex: idx,
					itemKind: SESSION_ITEM_KINDS.REP,
					slice: SESSION_SLICES.STRENGTHEN,
					reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
					cardId: null,
					scenarioId,
					nodeId: null,
					reviewId: null,
					skipKind: null,
					reasonDetail: null,
					chosenOptionId: null,
					isCorrect: null,
					confidence: null,
					answerMs: null,
					presentedAt: new Date(),
					completedAt: null,
				});
			}

			const slot0 = await getSessionItemResult(sessionId, userId, 0);
			expect(slot0?.id).toBe(ids[0]);
			expect(slot0?.slotIndex).toBe(0);

			const slot1 = await getSessionItemResult(sessionId, userId, 1);
			expect(slot1?.id).toBe(ids[1]);
			expect(slot1?.slotIndex).toBe(1);
		});
	});

	it('returns null when the slot index does not exist', async () => {
		await withFreshUser(async (userId) => {
			const planId = await seedPlan(userId);
			const sessionId = await insertSessionRow({
				userId,
				planId,
				startedAt: new Date(),
				completedAt: null,
			});

			const missing = await getSessionItemResult(sessionId, userId, 99);
			expect(missing).toBeNull();
		});
	});
});

describe('getSessions', () => {
	it('returns sessions for the user newest-first, capped by limit', async () => {
		await withFreshUser(async (userId) => {
			// Three sessions across distinct startedAt values. getSessions orders
			// by startedAt DESC; limit caps the slice. Asserts both axes in one
			// shot.
			const planId = await seedPlan(userId);
			const t0 = new Date('2026-04-29T10:00:00Z');
			const t1 = new Date('2026-04-29T11:00:00Z');
			const t2 = new Date('2026-04-29T12:00:00Z');
			const id0 = await insertSessionRow({ userId, planId, startedAt: t0, completedAt: t0 });
			const id1 = await insertSessionRow({ userId, planId, startedAt: t1, completedAt: t1 });
			const id2 = await insertSessionRow({ userId, planId, startedAt: t2, completedAt: null });

			const all = await getSessions(userId);
			expect(all.map((s) => s.id)).toEqual([id2, id1, id0]);

			const limited = await getSessions(userId, 2);
			expect(limited.map((s) => s.id)).toEqual([id2, id1]);
		});
	});

	it('does not return sessions owned by other users', async () => {
		await withFreshUser(async (ownerId) => {
			const planId = await seedPlan(ownerId);
			await insertSessionRow({
				userId: ownerId,
				planId,
				startedAt: new Date(),
				completedAt: null,
			});

			await withFreshUser(async (otherId) => {
				const rows = await getSessions(otherId);
				expect(rows).toEqual([]);
			});
		});
	});
});

describe('getResumableSession', () => {
	it('returns the most-recent in-progress session inside the resume window', async () => {
		await withFreshUser(async (userId) => {
			// Two in-progress sessions inside the window; BC returns the newer one.
			const planId = await seedPlan(userId);
			const now = new Date('2026-04-30T15:00:00Z');
			const olderInWindow = new Date(now.getTime() - 30 * MS_PER_MINUTE);
			const newerInWindow = new Date(now.getTime() - 10 * MS_PER_MINUTE);
			await insertSessionRow({
				userId,
				planId,
				startedAt: olderInWindow,
				completedAt: null,
			});
			const newerId = await insertSessionRow({
				userId,
				planId,
				startedAt: newerInWindow,
				completedAt: null,
			});

			const row = await getResumableSession(userId, db, now);
			expect(row?.id).toBe(newerId);
		});
	});

	it('does not return a completed session even when within the resume window', async () => {
		// Status filter: completedAt IS NOT NULL is excluded. The grace test
		// below + this test pin both axes (status, recency) the BC asserts.
		await withFreshUser(async (userId) => {
			const planId = await seedPlan(userId);
			const now = new Date('2026-04-30T15:00:00Z');
			const startedRecently = new Date(now.getTime() - 5 * MS_PER_MINUTE);
			await insertSessionRow({
				userId,
				planId,
				startedAt: startedRecently,
				completedAt: startedRecently,
			});

			const row = await getResumableSession(userId, db, now);
			expect(row).toBeNull();
		});
	});

	it('does not return an in-progress session that started outside the resume window', async () => {
		await withFreshUser(async (userId) => {
			const planId = await seedPlan(userId);
			const now = new Date('2026-04-30T15:00:00Z');
			// One ms past the cutoff -- the BC's predicate is gte(startedAt, cutoff)
			// so a startedAt exactly at the cutoff would still resume; subtract 1s
			// to be safely outside.
			const stale = new Date(now.getTime() - RESUME_WINDOW_MS - 1000);
			await insertSessionRow({
				userId,
				planId,
				startedAt: stale,
				completedAt: null,
			});

			const row = await getResumableSession(userId, db, now);
			expect(row).toBeNull();
		});
	});

	it('returns null when the user has no sessions at all', async () => {
		await withFreshUser(async (userId) => {
			const row = await getResumableSession(userId, db, new Date());
			expect(row).toBeNull();
		});
	});
});

describe('buildEnginePools', () => {
	it('cards() pulls only ACTIVE cards owned by the user, with overdueRatio for due-today rows', async () => {
		await withFreshUser(async (userId) => {
			// Two cards: one ACTIVE, one SUSPENDED. The engine's strengthen slice
			// scores the active one; the suspended card must not surface.
			const now = new Date('2026-04-30T15:00:00Z');
			const activeId = generateCardId();
			const suspendedId = generateCardId();
			await db.insert(card).values([
				{
					id: activeId,
					userId,
					front: 'a',
					back: 'b',
					domain: DOMAINS.AERODYNAMICS,
					tags: [],
					cardType: CARD_TYPES.BASIC,
					sourceType: CONTENT_SOURCES.PERSONAL,
					sourceRef: null,
					nodeId: null,
					isEditable: true,
					status: CARD_STATUSES.ACTIVE,
					createdAt: now,
					updatedAt: now,
				},
				{
					id: suspendedId,
					userId,
					front: 's',
					back: 'b',
					domain: DOMAINS.AERODYNAMICS,
					tags: [],
					cardType: CARD_TYPES.BASIC,
					sourceType: CONTENT_SOURCES.PERSONAL,
					sourceRef: null,
					nodeId: null,
					isEditable: true,
					status: CARD_STATUSES.SUSPENDED,
					createdAt: now,
					updatedAt: now,
				},
			]);
			await db.insert(cardState).values([
				{
					cardId: activeId,
					userId,
					stability: 1,
					difficulty: 5,
					state: CARD_STATES.NEW,
					dueAt: now,
					lastReviewId: null,
					lastReviewedAt: null,
					reviewCount: 0,
					lapseCount: 0,
				},
				{
					cardId: suspendedId,
					userId,
					stability: 1,
					difficulty: 5,
					state: CARD_STATES.NEW,
					dueAt: now,
					lastReviewId: null,
					lastReviewedAt: null,
					reviewCount: 0,
					lapseCount: 0,
				},
			]);

			const pools = buildEnginePools(userId, now, db);
			const cards = await pools.cards({
				certFilter: [],
				focusFilter: [],
				skipDomains: [],
				skipNodes: [],
				recentDomains: [],
				domainFrequencyLast30Days: {},
				activeDomainsLast7Days: [],
				simNodePressure: {},
			});

			expect(cards.map((c) => c.cardId)).toEqual([activeId]);
			const [active] = cards;
			expect(active).toMatchObject({
				cardId: activeId,
				domain: DOMAINS.AERODYNAMICS,
				nodeId: null,
				state: CARD_STATES.NEW,
				lastRating: null,
			});
			// Card is due exactly at `now`; overdueMs is 0 so overdueRatio is 0.
			expect(active?.overdueRatio).toBe(0);
		});
	});

	it('reps() narrows accuracyLast5 + attemptedInLast7Days from real session_item_result history', async () => {
		await withFreshUser(async (userId) => {
			// Seed a scenario plus a sessionItemResult marked correct in the
			// last 7 days. The reps() pool callback should produce one
			// candidate with accuracyLast5=1 and attemptedInLast7Days=true.
			const now = new Date('2026-04-30T15:00:00Z');
			const planId = await seedPlan(userId);
			const scenarioId = await insertScenario(userId);
			const sessionId = await insertSessionRow({
				userId,
				planId,
				startedAt: now,
				completedAt: now,
			});
			await db.insert(sessionItemResult).values({
				id: generateSessionItemResultId(),
				sessionId,
				userId,
				slotIndex: 0,
				itemKind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.STRENGTHEN,
				reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
				cardId: null,
				scenarioId,
				nodeId: null,
				reviewId: null,
				skipKind: null,
				reasonDetail: null,
				chosenOptionId: `${scenarioId}__opt1`,
				isCorrect: true,
				confidence: CONFIDENCE_LEVELS.CONFIDENT,
				answerMs: 1500,
				presentedAt: now,
				completedAt: now,
			});

			const pools = buildEnginePools(userId, now, db);
			const reps = await pools.reps({
				certFilter: [],
				focusFilter: [],
				skipDomains: [],
				skipNodes: [],
				recentDomains: [],
				domainFrequencyLast30Days: {},
				activeDomainsLast7Days: [],
				simNodePressure: {},
			});

			expect(reps).toHaveLength(1);
			expect(reps[0]).toMatchObject({
				scenarioId,
				domain: DOMAINS.AERODYNAMICS,
				nodeId: null,
				accuracyLast5: 1,
				attemptedInLast7Days: true,
				lastIncorrectAt: null,
			});
		});
	});

	it('nodes() narrows by certFilter and excludes untagged nodes', async () => {
		await withFreshUser(async (userId) => {
			// Three nodes:
			//   - tagged PPL + standard priority -> included when certFilter=[PPL].
			//   - tagged CFI + standard priority -> excluded (CFI not covered by PPL).
			//   - untagged (minimumCert=null) -> always excluded.
			//
			// Knowledge nodes are global rows; clean them at the end of the
			// test so the global table doesn't leak between runs.
			const now = new Date('2026-04-30T15:00:00Z');
			const tag = `bep-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
			const pplNodeId = `${tag}-ppl-tagged`;
			const cfiNodeId = `${tag}-cfi-tagged`;
			const untaggedNodeId = `${tag}-untagged`;
			const seededNodeIds = [pplNodeId, cfiNodeId, untaggedNodeId];

			try {
				await db.insert(knowledgeNode).values([
					{
						id: pplNodeId,
						title: 'PPL node',
						domain: DOMAINS.AERODYNAMICS,
						crossDomains: [],
						knowledgeTypes: ['factual'],
						modalities: [],
						references: [],
						assessable: true,
						assessmentMethods: [],
						minimumCert: CERTS.PPL,
						studyPriority: STUDY_PRIORITIES.STANDARD,
						contentMd: '',
						createdAt: now,
						updatedAt: now,
					},
					{
						id: cfiNodeId,
						title: 'CFI node',
						domain: DOMAINS.AERODYNAMICS,
						crossDomains: [],
						knowledgeTypes: ['factual'],
						modalities: [],
						references: [],
						assessable: true,
						assessmentMethods: [],
						minimumCert: CERTS.CFI,
						studyPriority: STUDY_PRIORITIES.STANDARD,
						contentMd: '',
						createdAt: now,
						updatedAt: now,
					},
					{
						id: untaggedNodeId,
						title: 'Untagged node',
						domain: DOMAINS.AERODYNAMICS,
						crossDomains: [],
						knowledgeTypes: ['factual'],
						modalities: [],
						references: [],
						assessable: true,
						assessmentMethods: [],
						minimumCert: null,
						studyPriority: null,
						contentMd: '',
						createdAt: now,
						updatedAt: now,
					},
				]);

				const pools = buildEnginePools(userId, now, db);
				const filters = {
					certFilter: [CERTS.PPL] as const,
					focusFilter: [] as const,
					skipDomains: [] as const,
					skipNodes: [] as const,
					recentDomains: [] as const,
					domainFrequencyLast30Days: {},
					activeDomainsLast7Days: [] as const,
					simNodePressure: {},
				};
				const nodes = await pools.nodes(filters);
				const seededOut = nodes.filter((n) => seededNodeIds.includes(n.nodeId));
				expect(seededOut.map((n) => n.nodeId)).toEqual([pplNodeId]);
				const [pplOut] = seededOut;
				expect(pplOut).toMatchObject({
					nodeId: pplNodeId,
					domain: DOMAINS.AERODYNAMICS,
					minimumCert: CERTS.PPL,
					priority: STUDY_PRIORITIES.STANDARD,
					prerequisitesMet: true, // no `requires` edges seeded
					unstarted: true, // no card / rep / sir touches this node
					bloomDepth: null,
				});
			} finally {
				await db.delete(knowledgeNode).where(inArray(knowledgeNode.id, seededNodeIds));
			}
		});
	});

	it('memoizes pool reads so repeat calls do not re-issue queries', async () => {
		await withFreshUser(async (userId) => {
			// `buildEnginePools` returns callbacks that cache their first
			// resolved promise. Calling cards()/reps()/nodes() twice returns
			// the SAME promise reference -- the BC contract is "internal
			// parallel fan-out doesn't duplicate work." We can verify the
			// promise identity directly without instrumenting Drizzle.
			const now = new Date('2026-04-30T15:00:00Z');
			const pools = buildEnginePools(userId, now, db);
			const filters = {
				certFilter: [] as const,
				focusFilter: [] as const,
				skipDomains: [] as const,
				skipNodes: [] as const,
				recentDomains: [] as const,
				domainFrequencyLast30Days: {},
				activeDomainsLast7Days: [] as const,
				simNodePressure: {},
			};

			const cardsA = pools.cards(filters);
			const cardsB = pools.cards(filters);
			expect(cardsA).toBe(cardsB);

			const repsA = pools.reps(filters);
			const repsB = pools.reps(filters);
			expect(repsA).toBe(repsB);

			const nodesA = pools.nodes(filters);
			const nodesB = pools.nodes(filters);
			expect(nodesA).toBe(nodesB);

			// Resolve them all to make sure the cached promises are valid.
			await Promise.all([cardsA, repsA, nodesA]);
		});
	});
});
