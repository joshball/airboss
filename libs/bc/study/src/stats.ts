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
	REVIEW_RATINGS,
	type ReviewRating,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { and, count, eq, gt, gte, lte, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { card, cardState, review } from './schema';

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
	const lookbackStart = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
	const rows = await db
		.selectDistinct({
			day: sql<string>`to_char(date_trunc('day', ${review.reviewedAt} at time zone 'UTC'), 'YYYY-MM-DD')`.as('day'),
		})
		.from(review)
		.where(and(eq(review.userId, userId), gte(review.reviewedAt, lookbackStart)))
		.orderBy(sql`day desc`);

	if (rows.length === 0) return 0;

	let streak = 0;
	let cursorKey = utcDayKey(now);
	for (const row of rows) {
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

	const [dueNowRow] = await db
		.select({ c: count() })
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(and(eq(cardState.userId, userId), lte(cardState.dueAt, now), eq(card.status, CARD_STATUSES.ACTIVE)));

	const [reviewedTodayRow] = await db
		.select({ c: count() })
		.from(review)
		.where(and(eq(review.userId, userId), gte(review.reviewedAt, todayStart)));

	const stateRows = await db
		.select({ state: cardState.state, c: count() })
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(and(eq(cardState.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)))
		.groupBy(cardState.state);

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

	const domains = await getDomainBreakdown(userId, db, now);
	const streakDays = await computeStreakDays(userId, db, now);

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

/** Mastery summary for a user, optionally filtered to one domain. */
export async function getCardMastery(
	userId: string,
	domain?: Domain,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<MasteryStats> {
	const clauses = [eq(card.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)];
	if (domain) clauses.push(eq(card.domain, domain));

	const [totalsRow] = await db
		.select({
			total: count(),
			due: sql<number>`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)`,
			mastered: sql<number>`sum(case when ${cardState.stability} > ${MASTERY_STABILITY_DAYS} then 1 else 0 end)`,
		})
		.from(card)
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.where(and(...clauses));

	const accuracyClauses = [eq(review.userId, userId)];
	if (domain) {
		accuracyClauses.push(eq(card.domain, domain));
	}

	const accuracyRows = await db
		.select({
			total: count(),
			correct: sql<number>`sum(case when ${review.rating} > ${REVIEW_RATINGS.AGAIN} then 1 else 0 end)`,
		})
		.from(review)
		.innerJoin(card, and(eq(card.id, review.cardId), eq(card.userId, review.userId)))
		.where(and(...accuracyClauses));

	const totalReviews = Number(accuracyRows[0]?.total ?? 0);
	const correctReviews = Number(accuracyRows[0]?.correct ?? 0);
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
