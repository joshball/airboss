/**
 * Read-only aggregate queries for the study BC.
 *
 * Exposes the data the memory dashboard, calibration tracker, and other
 * products need without reaching into study tables directly. All queries are
 * scoped to a single user.
 */

import {
	CARD_STATES,
	CARD_STATUSES,
	type CardState,
	type Domain,
	MASTERY_STABILITY_DAYS,
	MS_PER_DAY,
	REVIEW_RATINGS,
	type ReviewRating,
	SESSION_ITEM_KINDS,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, count, desc, eq, gt, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { card, cardState, type ReviewRow, review, type SessionItemResultRow, sessionItemResult } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface DomainStats {
	domain: Domain;
	total: number;
	due: number;
	mastered: number;
}

export interface DashboardStats {
	dueNow: number;
	reviewedToday: number;
	streakDays: number;
	stateCounts: Record<CardState, number>;
	domains: DomainStats[];
}

export interface MasteryStats {
	total: number;
	due: number;
	mastered: number;
	accuracy: number;
}

export interface ReviewStats {
	reviewedCount: number;
	ratingDistribution: Record<ReviewRating, number>;
	streakDays: number;
}

/** UTC day key in YYYY-MM-DD form. */
function utcDayKey(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** UTC midnight at the start of the day containing `d`. */
function utcStartOfDay(d: Date): Date {
	return new Date(`${utcDayKey(d)}T00:00:00.000Z`);
}

/**
 * Count consecutive UTC days with at least one review ending today.
 * Queries distinct review days (UTC) in descending order and walks backwards.
 */
async function computeStreakDays(userId: string, db: Db, now: Date): Promise<number> {
	const lookbackStart = new Date(now.getTime() - 366 * MS_PER_DAY);
	const rows = await db
		.selectDistinct({
			day: sql<string>`to_char(date_trunc('day', ${review.reviewedAt} at time zone 'UTC'), 'YYYY-MM-DD')`.as('day'),
		})
		.from(review)
		.where(and(eq(review.userId, userId), gte(review.reviewedAt, lookbackStart)))
		.orderBy(sql`day desc`);

	if (rows.length === 0) return 0;

	const todayKey = utcDayKey(now);
	const yesterdayKey = utcDayKey(new Date(now.getTime() - MS_PER_DAY));
	// Grace: no activity today yet but yesterday counts -- keep the streak
	// intact. Matches getStreakDays in sessions.ts / extendedStreak in dashboard.ts.
	let cursorKey = rows[0]?.day === todayKey ? todayKey : yesterdayKey;

	let streak = 0;
	for (const row of rows) {
		if (row.day > cursorKey) continue;
		if (row.day === cursorKey) {
			streak++;
			const next = new Date(`${cursorKey}T00:00:00.000Z`);
			next.setUTCDate(next.getUTCDate() - 1);
			cursorKey = utcDayKey(next);
		} else if (row.day < cursorKey) {
			// Gap -- streak ends before this row.
			break;
		}
	}

	return streak;
}

/** Dashboard stats: due, reviewed today, streak, state counts, per-domain summaries. */
export async function getDashboardStats(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<DashboardStats> {
	const todayStart = utcStartOfDay(now);

	// Fan out: every query below is independent. Parallel round-trips keep
	// the dashboard under the 200ms target even at moderate scale.
	const [dueNowRow, reviewedTodayRow, stateRows, domains, streakDays] = await Promise.all([
		db
			.select({ c: count() })
			.from(cardState)
			.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
			.where(and(eq(cardState.userId, userId), lte(cardState.dueAt, now), eq(card.status, CARD_STATUSES.ACTIVE)))
			.then((r) => r[0]),
		db
			.select({ c: count() })
			.from(review)
			.where(and(eq(review.userId, userId), gte(review.reviewedAt, todayStart)))
			.then((r) => r[0]),
		db
			.select({ state: cardState.state, c: count() })
			.from(cardState)
			.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
			.where(and(eq(cardState.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)))
			.groupBy(cardState.state),
		getDomainBreakdown(userId, db, now),
		computeStreakDays(userId, db, now),
	]);

	const stateCounts: Record<CardState, number> = {
		[CARD_STATES.NEW]: 0,
		[CARD_STATES.LEARNING]: 0,
		[CARD_STATES.REVIEW]: 0,
		[CARD_STATES.RELEARNING]: 0,
	};
	for (const row of stateRows) {
		const s = row.state as CardState;
		if (s in stateCounts) stateCounts[s] = Number(row.c);
	}

	return {
		dueNow: Number(dueNowRow?.c ?? 0),
		reviewedToday: Number(reviewedTodayRow?.c ?? 0),
		streakDays,
		stateCounts,
		domains,
	};
}

/** Per-domain breakdown: total active cards, due, mastered (stability > threshold). */
export async function getDomainBreakdown(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<DomainStats[]> {
	const rows = await db
		.select({
			domain: card.domain,
			total: count(),
			due: sql<number>`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)`,
			mastered: sql<number>`sum(case when ${cardState.stability} > ${MASTERY_STABILITY_DAYS} then 1 else 0 end)`,
		})
		.from(card)
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.where(and(eq(card.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)))
		.groupBy(card.domain)
		.orderBy(card.domain);

	return rows.map((r) => ({
		domain: r.domain as Domain,
		total: Number(r.total),
		due: Number(r.due ?? 0),
		mastered: Number(r.mastered ?? 0),
	}));
}

/**
 * Mastery summary for a user, optionally filtered to one domain or one
 * knowledge-graph node (or both). Accepts the legacy `Domain` positional form
 * for backward compatibility; new callers should pass the options object.
 */
export async function getCardMastery(
	userId: string,
	filterOrDomain?: Domain | { domain?: Domain; nodeId?: string },
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<MasteryStats> {
	const filter =
		typeof filterOrDomain === 'string' || filterOrDomain === undefined ? { domain: filterOrDomain } : filterOrDomain;

	const clauses = [eq(card.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)];
	if (filter.domain) clauses.push(eq(card.domain, filter.domain));
	if (filter.nodeId) clauses.push(eq(card.nodeId, filter.nodeId));

	// Accuracy and totals share the same "active card" scope so we don't mix
	// lifecycle states (e.g. counting reviews of archived cards as accuracy
	// while excluding them from totals).
	const accuracyClauses = [eq(review.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)];
	if (filter.domain) accuracyClauses.push(eq(card.domain, filter.domain));
	if (filter.nodeId) accuracyClauses.push(eq(card.nodeId, filter.nodeId));

	const [totalsRow, accuracyRow] = await Promise.all([
		db
			.select({
				total: count(),
				due: sql<number>`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)`,
				mastered: sql<number>`sum(case when ${cardState.stability} > ${MASTERY_STABILITY_DAYS} then 1 else 0 end)`,
			})
			.from(card)
			.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
			.where(and(...clauses))
			.then((r) => r[0]),
		db
			.select({
				total: count(),
				correct: sql<number>`sum(case when ${review.rating} > ${REVIEW_RATINGS.AGAIN} then 1 else 0 end)`,
			})
			.from(review)
			.innerJoin(card, and(eq(card.id, review.cardId), eq(card.userId, review.userId)))
			.where(and(...accuracyClauses))
			.then((r) => r[0]),
	]);

	const totalReviews = Number(accuracyRow?.total ?? 0);
	const correctReviews = Number(accuracyRow?.correct ?? 0);
	const accuracy = totalReviews === 0 ? 0 : correctReviews / totalReviews;

	return {
		total: Number(totalsRow?.total ?? 0),
		due: Number(totalsRow?.due ?? 0),
		mastered: Number(totalsRow?.mastered ?? 0),
		accuracy,
	};
}

/** Review stats over an optional time range. */
export async function getReviewStats(
	userId: string,
	range?: { start?: Date; end?: Date },
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<ReviewStats> {
	const clauses = [eq(review.userId, userId)];
	if (range?.start) clauses.push(gte(review.reviewedAt, range.start));
	if (range?.end) clauses.push(lte(review.reviewedAt, range.end));

	const rows = await db
		.select({ rating: review.rating, c: count() })
		.from(review)
		.where(and(...clauses))
		.groupBy(review.rating);

	const ratingDistribution: Record<ReviewRating, number> = {
		[REVIEW_RATINGS.AGAIN]: 0,
		[REVIEW_RATINGS.HARD]: 0,
		[REVIEW_RATINGS.GOOD]: 0,
		[REVIEW_RATINGS.EASY]: 0,
	};
	let reviewedCount = 0;
	for (const row of rows) {
		const rating = Number(row.rating) as ReviewRating;
		const n = Number(row.c);
		if (rating in ratingDistribution) ratingDistribution[rating] = n;
		reviewedCount += n;
	}

	const streakDays = await computeStreakDays(userId, db, now);

	return { reviewedCount, ratingDistribution, streakDays };
}

/** Count of cards currently due for a user (active status only). */
export async function getDueCardCount(userId: string, db: Db = defaultDb, now: Date = new Date()): Promise<number> {
	const [row] = await db
		.select({ c: count() })
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(and(eq(cardState.userId, userId), lte(cardState.dueAt, now), eq(card.status, CARD_STATUSES.ACTIVE)));
	return Number(row?.c ?? 0);
}

/** Summary row for the card-detail recent-reviews panel. */
export type RecentReviewRow = Pick<
	ReviewRow,
	'id' | 'rating' | 'confidence' | 'stability' | 'difficulty' | 'state' | 'reviewedAt' | 'dueAt' | 'scheduledDays'
>;

/**
 * Load the most recent reviews for a card. Scoped to the caller's user so
 * route handlers can't accidentally leak another learner's history through a
 * URL guess. Returns empty array when the card has no reviews yet.
 */
export async function getRecentReviewsForCard(
	cardId: string,
	userId: string,
	limit = 10,
	db: Db = defaultDb,
): Promise<RecentReviewRow[]> {
	return await db
		.select({
			id: review.id,
			rating: review.rating,
			confidence: review.confidence,
			stability: review.stability,
			difficulty: review.difficulty,
			state: review.state,
			reviewedAt: review.reviewedAt,
			dueAt: review.dueAt,
			scheduledDays: review.scheduledDays,
		})
		.from(review)
		.where(and(eq(review.cardId, cardId), eq(review.userId, userId)))
		.orderBy(desc(review.reviewedAt))
		.limit(limit);
}

/** Count of cards considered mastered (stability > MASTERY_STABILITY_DAYS). */
export async function getMasteredCount(userId: string, db: Db = defaultDb): Promise<number> {
	const [row] = await db
		.select({ c: count() })
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(
			and(
				eq(cardState.userId, userId),
				eq(card.status, CARD_STATUSES.ACTIVE),
				gt(cardState.stability, MASTERY_STABILITY_DAYS),
			),
		);
	return Number(row?.c ?? 0);
}

/** Summary row for the scenario-detail recent-attempts panel. */
export type RecentAttemptRow = Pick<
	SessionItemResultRow,
	'id' | 'isCorrect' | 'chosenOptionId' | 'confidence' | 'answerMs' | 'completedAt'
>;

/**
 * Load the most recent completed rep attempts for a scenario. Scoped to
 * the caller's user so route handlers can't leak another learner's
 * history. Excludes skipped slots (skipKind IS NOT NULL) and slots still
 * pending completion (completedAt IS NULL) so the list matches what the
 * calibration + accuracy readers count.
 */
export async function getRecentAttemptsForScenario(
	scenarioId: string,
	userId: string,
	limit = 5,
	db: Db = defaultDb,
): Promise<RecentAttemptRow[]> {
	return await db
		.select({
			id: sessionItemResult.id,
			isCorrect: sessionItemResult.isCorrect,
			chosenOptionId: sessionItemResult.chosenOptionId,
			confidence: sessionItemResult.confidence,
			answerMs: sessionItemResult.answerMs,
			completedAt: sessionItemResult.completedAt,
		})
		.from(sessionItemResult)
		.where(
			and(
				eq(sessionItemResult.scenarioId, scenarioId),
				eq(sessionItemResult.userId, userId),
				eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
				isNotNull(sessionItemResult.completedAt),
				isNull(sessionItemResult.skipKind),
				isNotNull(sessionItemResult.isCorrect),
			),
		)
		.orderBy(desc(sessionItemResult.completedAt))
		.limit(limit);
}
