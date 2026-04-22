/**
 * Dashboard BC aggregations.
 *
 * Consumer-facing aggregates for the Learning Dashboard (`/dashboard`). Every
 * function is a read-only query over existing tables -- no new schema, no
 * persisted snapshots. `getDashboardPayload` is the single entry point the
 * route load function calls; internally it fans out to the per-panel queries
 * via `Promise.all` so the total wait is the slowest single query.
 *
 * Per-panel error isolation: individual queries can throw without blanking the
 * whole page. The aggregator wraps each call in a try/catch and returns a
 * `{ value }` or `{ error }` tuple per panel; the view renders the error
 * inline for the affected panel and the rest render normally.
 */

import {
	ACTIVITY_WINDOW_DAYS,
	CARD_STATUSES,
	type Domain,
	OVERDUE_GRACE_MS,
	REVIEW_RATINGS,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	WEAK_AREA_ACCURACY_THRESHOLD,
	WEAK_AREA_LIMIT,
	WEAK_AREA_MIN_DATA_POINTS,
	WEAK_AREA_WINDOW_DAYS,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { and, count, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type CalibrationResult, getCalibration } from './calibration';
import { type CertProgress, type DomainCertRow, getCertProgress, getDomainCertMatrix } from './knowledge';
import { getActivePlan } from './plans';
import { card, cardState, review, type StudyPlanRow, scenario, sessionItemResult } from './schema';
import { type DashboardStats, getDashboardStats } from './stats';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Per-domain rep backlog row for the scheduled-reps panel. */
export interface RepBacklogDomain {
	domain: Domain;
	unattempted: number;
	totalAttempts: number;
}

export interface RepBacklog {
	/** Scenarios the user has never attempted (candidates for a fresh session). */
	unattempted: number;
	/** Total active scenarios regardless of attempt history. */
	totalActive: number;
	byDomain: RepBacklogDomain[];
}

export interface ActivityDay {
	/** UTC day key, YYYY-MM-DD. */
	day: string;
	reviews: number;
	attempts: number;
}

export interface RecentActivity {
	days: ActivityDay[];
	/** Total reviews + attempts across the window. */
	total: number;
	/** Consecutive UTC days ending today with at least one review or attempt. */
	streakDays: number;
	/** Average items/day over the window (float). */
	averagePerDay: number;
}

export type WeakAreaReason =
	| { kind: 'card-accuracy'; accuracy: number; dataPoints: number }
	| { kind: 'rep-accuracy'; accuracy: number; dataPoints: number }
	| { kind: 'overdue'; overdueCount: number; activeCards: number };

export interface WeakArea {
	domain: Domain;
	reasons: WeakAreaReason[];
	/** Primary link target -- cards if overdue/card-accuracy dominates, reps otherwise. */
	link: 'cards' | 'reps';
	/** Raw rank score (higher = weaker). Surfaced for debugging/tests. */
	score: number;
}

/** One panel's payload -- value when the query succeeded, error when it threw. */
export type PanelResult<T> = { value: T } | { error: string };

export interface DashboardPayload {
	stats: PanelResult<DashboardStats>;
	repBacklog: PanelResult<RepBacklog>;
	weakAreas: PanelResult<WeakArea[]>;
	activity: PanelResult<RecentActivity>;
	/** Active study plan (null when the user has none). Drives the CTA + plan panels. */
	activePlan: PanelResult<StudyPlanRow | null>;
	/** Calibration aggregate for the dashboard summary panel. */
	calibration: PanelResult<CalibrationResult>;
	/** Per-cert node counts + mastery for the cert-progress panel. */
	certProgress: PanelResult<CertProgress[]>;
	/** Domain x cert mastery grid for the map panel. */
	domainCertMatrix: PanelResult<DomainCertRow[]>;
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
 * Scheduled-reps backlog. Active scenarios split into attempted vs never-
 * attempted, grouped by domain. Empty for a user with no scenarios.
 *
 * Uses a single aggregation over scenario LEFT JOIN session_item_result
 * (item_kind='rep', completed, not skipped) so each scenario shows up
 * exactly once, with its attempt count driving the unattempted/attempted
 * split. No second round-trip.
 */
export async function getRepBacklog(userId: string, db: Db = defaultDb): Promise<RepBacklog> {
	const rows = await db
		.select({
			domain: scenario.domain,
			scenarioId: scenario.id,
			attemptCount: count(sessionItemResult.id),
		})
		.from(scenario)
		.leftJoin(
			sessionItemResult,
			and(
				eq(sessionItemResult.scenarioId, scenario.id),
				eq(sessionItemResult.userId, scenario.userId),
				eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
				isNotNull(sessionItemResult.completedAt),
				isNull(sessionItemResult.skipKind),
			),
		)
		.where(and(eq(scenario.userId, userId), eq(scenario.status, SCENARIO_STATUSES.ACTIVE)))
		.groupBy(scenario.domain, scenario.id);

	const byDomainMap = new Map<Domain, RepBacklogDomain>();
	let totalActive = 0;
	let unattempted = 0;
	for (const row of rows) {
		const domain = row.domain as Domain;
		const attempts = Number(row.attemptCount);
		const bucket = byDomainMap.get(domain) ?? { domain, unattempted: 0, totalAttempts: 0 };
		if (attempts === 0) bucket.unattempted += 1;
		bucket.totalAttempts += attempts;
		byDomainMap.set(domain, bucket);
		totalActive += 1;
		if (attempts === 0) unattempted += 1;
	}

	// Sort unattempted-heavy domains first so the panel emphasises work the
	// learner has never touched. Ties broken by total attempts desc, then
	// alphabetical for a stable order in tests/snapshots.
	const byDomain = Array.from(byDomainMap.values()).sort((a, b) => {
		if (b.unattempted !== a.unattempted) return b.unattempted - a.unattempted;
		if (b.totalAttempts !== a.totalAttempts) return b.totalAttempts - a.totalAttempts;
		return a.domain.localeCompare(b.domain);
	});

	return { unattempted, totalActive, byDomain };
}

/**
 * Per-day sparkline data for the activity panel, covering the last `days`
 * UTC calendar days (ending today inclusive). Always returns exactly `days`
 * elements -- missing days are filled with zeros so the view renders a
 * continuous axis.
 *
 * Streak is consecutive UTC days ending today with at least one review or
 * attempt. Counts both card reviews and rep attempts, so a day with only
 * rep attempts still keeps the streak alive.
 */
export async function getRecentActivity(
	userId: string,
	days: number = ACTIVITY_WINDOW_DAYS,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<RecentActivity> {
	const todayKey = utcDayKey(now);
	// Window starts at UTC midnight `days - 1` days before today, inclusive.
	const todayStart = utcStartOfDay(now);
	const windowStart = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

	// Grouped-by-day pulls for reviews and attempts. Each query hits an
	// already-indexed (userId, timestamp) path.
	const [reviewRows, attemptRows] = await Promise.all([
		db
			.select({
				day: sql<string>`to_char(date_trunc('day', ${review.reviewedAt} at time zone 'UTC'), 'YYYY-MM-DD')`.as('day'),
				c: count(),
			})
			.from(review)
			.where(and(eq(review.userId, userId), gte(review.reviewedAt, windowStart)))
			.groupBy(sql`day`),
		db
			.select({
				day: sql<string>`to_char(date_trunc('day', ${sessionItemResult.completedAt} at time zone 'UTC'), 'YYYY-MM-DD')`.as(
					'day',
				),
				c: count(),
			})
			.from(sessionItemResult)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					gte(sessionItemResult.completedAt, windowStart),
				),
			)
			.groupBy(sql`day`),
	]);

	const reviewByDay = new Map<string, number>();
	for (const r of reviewRows) reviewByDay.set(r.day, Number(r.c));
	const attemptByDay = new Map<string, number>();
	for (const r of attemptRows) attemptByDay.set(r.day, Number(r.c));

	// Build the fixed-length day array from oldest -> newest.
	const out: ActivityDay[] = [];
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
		const key = utcDayKey(d);
		out.push({
			day: key,
			reviews: reviewByDay.get(key) ?? 0,
			attempts: attemptByDay.get(key) ?? 0,
		});
	}

	const total = out.reduce((s, d) => s + d.reviews + d.attempts, 0);
	const averagePerDay = days === 0 ? 0 : total / days;

	// Streak: walk backwards from today while both sources contribute zero.
	// Reviews-only streak is also covered because attempts can be 0.
	let streakDays = 0;
	let cursorKey = todayKey;
	for (let i = 0; i < 366; i++) {
		const inWindowDay = out.find((d) => d.day === cursorKey);
		const reviewsHere = inWindowDay ? inWindowDay.reviews : (reviewByDay.get(cursorKey) ?? 0);
		const attemptsHere = inWindowDay ? inWindowDay.attempts : (attemptByDay.get(cursorKey) ?? 0);
		if (reviewsHere + attemptsHere > 0) {
			streakDays += 1;
			const next = new Date(`${cursorKey}T00:00:00.000Z`);
			next.setUTCDate(next.getUTCDate() - 1);
			cursorKey = utcDayKey(next);
			continue;
		}
		break;
	}

	// When the streak might extend before the sparkline window, fall back to
	// a full 1-year lookup so the number is honest. Single DISTINCT query.
	if (streakDays === days && days > 0) {
		streakDays = await extendedStreak(userId, db, now);
	}

	return { days: out, total, streakDays, averagePerDay };
}

