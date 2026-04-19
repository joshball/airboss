/**
 * Scenario BC functions (Decision Reps).
 *
 * Own the scenario lifecycle + rep-attempt recording. No SRS math --
 * scenarios are "attempt, record, move on"; "what to show next" is a simple
 * unattempted-first / least-recent priority on rep_attempt.
 *
 * Inputs are validated here (in addition to the route layer) so cross-BC
 * callers and scripts can't inject invalid values.
 */

import {
	CONTENT_SOURCES,
	type ConfidenceLevel,
	type ContentSource,
	type Difficulty,
	type Domain,
	type PhaseOfFlight,
	REP_BATCH_SIZE,
	REP_DASHBOARD_WINDOW_DAYS,
	SCENARIO_STATUSES,
	type ScenarioStatus,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateRepAttemptId, generateScenarioId } from '@ab/utils';
import { and, count, desc, eq, gte, inArray, type SQL, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type RepAttemptRow, repAttempt, type ScenarioOption, type ScenarioRow, scenario } from './schema';
import { newScenarioSchema, submitAttemptSchema } from './validation';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when a scenario can't be found for the given user. */
export class ScenarioNotFoundError extends Error {
	constructor(
		public readonly scenarioId: string,
		public readonly userId: string,
	) {
		super(`Scenario ${scenarioId} not found for user ${userId}`);
		this.name = 'ScenarioNotFoundError';
	}
}

/** Raised when the user tries to attempt a scenario that isn't active. */
export class ScenarioNotAttemptableError extends Error {
	constructor(
		public readonly scenarioId: string,
		public readonly status: string,
	) {
		super(`Scenario ${scenarioId} is ${status} and cannot be attempted`);
		this.name = 'ScenarioNotAttemptableError';
	}
}

/** Raised when the chosen option id is not present on the scenario. */
export class InvalidOptionError extends Error {
	constructor(
		public readonly scenarioId: string,
		public readonly chosenOption: string,
	) {
		super(`Option ${chosenOption} is not valid for scenario ${scenarioId}`);
		this.name = 'InvalidOptionError';
	}
}

export interface CreateScenarioInput {
	userId: string;
	title: string;
	situation: string;
	options: ScenarioOption[];
	teachingPoint: string;
	domain: Domain;
	difficulty: Difficulty;
	phaseOfFlight?: PhaseOfFlight | null;
	sourceType?: ContentSource;
	sourceRef?: string | null;
	regReferences?: string[];
	isEditable?: boolean;
}

export interface ScenarioFilters {
	domain?: Domain;
	difficulty?: Difficulty;
	phaseOfFlight?: PhaseOfFlight;
	sourceType?: ContentSource;
	status?: ScenarioStatus | ScenarioStatus[];
	limit?: number;
	offset?: number;
}

export interface SubmitAttemptInput {
	scenarioId: string;
	userId: string;
	chosenOption: string;
	confidence?: ConfidenceLevel | null;
	answerMs?: number | null;
}

/** Domain-accuracy row used by dashboard + calibration reads. */
export interface DomainAccuracyStats {
	domain: Domain;
	attempted: number;
	correct: number;
	accuracy: number;
}

export interface RepAccuracyStats {
	attempted: number;
	correct: number;
	accuracy: number;
}

export interface RepDashboardStats {
	scenarioCount: number;
	scenariosByDomain: Array<{ domain: Domain; count: number }>;
	unattemptedCount: number;
	attemptedToday: number;
	accuracyLast30d: RepAccuracyStats;
	domainBreakdown: DomainAccuracyStats[];
}

export interface RepStats {
	attemptCount: number;
	accuracy: number;
	domainBreakdown: DomainAccuracyStats[];
}

