/**
 * Calibration BC -- read-only aggregation over confidence-tagged data in
 * `study.review` and `study.session_item_result` (rep slots).
 *
 * Owns no tables. Every number the calibration page shows is derived from
 * columns that already exist on review (confidence + rating) and on the rep-
 * kind rows of session_item_result (confidence + is_correct). Cards are
 * "correct" when rating >= GOOD (ts-fsrs treats Again/Hard as failures that
 * schedule a short interval); rep attempts are "correct" when is_correct is
 * true. Per ADR 012, rep_attempt is gone -- session_item_result is the single
 * source of truth for rep outcomes.
 *
 * Buckets with fewer than CALIBRATION_MIN_BUCKET_COUNT data points are excluded
 * from the calibration score but still reported (with a needsMoreData flag)
 * so the UI can show "need more data" placeholders instead of wild
 * single-point percentages.
 */

import {
	CALIBRATION_MIN_BUCKET_COUNT,
	CALIBRATION_TREND_WINDOW_DAYS,
	CONFIDENCE_LEVEL_EXPECTED_ACCURACY,
	CONFIDENCE_LEVEL_VALUES,
	type ConfidenceLevel,
	type Domain,
	REVIEW_RATINGS,
	SESSION_ITEM_KINDS,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { and, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { card, review, scenario, sessionItemResult } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * One row in a calibration read: count, accuracy, and gap.
 *
 * `gap` is `actualAccuracy - expectedAccuracy` so positive gap means the
 * learner got MORE right than their confidence predicted (underconfidence),
 * and negative gap means they overestimated (overconfidence). This matches
 * the chart's "expected 75%, actual 65% -> -10%" direction in the spec.
 */
export interface CalibrationBucket {
	level: ConfidenceLevel;
	count: number;
	correct: number;
	/** Fraction correct; 0 when count === 0. */
	accuracy: number;
	/** Expected accuracy for a well-calibrated learner at this level. */
	expectedAccuracy: number;
	/** actualAccuracy - expectedAccuracy. Negative = overconfident. */
	gap: number;
	/** True when count < CALIBRATION_MIN_BUCKET_COUNT. */
	needsMoreData: boolean;
}

export interface DomainCalibration {
	domain: Domain;
	/** Total confidence-rated items in this domain across buckets meeting the threshold. */
	count: number;
	/** Calibration score (null when no bucket clears the threshold). */
	score: number | null;
	/**
	 * Largest absolute gap across buckets that meet the threshold. Returned
	 * with its signed value so callers know whether the biggest miss is over-
	 * or under-confidence. Null when no bucket clears the threshold.
	 */
	largestGap: { level: ConfidenceLevel; gap: number } | null;
}

export interface CalibrationResult {
	buckets: CalibrationBucket[];
	/**
	 * Total confidence-rated items across all buckets (including those below
	 * the data-completeness threshold). Used to drive the empty state.
	 */
	totalCount: number;
	/**
	 * Mean 1 - |gap| across buckets meeting the CALIBRATION_MIN_BUCKET_COUNT
	 * threshold. Null when no bucket clears the threshold.
	 */
	score: number | null;
	domains: DomainCalibration[];
}

export interface CalibrationTrendPoint {
	/** YYYY-MM-DD (UTC) day key. */
	date: string;
	/** Calibration score over the rolling window ending on this day, or null if sparse. */
	score: number | null;
	/** Total confidence-rated items contributing to the point (all buckets). */
	count: number;
}

/** Shared shape for "one calibration data point, tagged with its domain". */
interface RawPoint {
	confidence: number;
	isCorrect: boolean;
	domain: string;
	occurredAt: Date;
}

/**
 * Raw confidence-tagged points for a user, unioning reviews and rep attempts.
 * Joins to card / scenario solely to pick up the domain; neither side's
 * primary-key columns leak out.
 *
 * Date filtering is applied in-memory after the union because Drizzle's
 * unionAll doesn't compose cleanly with a moving window on two different
 * timestamp columns -- the memory cost is bounded by the per-user indexes.
 */
async function loadPoints(
	userId: string,
	range: { start?: Date; end?: Date } | undefined,
	db: Db,
): Promise<RawPoint[]> {
	const reviewClauses = [eq(review.userId, userId), isNotNull(review.confidence)];
	if (range?.start) reviewClauses.push(gte(review.reviewedAt, range.start));
	if (range?.end) reviewClauses.push(lte(review.reviewedAt, range.end));

	// Rep points now live on session_item_result rows where item_kind = 'rep'.
	// A row counts when it's completed with a real answer (skipKind IS NULL) and
	// carries a confidence rating. The scenario join picks up the domain for
	// per-domain bucketing -- scenarioId is the item target for rep slots.
	const repClauses = [
		eq(sessionItemResult.userId, userId),
		eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
		isNotNull(sessionItemResult.confidence),
		isNotNull(sessionItemResult.isCorrect),
		isNotNull(sessionItemResult.completedAt),
		isNull(sessionItemResult.skipKind),
	];
	if (range?.start) repClauses.push(gte(sessionItemResult.completedAt, range.start));
	if (range?.end) repClauses.push(lte(sessionItemResult.completedAt, range.end));

	const [reviewRows, repRows] = await Promise.all([
		db
			.select({
				confidence: review.confidence,
				rating: review.rating,
				domain: card.domain,
				reviewedAt: review.reviewedAt,
			})
			.from(review)
			.innerJoin(card, and(eq(card.id, review.cardId), eq(card.userId, review.userId)))
			.where(and(...reviewClauses)),
		db
			.select({
				confidence: sessionItemResult.confidence,
				isCorrect: sessionItemResult.isCorrect,
				domain: scenario.domain,
				completedAt: sessionItemResult.completedAt,
			})
			.from(sessionItemResult)
			.innerJoin(
				scenario,
				and(eq(scenario.id, sessionItemResult.scenarioId), eq(scenario.userId, sessionItemResult.userId)),
			)
			.where(and(...repClauses)),
	]);

	const points: RawPoint[] = [];
	for (const r of reviewRows) {
		if (r.confidence === null) continue;
		// FSRS "correct" = rating > AGAIN. Hard/Good/Easy all advance the card
		// on the schedule; Again is the only rating that resets learning.
		points.push({
			confidence: r.confidence,
			isCorrect: r.rating > REVIEW_RATINGS.AGAIN,
			domain: r.domain,
			occurredAt: r.reviewedAt,
		});
	}
	for (const r of repRows) {
		if (r.confidence === null || r.isCorrect === null || r.completedAt === null) continue;
		points.push({
			confidence: r.confidence,
			isCorrect: r.isCorrect,
			domain: r.domain,
			occurredAt: r.completedAt,
		});
	}
	return points;
}

/**
 * Bucket a list of points into 5 CalibrationBuckets, one per confidence level.
 * Deterministic bucket order (1..5) regardless of input order.
 */
function bucket(points: Iterable<{ confidence: number; isCorrect: boolean }>): CalibrationBucket[] {
	const counts = new Map<ConfidenceLevel, { total: number; correct: number }>();
	for (const level of CONFIDENCE_LEVEL_VALUES as ConfidenceLevel[]) {
		counts.set(level, { total: 0, correct: 0 });
	}
	for (const p of points) {
		const level = p.confidence as ConfidenceLevel;
		const b = counts.get(level);
		if (!b) continue; // Out-of-range confidence (schema CHECK prevents this) -- ignore.
		b.total += 1;
		if (p.isCorrect) b.correct += 1;
	}
	return (CONFIDENCE_LEVEL_VALUES as ConfidenceLevel[]).map((level) => {
		const { total, correct } = counts.get(level) ?? { total: 0, correct: 0 };
		const expectedAccuracy = CONFIDENCE_LEVEL_EXPECTED_ACCURACY[level];
		const accuracy = total === 0 ? 0 : correct / total;
		return {
			level,
			count: total,
			correct,
			accuracy,
			expectedAccuracy,
			gap: total === 0 ? 0 : accuracy - expectedAccuracy,
			needsMoreData: total < CALIBRATION_MIN_BUCKET_COUNT,
		};
	});
}

/**
 * Mean 1 - |gap| across buckets that clear the data-completeness threshold.
 * Returns null when no bucket clears it.
 *
 * Why not RMSE or a Brier-score style metric? The spec calls for a 0..1
 * number where 1 = perfect calibration and 0 = maximally miscalibrated. Mean
 * absolute deviation clamped through 1 - gap hits both targets and matches
 * the formula the PRD writes out ("mean absolute difference between predicted
 * confidence (mapped to %) and actual accuracy, per bucket").
 */
function score(buckets: CalibrationBucket[]): number | null {
	const usable = buckets.filter((b) => !b.needsMoreData);
	if (usable.length === 0) return null;
	const sum = usable.reduce((s, b) => s + Math.abs(b.gap), 0);
	return 1 - sum / usable.length;
}

/** Biggest |gap| among threshold-meeting buckets; ties broken by level asc. */
function largestGap(buckets: CalibrationBucket[]): { level: ConfidenceLevel; gap: number } | null {
	let winner: CalibrationBucket | null = null;
	for (const b of buckets) {
		if (b.needsMoreData) continue;
		if (!winner || Math.abs(b.gap) > Math.abs(winner.gap)) {
			winner = b;
		}
	}
	if (!winner) return null;
	return { level: winner.level, gap: winner.gap };
}

/**
 * Top-level calibration read: overall + per-domain. Optional `domain`
 * filters the buckets themselves (used when a caller wants a single-domain
 * view without the summary per-domain array).
 */
export async function getCalibration(
	userId: string,
	opts: { domain?: Domain; range?: { start?: Date; end?: Date } } = {},
	db: Db = defaultDb,
): Promise<CalibrationResult> {
	const points = await loadPoints(userId, opts.range, db);
	const filtered = opts.domain ? points.filter((p) => p.domain === opts.domain) : points;

	const overallBuckets = bucket(filtered);
	const totalCount = filtered.length;
	const overallScore = score(overallBuckets);

	const byDomain = new Map<string, RawPoint[]>();
	for (const p of filtered) {
		const list = byDomain.get(p.domain);
		if (list) list.push(p);
		else byDomain.set(p.domain, [p]);
	}
	const domains: DomainCalibration[] = [];
	for (const [domainKey, domainPoints] of byDomain) {
		const dBuckets = bucket(domainPoints);
		const dScore = score(dBuckets);
		// Per-domain count is the sum of threshold-meeting buckets so a domain
		// with 100 "Maybe" ratings and nothing else doesn't claim a calibration
		// score based on a single bucket.
		const usableCount = dBuckets.filter((b) => !b.needsMoreData).reduce((s, b) => s + b.count, 0);
		domains.push({
			domain: domainKey as Domain,
			count: usableCount,
			score: dScore,
			largestGap: largestGap(dBuckets),
		});
	}
	// Deterministic order for UI.
	domains.sort((a, b) => a.domain.localeCompare(b.domain));

	return {
		buckets: overallBuckets,
		totalCount,
		score: overallScore,
		domains,
	};
}

/**
 * Per-day rolling calibration score for the sparkline.
 *
 * One point per day in the window (most-recent day last). Each point's score
 * is the calibration score over the entire window up to and including that
 * day -- a cumulative reading lets the chart show whether calibration is
 * drifting without the sample-size whiplash a per-day window would have on
 * sparse data.
 *
 * Null score means no bucket on that day had >= CALIBRATION_MIN_BUCKET_COUNT
 * points. The chart renders those days as gaps.
 */
export async function getCalibrationTrend(
	userId: string,
	days: number = CALIBRATION_TREND_WINDOW_DAYS,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<CalibrationTrendPoint[]> {
	const endOfToday = endOfUtcDay(now);
	const windowStart = startOfUtcDay(new Date(endOfToday.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
	const points = await loadPoints(userId, { start: windowStart, end: endOfToday }, db);

	const result: CalibrationTrendPoint[] = [];
	for (let i = 0; i < days; i++) {
		const dayEnd = endOfUtcDay(new Date(windowStart.getTime() + i * 24 * 60 * 60 * 1000));
		const dayKey = dayEnd.toISOString().slice(0, 10);
		// Cumulative: every point whose occurredAt is on or before dayEnd and
		// within the window. Same shape as "calibration so far" through that day.
		const contributing = points.filter((p) => p.occurredAt <= dayEnd);
		const buckets = bucket(contributing);
		result.push({
			date: dayKey,
			score: score(buckets),
			count: contributing.length,
		});
	}
	return result;
}

function startOfUtcDay(d: Date): Date {
	return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function endOfUtcDay(d: Date): Date {
	return new Date(`${d.toISOString().slice(0, 10)}T23:59:59.999Z`);
}

/**
 * Raw count of confidence-tagged data points for a user. Cheap, does not
 * load every row -- used by the route loader to drive the empty state
 * without paying for the full calibration computation.
 */
export async function getCalibrationPointCount(userId: string, db: Db = defaultDb): Promise<number> {
	const [reviewRow, repRow] = await Promise.all([
		db
			.select({ c: sql<number>`count(*)::int` })
			.from(review)
			.where(and(eq(review.userId, userId), isNotNull(review.confidence)))
			.then((r) => r[0]),
		db
			.select({ c: sql<number>`count(*)::int` })
			.from(sessionItemResult)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.confidence),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
				),
			)
			.then((r) => r[0]),
	]);
	return Number(reviewRow?.c ?? 0) + Number(repRow?.c ?? 0);
}