/**
 * Full-history streak fallback for when today + the sparkline window have
 * activity every day and the streak might extend before it. Scans the last
 * 366 distinct UTC review/attempt days and walks backwards.
 */
async function extendedStreak(userId: string, db: Db, now: Date): Promise<number> {
	const lookbackStart = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
	const rows = await db
		.select({
			day: sql<string>`to_char(dt, 'YYYY-MM-DD')`.as('day'),
		})
		.from(
			sql`(
				SELECT date_trunc('day', ${review.reviewedAt} at time zone 'UTC') AS dt
				FROM ${review}
				WHERE ${review.userId} = ${userId} AND ${review.reviewedAt} >= ${lookbackStart}
				UNION
				SELECT date_trunc('day', ${sessionItemResult.completedAt} at time zone 'UTC') AS dt
				FROM ${sessionItemResult}
				WHERE ${sessionItemResult.userId} = ${userId}
				  AND ${sessionItemResult.itemKind} = ${SESSION_ITEM_KINDS.REP}
				  AND ${sessionItemResult.completedAt} IS NOT NULL
				  AND ${sessionItemResult.skipKind} IS NULL
				  AND ${sessionItemResult.completedAt} >= ${lookbackStart}
			) activity_days`,
		)
		.groupBy(sql`dt`)
		.orderBy(sql`dt desc`);

	if (rows.length === 0) return 0;

	const todayKey = utcDayKey(now);
	let cursorKey = todayKey;
	let streak = 0;
	for (const row of rows) {
		if (row.day === cursorKey) {
			streak += 1;
			const next = new Date(`${cursorKey}T00:00:00.000Z`);
			next.setUTCDate(next.getUTCDate() - 1);
			cursorKey = utcDayKey(next);
		} else if (row.day < cursorKey) {
			break;
		}
	}
	return streak;
}

