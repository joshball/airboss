/**
 * Server-side DB queries for `@ab/bc-wx-practice`. Hits the postgres driver
 * directly via `@ab/db/connection`. Imported only from `+page.server.ts`,
 * `+server.ts`, `apps/[STAR]/src/lib/server/[STARSTAR]`, and scripts.
 *
 * The pure state-machine + sampler + grader live one level up
 * (`../state-machine.ts`, etc.) so the runtime barrel can re-export them
 * to the browser bundle.
 */

import { WX_PRACTICE_MASTERY_STATES, type WxProduct } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createId } from '@ab/utils';
import { and, desc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { masteryKey } from '../sampler';
import {
	type WxPracticeAttemptRow,
	type WxPracticeMasteryRow,
	type WxPracticeSessionRow,
	wxPracticeAttempt,
	wxPracticeMastery,
	wxPracticeSession,
} from '../schema';
import { applyAttempt, type MasterySnapshot, type MasteryTransition } from '../state-machine';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const SESSION_ID_PREFIX = 'wxps';
const ATTEMPT_ID_PREFIX = 'wxpa';

export function generateWxPracticeSessionId(): string {
	return createId(SESSION_ID_PREFIX);
}

export function generateWxPracticeAttemptId(): string {
	return createId(ATTEMPT_ID_PREFIX);
}

export interface StartSessionInput {
	userId: string;
	products: WxProduct[];
	tier: number;
	focusFamilies: string[] | null;
	itemCount: number;
}

export async function startSession(input: StartSessionInput, db: Db = defaultDb): Promise<WxPracticeSessionRow> {
	const id = generateWxPracticeSessionId();
	const [row] = await db
		.insert(wxPracticeSession)
		.values({
			id,
			userId: input.userId,
			products: input.products,
			tier: input.tier,
			focusFamilies: input.focusFamilies,
			itemCount: input.itemCount,
		})
		.returning();
	if (!row) throw new Error('startSession: insert returned no row');
	return row;
}

export interface EndSessionInput {
	sessionId: string;
	userId: string;
	endedAt?: Date;
}

export async function endSession(input: EndSessionInput, db: Db = defaultDb): Promise<WxPracticeSessionRow | null> {
	const endedAt = input.endedAt ?? new Date();
	const [row] = await db
		.update(wxPracticeSession)
		.set({ endedAt })
		.where(and(eq(wxPracticeSession.id, input.sessionId), eq(wxPracticeSession.userId, input.userId)))
		.returning();
	return row ?? null;
}

export async function getSession(
	sessionId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<WxPracticeSessionRow | null> {
	const [row] = await db
		.select()
		.from(wxPracticeSession)
		.where(and(eq(wxPracticeSession.id, sessionId), eq(wxPracticeSession.userId, userId)))
		.limit(1);
	return row ?? null;
}

export interface RecordAttemptInput {
	userId: string;
	sessionId: string;
	product: WxProduct;
	rawExample: string;
	family: string;
	subFamily: string | null;
	tokenShown: string;
	questionForm: string;
	correct: boolean;
	answer: string;
	responseMs: number;
	/** First-attempt-of-the-family-in-this-session flag for the state machine. */
	acrossSession: boolean;
}

export interface RecordAttemptResult {
	attempt: WxPracticeAttemptRow;
	mastery: WxPracticeMasteryRow;
	transition: MasteryTransition;
}

export async function recordAttempt(input: RecordAttemptInput, db: Db = defaultDb): Promise<RecordAttemptResult> {
	const subFamilyValue = input.subFamily ?? '';

	return db.transaction(async (tx) => {
		// Insert the attempt audit row first.
		const attemptId = generateWxPracticeAttemptId();
		const [attemptRow] = await tx
			.insert(wxPracticeAttempt)
			.values({
				id: attemptId,
				userId: input.userId,
				sessionId: input.sessionId,
				product: input.product,
				rawExample: input.rawExample,
				family: input.family,
				subFamily: input.subFamily,
				tokenShown: input.tokenShown,
				questionForm: input.questionForm,
				correct: input.correct,
				answer: input.answer,
				responseMs: input.responseMs,
			})
			.returning();
		if (!attemptRow) throw new Error('recordAttempt: insert returned no row');

		// Load prior mastery row (if any) and run the state machine.
		const [priorRow] = await tx
			.select()
			.from(wxPracticeMastery)
			.where(
				and(
					eq(wxPracticeMastery.userId, input.userId),
					eq(wxPracticeMastery.product, input.product),
					eq(wxPracticeMastery.family, input.family),
					eq(wxPracticeMastery.subFamily, subFamilyValue),
				),
			)
			.limit(1);

		const prior = priorRow ? rowToSnapshot(priorRow) : null;
		const { mastery, transition } = applyAttempt({
			prior,
			userId: input.userId,
			product: input.product,
			family: input.family,
			subFamily: subFamilyValue,
			correct: input.correct,
			acrossSession: input.acrossSession,
		});

		// Upsert the mastery row.
		const [masteryRow] = await tx
			.insert(wxPracticeMastery)
			.values({
				userId: mastery.userId,
				product: mastery.product,
				family: mastery.family,
				subFamily: mastery.subFamily,
				attempts: mastery.attempts,
				correct: mastery.correct,
				recentRing: mastery.recentRing,
				streakAcrossSessions: mastery.streakAcrossSessions,
				state: mastery.state,
				lastSeenAt: mastery.lastSeenAt,
				lastUpdatedAt: mastery.lastUpdatedAt,
			})
			.onConflictDoUpdate({
				target: [
					wxPracticeMastery.userId,
					wxPracticeMastery.product,
					wxPracticeMastery.family,
					wxPracticeMastery.subFamily,
				],
				set: {
					attempts: mastery.attempts,
					correct: mastery.correct,
					recentRing: mastery.recentRing,
					streakAcrossSessions: mastery.streakAcrossSessions,
					state: mastery.state,
					lastSeenAt: mastery.lastSeenAt,
					lastUpdatedAt: mastery.lastUpdatedAt,
				},
			})
			.returning();
		if (!masteryRow) throw new Error('recordAttempt: mastery upsert returned no row');

		return { attempt: attemptRow, mastery: masteryRow, transition };
	});
}

export interface MasteryFilter {
	userId: string;
	product?: WxProduct;
}

export async function getMasteryFor(filter: MasteryFilter, db: Db = defaultDb): Promise<WxPracticeMasteryRow[]> {
	const whereExpr = filter.product
		? and(eq(wxPracticeMastery.userId, filter.userId), eq(wxPracticeMastery.product, filter.product))
		: eq(wxPracticeMastery.userId, filter.userId);
	return db.select().from(wxPracticeMastery).where(whereExpr);
}

export async function buildMasteryMap(
	userId: string,
	product: WxProduct | undefined,
	db: Db = defaultDb,
): Promise<Map<string, MasterySnapshot>> {
	const rows = await getMasteryFor({ userId, product }, db);
	const map = new Map<string, MasterySnapshot>();
	for (const row of rows) {
		map.set(masteryKey(row.product as WxProduct, row.family, row.subFamily), rowToSnapshot(row));
	}
	return map;
}

export interface SessionSummary {
	sessionId: string;
	totalAttempts: number;
	correct: number;
	incorrect: number;
	perFamily: Array<{
		product: string;
		family: string;
		subFamily: string | null;
		attempts: number;
		correct: number;
	}>;
	responseMsMin: number | null;
	responseMsMax: number | null;
	responseMsAvg: number | null;
}

export async function summarizeSession(sessionId: string, userId: string, db: Db = defaultDb): Promise<SessionSummary> {
	const rows = await db
		.select()
		.from(wxPracticeAttempt)
		.where(and(eq(wxPracticeAttempt.sessionId, sessionId), eq(wxPracticeAttempt.userId, userId)))
		.orderBy(desc(wxPracticeAttempt.shownAt));

	const perFamilyMap = new Map<
		string,
		{ product: string; family: string; subFamily: string | null; attempts: number; correct: number }
	>();
	let correctCount = 0;
	let totalMs = 0;
	let minMs: number | null = null;
	let maxMs: number | null = null;
	for (const row of rows) {
		if (row.correct) correctCount += 1;
		totalMs += row.responseMs;
		minMs = minMs === null ? row.responseMs : Math.min(minMs, row.responseMs);
		maxMs = maxMs === null ? row.responseMs : Math.max(maxMs, row.responseMs);
		const key = `${row.product}::${row.family}::${row.subFamily ?? ''}`;
		const entry = perFamilyMap.get(key) ?? {
			product: row.product,
			family: row.family,
			subFamily: row.subFamily,
			attempts: 0,
			correct: 0,
		};
		entry.attempts += 1;
		if (row.correct) entry.correct += 1;
		perFamilyMap.set(key, entry);
	}

	return {
		sessionId,
		totalAttempts: rows.length,
		correct: correctCount,
		incorrect: rows.length - correctCount,
		perFamily: [...perFamilyMap.values()],
		responseMsMin: minMs,
		responseMsMax: maxMs,
		responseMsAvg: rows.length > 0 ? totalMs / rows.length : null,
	};
}

function rowToSnapshot(row: WxPracticeMasteryRow): MasterySnapshot {
	return {
		userId: row.userId,
		product: row.product as WxProduct,
		family: row.family,
		subFamily: row.subFamily,
		attempts: row.attempts,
		correct: row.correct,
		recentRing: row.recentRing,
		streakAcrossSessions: row.streakAcrossSessions,
		state: validateMasteryState(row.state),
		lastSeenAt: row.lastSeenAt,
		lastUpdatedAt: row.lastUpdatedAt,
	};
}

function validateMasteryState(s: string): MasterySnapshot['state'] {
	if (s === WX_PRACTICE_MASTERY_STATES.PASSIVE) return WX_PRACTICE_MASTERY_STATES.PASSIVE;
	if (s === WX_PRACTICE_MASTERY_STATES.DEMOTED) return WX_PRACTICE_MASTERY_STATES.DEMOTED;
	return WX_PRACTICE_MASTERY_STATES.ACTIVE;
}