/** UTC midnight at the start of the day containing `d`. */
function utcStartOfDay(d: Date): Date {
	return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Create a new scenario. Runs the options validation described in the spec
 * plus the BC-level guards (sourceRef required for non-personal).
 */
export async function createScenario(input: CreateScenarioInput, db: Db = defaultDb): Promise<ScenarioRow> {
	const parsed = newScenarioSchema.parse({
		title: input.title,
		situation: input.situation,
		options: input.options,
		teachingPoint: input.teachingPoint,
		domain: input.domain,
		difficulty: input.difficulty,
		phaseOfFlight: input.phaseOfFlight ?? null,
		sourceType: input.sourceType,
		sourceRef: input.sourceRef,
		regReferences: input.regReferences,
		isEditable: input.isEditable,
	});
	const sourceType = (parsed.sourceType ?? CONTENT_SOURCES.PERSONAL) as ContentSource;
	if (sourceType !== CONTENT_SOURCES.PERSONAL && !parsed.sourceRef) {
		// Same guard the card BC enforces. Keeps non-personal content
		// traceable back to its origin (course, product, import).
		throw new Error('source_ref is required when source_type is not personal');
	}

	const now = new Date();
	const id = generateScenarioId();

	const [inserted] = await db
		.insert(scenario)
		.values({
			id,
			userId: input.userId,
			title: parsed.title,
			situation: parsed.situation,
			// zod's enum widens to string; newScenarioSchema guarantees membership.
			options: parsed.options as ScenarioOption[],
			teachingPoint: parsed.teachingPoint,
			domain: parsed.domain as Domain,
			difficulty: parsed.difficulty as Difficulty,
			phaseOfFlight: (parsed.phaseOfFlight ?? null) as PhaseOfFlight | null,
			sourceType,
			sourceRef: parsed.sourceRef ?? null,
			isEditable: parsed.isEditable ?? sourceType === CONTENT_SOURCES.PERSONAL,
			regReferences: parsed.regReferences ?? [],
			status: SCENARIO_STATUSES.ACTIVE,
			createdAt: now,
		})
		.returning();

	return inserted;
}

/**
 * Browse scenarios for a user with optional filters. Default order: most
 * recently created first. Default status filter: active only.
 */
export async function getScenarios(
	userId: string,
	filters: ScenarioFilters = {},
	db: Db = defaultDb,
): Promise<ScenarioRow[]> {
	const statusFilter = filters.status
		? Array.isArray(filters.status)
			? filters.status
			: [filters.status]
		: [SCENARIO_STATUSES.ACTIVE];

	const clauses: SQL[] = [eq(scenario.userId, userId), inArray(scenario.status, statusFilter)];

	if (filters.domain) clauses.push(eq(scenario.domain, filters.domain));
	if (filters.difficulty) clauses.push(eq(scenario.difficulty, filters.difficulty));
	if (filters.phaseOfFlight) clauses.push(eq(scenario.phaseOfFlight, filters.phaseOfFlight));
	if (filters.sourceType) clauses.push(eq(scenario.sourceType, filters.sourceType));

	let q = db
		.select()
		.from(scenario)
		.where(and(...clauses))
		.orderBy(desc(scenario.createdAt))
		.$dynamic();

	if (filters.limit !== undefined && filters.limit > 0) q = q.limit(filters.limit);
	if (filters.offset !== undefined && filters.offset > 0) q = q.offset(filters.offset);

	return await q;
}

/** Load a single scenario by id scoped to the caller. */
export async function getScenario(scenarioId: string, userId: string, db: Db = defaultDb): Promise<ScenarioRow | null> {
	const [row] = await db
		.select()
		.from(scenario)
		.where(and(eq(scenario.id, scenarioId), eq(scenario.userId, userId)))
		.limit(1);
	return row ?? null;
}

/**
 * Session-builder query: prioritizes scenarios the user has never attempted,
 * then falls back to least-recently-attempted. Applies scenario filters the
 * same way `getScenarios` does.
 *
 * Implemented as a single LEFT JOIN LATERAL on the most recent attempt per
 * scenario, then ordered by (lastAttemptedAt NULLS FIRST, createdAt DESC).
 * Deterministic for a given user + scenario set -- the route layer handles
 * per-display shuffling of options.
 */
export async function getNextScenarios(
	userId: string,
	filters: Omit<ScenarioFilters, 'limit' | 'offset'> = {},
	limit: number = REP_BATCH_SIZE,
	db: Db = defaultDb,
): Promise<ScenarioRow[]> {
	const clauses: SQL[] = [eq(scenario.userId, userId), eq(scenario.status, SCENARIO_STATUSES.ACTIVE)];
	if (filters.domain) clauses.push(eq(scenario.domain, filters.domain));
	if (filters.difficulty) clauses.push(eq(scenario.difficulty, filters.difficulty));
	if (filters.phaseOfFlight) clauses.push(eq(scenario.phaseOfFlight, filters.phaseOfFlight));
	if (filters.sourceType) clauses.push(eq(scenario.sourceType, filters.sourceType));

	// Correlated aggregate is cheaper than a full LATERAL for the expected
	// data volume (tens of scenarios, not thousands). The per-user index on
	// rep_attempt keeps the subquery bounded to the caller's attempts.
	//
	// Both tables expose `id` and `user_id` columns, so the outer scenario
	// column reference inside the subquery MUST be fully qualified -- the
	// drizzle tagged-template serializer emits `${scenario.id}` as a bare
	// `"id"`, which Postgres then binds to rep_attempt.id. Hand-rolled
	// sql.raw fragment keeps the outer reference unambiguous.
	const lastAttempt = sql<Date | null>`(
		SELECT max(${repAttempt.attemptedAt})
		FROM ${repAttempt}
		WHERE ${repAttempt.scenarioId} = ${sql.raw(`"study"."scenario"."id"`)}
		  AND ${repAttempt.userId} = ${userId}
	)`.as('last_attempted_at');

	const rows = await db
		.select({ scenario, lastAttemptedAt: lastAttempt })
		.from(scenario)
		.where(and(...clauses))
		// NULLS FIRST puts unattempted scenarios at the top.
		.orderBy(sql`last_attempted_at ASC NULLS FIRST`, desc(scenario.createdAt))
		.limit(limit);

	return rows.map((r) => r.scenario);
}

/**
 * Record a rep attempt. Resolves correctness from the scenario's options
 * (never trusts the client) and writes one row. No idempotency window like
 * reviews have -- re-attempts of the same scenario are spec-allowed and
 * each is a separate row.
 */
export async function submitAttempt(input: SubmitAttemptInput, db: Db = defaultDb): Promise<RepAttemptRow> {
	const parsed = submitAttemptSchema.parse({
		scenarioId: input.scenarioId,
		chosenOption: input.chosenOption,
		confidence: input.confidence,
		answerMs: input.answerMs,
	});

	const [sc] = await db
		.select()
		.from(scenario)
		.where(and(eq(scenario.id, parsed.scenarioId), eq(scenario.userId, input.userId)))
		.limit(1);
	if (!sc) throw new ScenarioNotFoundError(parsed.scenarioId, input.userId);
	if (sc.status !== SCENARIO_STATUSES.ACTIVE) {
		throw new ScenarioNotAttemptableError(parsed.scenarioId, sc.status);
	}

	const options = sc.options ?? [];
	const chosen = options.find((o) => o.id === parsed.chosenOption);
	if (!chosen) throw new InvalidOptionError(parsed.scenarioId, parsed.chosenOption);

	const now = new Date();
	const [inserted] = await db
		.insert(repAttempt)
		.values({
			id: generateRepAttemptId(),
			scenarioId: parsed.scenarioId,
			userId: input.userId,
			chosenOption: parsed.chosenOption,
			isCorrect: chosen.isCorrect,
			confidence: parsed.confidence ?? null,
			answerMs: parsed.answerMs ?? null,
			attemptedAt: now,
		})
		.returning();

	return inserted;
}

/** Set a scenario's lifecycle status (active/suspended/archived). */
export async function setScenarioStatus(
	scenarioId: string,
	userId: string,
	status: ScenarioStatus,
	db: Db = defaultDb,
): Promise<ScenarioRow> {
	const [updated] = await db
		.update(scenario)
		.set({ status })
		.where(and(eq(scenario.id, scenarioId), eq(scenario.userId, userId)))
		.returning();
	if (!updated) throw new ScenarioNotFoundError(scenarioId, userId);
	return updated;
}

/** Accuracy for all attempts (or a single domain) in the user's history. */
export async function getRepAccuracy(userId: string, domain?: Domain, db: Db = defaultDb): Promise<RepAccuracyStats> {
	const clauses: SQL[] = [eq(repAttempt.userId, userId)];
	if (domain) clauses.push(eq(scenario.domain, domain));

	const [row] = await db
		.select({
			attempted: count(),
			correct: sql<number>`sum(case when ${repAttempt.isCorrect} then 1 else 0 end)`,
		})
		.from(repAttempt)
		.innerJoin(scenario, and(eq(scenario.id, repAttempt.scenarioId), eq(scenario.userId, repAttempt.userId)))
		.where(and(...clauses));

	const attempted = Number(row?.attempted ?? 0);
	const correct = Number(row?.correct ?? 0);
	const accuracy = attempted === 0 ? 0 : correct / attempted;
	return { attempted, correct, accuracy };
}

/** Accuracy stats, grouped by domain, for a user (optional date range). */
export async function getDomainAccuracy(
	userId: string,
	range?: { start?: Date; end?: Date },
	db: Db = defaultDb,
): Promise<DomainAccuracyStats[]> {
	const clauses: SQL[] = [eq(repAttempt.userId, userId)];
	if (range?.start) clauses.push(gte(repAttempt.attemptedAt, range.start));
	if (range?.end) clauses.push(sql`${repAttempt.attemptedAt} <= ${range.end.toISOString()}`);

	const rows = await db
		.select({
			domain: scenario.domain,
			attempted: count(),
			correct: sql<number>`sum(case when ${repAttempt.isCorrect} then 1 else 0 end)`,
		})
		.from(repAttempt)
		.innerJoin(scenario, and(eq(scenario.id, repAttempt.scenarioId), eq(scenario.userId, repAttempt.userId)))
		.where(and(...clauses))
		.groupBy(scenario.domain)
		.orderBy(scenario.domain);

	return rows.map((r) => {
		const attempted = Number(r.attempted);
		const correct = Number(r.correct ?? 0);
		return {
			domain: r.domain as Domain,
			attempted,
			correct,
			accuracy: attempted === 0 ? 0 : correct / attempted,
		};
	});
}

/** Flat rep stats. Thin wrapper the spec calls out for calibration reads. */
export async function getRepStats(
	userId: string,
	range?: { start?: Date; end?: Date },
	db: Db = defaultDb,
): Promise<RepStats> {
	const clauses: SQL[] = [eq(repAttempt.userId, userId)];
	if (range?.start) clauses.push(gte(repAttempt.attemptedAt, range.start));
	if (range?.end) clauses.push(sql`${repAttempt.attemptedAt} <= ${range.end.toISOString()}`);

	const [totalsRow] = await db
		.select({
			attempted: count(),
			correct: sql<number>`sum(case when ${repAttempt.isCorrect} then 1 else 0 end)`,
		})
		.from(repAttempt)
		.where(and(...clauses));

	const domainBreakdown = await getDomainAccuracy(userId, range, db);
	const attempted = Number(totalsRow?.attempted ?? 0);
	const correct = Number(totalsRow?.correct ?? 0);
	return {
		attemptCount: attempted,
		accuracy: attempted === 0 ? 0 : correct / attempted,
		domainBreakdown,
	};
}

/**
 * Dashboard view: scenario counts, attempts today, accuracy over the last
 * 30 days (per spec), and per-domain breakdown over the same window.
 */
export async function getRepDashboard(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<RepDashboardStats> {
	const windowStart = new Date(now.getTime() - REP_DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
	const todayStart = utcStartOfDay(now);

	// Fan out: every query below is independent. Parallel round-trips keep
	// the dashboard responsive even as the scenario library grows.
	const [scenarioCountRow, scenariosByDomainRows, unattemptedRow, attemptedTodayRow, domainWindow] = await Promise.all([
		db
			.select({ c: count() })
			.from(scenario)
			.where(and(eq(scenario.userId, userId), eq(scenario.status, SCENARIO_STATUSES.ACTIVE)))
			.then((r) => r[0]),
		db
			.select({ domain: scenario.domain, c: count() })
			.from(scenario)
			.where(and(eq(scenario.userId, userId), eq(scenario.status, SCENARIO_STATUSES.ACTIVE)))
			.groupBy(scenario.domain)
			.orderBy(scenario.domain),
		db
			.select({ c: count() })
			.from(scenario)
			.where(
				and(
					eq(scenario.userId, userId),
					eq(scenario.status, SCENARIO_STATUSES.ACTIVE),
					// Same "bare id binds to rep_attempt.id" hazard as the session
					// ordering query -- force the outer reference to be fully
					// qualified so the correlated NOT EXISTS actually correlates.
					sql`NOT EXISTS (
						SELECT 1 FROM ${repAttempt}
						WHERE ${repAttempt.scenarioId} = ${sql.raw(`"study"."scenario"."id"`)}
						  AND ${repAttempt.userId} = ${userId}
					)`,
				),
			)
			.then((r) => r[0]),
		db
			.select({ c: count() })
			.from(repAttempt)
			.where(and(eq(repAttempt.userId, userId), gte(repAttempt.attemptedAt, todayStart)))
			.then((r) => r[0]),
		getDomainAccuracy(userId, { start: windowStart, end: now }, db),
	]);

	// accuracyLast30d rolls up the domain breakdown so the headline number
	// matches the per-domain rows under it -- no chance of one saying 80%
	// and the other showing rows that average 75%.
	const windowAttempted = domainWindow.reduce((s, d) => s + d.attempted, 0);
	const windowCorrect = domainWindow.reduce((s, d) => s + d.correct, 0);

	return {
		scenarioCount: Number(scenarioCountRow?.c ?? 0),
		scenariosByDomain: scenariosByDomainRows.map((r) => ({
			domain: r.domain as Domain,
			count: Number(r.c),
		})),
		unattemptedCount: Number(unattemptedRow?.c ?? 0),
		attemptedToday: Number(attemptedTodayRow?.c ?? 0),
		accuracyLast30d: {
			attempted: windowAttempted,
			correct: windowCorrect,
			accuracy: windowAttempted === 0 ? 0 : windowCorrect / windowAttempted,
		},
		domainBreakdown: domainWindow,
	};
}