/**
 * Identify the top N weak domains based on card accuracy, rep accuracy, and
 * overdue card load in the last {@link WEAK_AREA_WINDOW_DAYS} days.
 *
 * Formula (see design.md):
 *   for each domain with >= WEAK_AREA_MIN_DATA_POINTS (reviews + attempts):
 *     card_weakness = max(0, threshold - card_accuracy)
 *     rep_weakness  = max(0, threshold - rep_accuracy)
 *     overdue_load  = overdue_card_count / max(1, active_cards_in_domain)
 *     score         = 2 * card_weakness + 2 * rep_weakness + overdue_load
 *
 * A domain with insufficient data is skipped entirely (empty-state behavior).
 * Ordering: score desc, then domain asc for a stable tiebreaker.
 */
export async function getWeakAreas(
	userId: string,
	limit: number = WEAK_AREA_LIMIT,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<WeakArea[]> {
	const windowStart = new Date(now.getTime() - WEAK_AREA_WINDOW_DAYS * 24 * 60 * 60 * 1000);
	const overdueCutoff = new Date(now.getTime() - OVERDUE_GRACE_MS);

	const [cardRows, repRows, overdueRows] = await Promise.all([
		// Card accuracy by domain. review.userId + review.reviewedAt is indexed;
		// joining back to card filters to active cards only.
		db
			.select({
				domain: card.domain,
				total: count(),
				correct: sql<number>`sum(case when ${review.rating} > ${REVIEW_RATINGS.AGAIN} then 1 else 0 end)`,
			})
			.from(review)
			.innerJoin(card, and(eq(card.id, review.cardId), eq(card.userId, review.userId)))
			.where(and(eq(review.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE), gte(review.reviewedAt, windowStart)))
			.groupBy(card.domain),
		// Rep accuracy by domain. Reads from the rep-kind session_item_result
		// slots (completed, not skipped) joined to scenario for the domain.
		db
			.select({
				domain: scenario.domain,
				total: count(),
				correct: sql<number>`sum(case when ${sessionItemResult.isCorrect} then 1 else 0 end)`,
			})
			.from(sessionItemResult)
			.innerJoin(
				scenario,
				and(eq(scenario.id, sessionItemResult.scenarioId), eq(scenario.userId, sessionItemResult.userId)),
			)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					gte(sessionItemResult.completedAt, windowStart),
				),
			)
			.groupBy(scenario.domain),
		// Overdue card load per domain. Active only; only counts cards past
		// the grace period so a single missed review doesn't ding a domain.
		db
			.select({
				domain: card.domain,
				active: count(),
				overdue: sql<number>`sum(case when ${cardState.dueAt} <= ${overdueCutoff.toISOString()} then 1 else 0 end)`,
			})
			.from(card)
			.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
			.where(and(eq(card.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)))
			.groupBy(card.domain),
	]);

	// Stitch the three signals together per-domain. Keys come from any source
	// so a domain with only overdue cards (no recent reviews/attempts) can't
	// sneak in with < min data points, but neither can a domain with plenty
	// of reviews and no cards anywhere sneak out.
	interface Aggregate {
		domain: Domain;
		reviewTotal: number;
		reviewCorrect: number;
		attemptTotal: number;
		attemptCorrect: number;
		activeCards: number;
		overdue: number;
	}
	const bucket = new Map<Domain, Aggregate>();
	const get = (d: Domain): Aggregate => {
		let row = bucket.get(d);
		if (!row) {
			row = {
				domain: d,
				reviewTotal: 0,
				reviewCorrect: 0,
				attemptTotal: 0,
				attemptCorrect: 0,
				activeCards: 0,
				overdue: 0,
			};
			bucket.set(d, row);
		}
		return row;
	};

	for (const r of cardRows) {
		const row = get(r.domain as Domain);
		row.reviewTotal += Number(r.total);
		row.reviewCorrect += Number(r.correct ?? 0);
	}
	for (const r of repRows) {
		const row = get(r.domain as Domain);
		row.attemptTotal += Number(r.total);
		row.attemptCorrect += Number(r.correct ?? 0);
	}
	for (const r of overdueRows) {
		const row = get(r.domain as Domain);
		row.activeCards += Number(r.active);
		row.overdue += Number(r.overdue ?? 0);
	}

	const weak: WeakArea[] = [];
	for (const agg of bucket.values()) {
		const dataPoints = agg.reviewTotal + agg.attemptTotal;
		if (dataPoints < WEAK_AREA_MIN_DATA_POINTS) continue;

		const cardAccuracy = agg.reviewTotal === 0 ? 1 : agg.reviewCorrect / agg.reviewTotal;
		const repAccuracy = agg.attemptTotal === 0 ? 1 : agg.attemptCorrect / agg.attemptTotal;
		const cardWeakness = Math.max(0, WEAK_AREA_ACCURACY_THRESHOLD - cardAccuracy);
		const repWeakness = Math.max(0, WEAK_AREA_ACCURACY_THRESHOLD - repAccuracy);
		const overdueLoad = agg.overdue === 0 ? 0 : agg.overdue / Math.max(1, agg.activeCards);

		const score = 2 * cardWeakness + 2 * repWeakness + overdueLoad;
		if (score <= 0) continue;

		const reasons: WeakAreaReason[] = [];
		if (agg.reviewTotal > 0 && cardAccuracy < WEAK_AREA_ACCURACY_THRESHOLD) {
			reasons.push({ kind: 'card-accuracy', accuracy: cardAccuracy, dataPoints: agg.reviewTotal });
		}
		if (agg.attemptTotal > 0 && repAccuracy < WEAK_AREA_ACCURACY_THRESHOLD) {
			reasons.push({ kind: 'rep-accuracy', accuracy: repAccuracy, dataPoints: agg.attemptTotal });
		}
		if (agg.overdue > 0) {
			reasons.push({ kind: 'overdue', overdueCount: agg.overdue, activeCards: agg.activeCards });
		}
		if (reasons.length === 0) continue;

		// Prefer the memory link when card signals dominate; prefer reps when
		// rep accuracy is the heaviest component. Ties go to memory because
		// the overdue load only makes sense in the cards browser.
		const link: 'cards' | 'reps' = repWeakness > cardWeakness && agg.overdue === 0 ? 'reps' : 'cards';

		weak.push({ domain: agg.domain, reasons, link, score });
	}

	weak.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return a.domain.localeCompare(b.domain);
	});

	return weak.slice(0, Math.max(0, limit));
}

/**
 * Panel fetchers, injectable for tests. Production callers use the defaults.
 * Exposed so the Promise.allSettled wiring can be exercised without requiring
 * the real BC functions to be mock-friendly at the module level.
 */
export interface DashboardFetchers {
	stats(userId: string, db: Db, now: Date): Promise<DashboardStats>;
	repBacklog(userId: string, db: Db): Promise<RepBacklog>;
	weakAreas(userId: string, db: Db, now: Date): Promise<WeakArea[]>;
	activity(userId: string, db: Db, now: Date): Promise<RecentActivity>;
	activePlan(userId: string, db: Db): Promise<StudyPlanRow | null>;
	calibration(userId: string, db: Db): Promise<CalibrationResult>;
	certProgress(userId: string, db: Db): Promise<CertProgress[]>;
	domainCertMatrix(userId: string, db: Db): Promise<DomainCertRow[]>;
}

const defaultFetchers: DashboardFetchers = {
	stats: (userId, db, now) => getDashboardStats(userId, db, now),
	repBacklog: (userId, db) => getRepBacklog(userId, db),
	weakAreas: (userId, db, now) => getWeakAreas(userId, WEAK_AREA_LIMIT, db, now),
	activity: (userId, db, now) => getRecentActivity(userId, ACTIVITY_WINDOW_DAYS, db, now),
	activePlan: (userId, db) => getActivePlan(userId, db),
	calibration: (userId, db) => getCalibration(userId, {}, db),
	certProgress: (userId, db) => getCertProgress(userId, db),
	domainCertMatrix: (userId, db) => getDomainCertMatrix(userId, db),
};

/**
 * Fan out every panel query for the learning dashboard. Each query runs in
 * parallel via `Promise.allSettled` so a single failure can't cascade. Errors
 * per panel become `{ error: message }` tuples the view renders inline.
 *
 * `fetchers` is injectable for tests; production callers should omit it.
 */
export async function getDashboardPayload(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
	fetchers: DashboardFetchers = defaultFetchers,
): Promise<DashboardPayload> {
	const [stats, repBacklog, weakAreas, activity, activePlan, calibration, certProgress, domainCertMatrix] =
		await Promise.allSettled([
			fetchers.stats(userId, db, now),
			fetchers.repBacklog(userId, db),
			fetchers.weakAreas(userId, db, now),
			fetchers.activity(userId, db, now),
			fetchers.activePlan(userId, db),
			fetchers.calibration(userId, db),
			fetchers.certProgress(userId, db),
			fetchers.domainCertMatrix(userId, db),
		]);

	function toResult<T>(r: PromiseSettledResult<T>): PanelResult<T> {
		if (r.status === 'fulfilled') return { value: r.value };
		const err = r.reason;
		const message = err instanceof Error ? err.message : String(err);
		return { error: message };
	}

	return {
		stats: toResult(stats),
		repBacklog: toResult(repBacklog),
		weakAreas: toResult(weakAreas),
		activity: toResult(activity),
		activePlan: toResult(activePlan),
		calibration: toResult(calibration),
		certProgress: toResult(certProgress),
		domainCertMatrix: toResult(domainCertMatrix),
	};
}

/** Utility for route-level helpers -- checks if a card is past its overdue grace. */
export function overdueCutoff(now: Date = new Date()): Date {
	return new Date(now.getTime() - OVERDUE_GRACE_MS);
}
