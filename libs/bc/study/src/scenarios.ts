/**
 * Scenario BC functions (Decision Reps).
 *
 * Owns the scenario lifecycle. Rep outcomes live on session_item_result
 * (ADR 012); aggregations below read the rep-kind slots from there.
 * `submitAttempt` is a pure validator: it resolves the chosen option against
 * the scenario and returns a shaped outcome the caller persists via
 * `recordItemResult` on the slot row.
 *
 * Inputs are validated here (in addition to the route layer) so cross-BC
 * callers and scripts can't inject invalid values.
 */

import {
	CONTENT_SOURCES,
	type ContentSource,
	DEFAULT_USER_TIMEZONE,
	type Difficulty,
	type Domain,
	MS_PER_DAY,
	type PhaseOfFlight,
	REP_BATCH_SIZE,
	REP_DASHBOARD_WINDOW_DAYS,
	SCENARIO_STATUSES,
	type ScenarioStatus,
	SESSION_ITEM_KINDS,
} from '@ab/constants';
import { escapeLikePattern } from '@ab/db';
import { db as defaultDb } from '@ab/db/connection';
import { generateScenarioId, userStartOfDay } from '@ab/utils';
import {
	aliasedTable,
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	or,
	type SQL,
	sql,
} from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type ScenarioOption,
	type ScenarioOptionRow,
	type ScenarioRow,
	scenario,
	scenarioOption,
	sessionItemResult,
} from './schema';
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
		public readonly chosenOptionId: string,
	) {
		super(`Option ${chosenOptionId} is not valid for scenario ${scenarioId}`);
		this.name = 'InvalidOptionError';
	}
}

/**
 * Raised when `sourceType !== 'personal'` but `sourceRef` is missing. Mirrors
 * the identically-named typed error in `cards.ts` so non-personal scenarios
 * and cards produce the same discriminable failure mode for callers.
 */
export class SourceRefRequiredError extends Error {
	constructor() {
		super('source_ref is required when source_type is not personal');
		this.name = 'SourceRefRequiredError';
	}
}

/**
 * Scenario plus its authored options, in `position` order. Returned by
 * `getScenarioWithOptions`, `getScenariosWithOptions`, and `createScenario`
 * so callers reading a scenario for display always see the options together.
 */
export interface ScenarioWithOptions {
	scenario: ScenarioRow;
	options: ScenarioOptionRow[];
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
	/**
	 * Optional knowledge-graph node id. When set, the scenario is attached to
	 * the graph and `getRepAccuracy({ nodeId })` picks it up for node-level
	 * mastery aggregation.
	 */
	nodeId?: string | null;
}

export interface ScenarioFilters {
	domain?: Domain;
	difficulty?: Difficulty;
	phaseOfFlight?: PhaseOfFlight;
	sourceType?: ContentSource;
	status?: ScenarioStatus | ScenarioStatus[];
	/** Free-text search over title + situation. */
	search?: string;
	limit?: number;
	offset?: number;
}

export interface SubmitAttemptInput {
	scenarioId: string;
	userId: string;
	/** Id of the option the learner picked. Must match a `scenario_option.id`. */
	chosenOptionId: string;
	/**
	 * Accepts a raw `number | null` rather than `ConfidenceLevel` so callers
	 * can pass zod's widened return type without a cast; the BC narrows via
	 * `submitAttemptSchema` below which refines against CONFIDENCE_LEVEL_VALUES.
	 */
	confidence?: number | null;
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

/**
 * Create a new scenario. Runs the options validation described in the spec
 * plus the BC-level guards (sourceRef required for non-personal). Writes the
 * scenario row and its options atomically in one transaction; the partial
 * UNIQUE on `scenario_option(scenario_id) WHERE is_correct = true` plus the
 * `(scenario_id, position)` UNIQUE backstop the BC validation at the storage
 * layer.
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
		throw new SourceRefRequiredError();
	}

	const now = new Date();
	const id = generateScenarioId();

	return await db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(scenario)
			.values({
				id,
				userId: input.userId,
				title: parsed.title,
				situation: parsed.situation,
				teachingPoint: parsed.teachingPoint,
				domain: parsed.domain as Domain,
				difficulty: parsed.difficulty as Difficulty,
				phaseOfFlight: (parsed.phaseOfFlight ?? null) as PhaseOfFlight | null,
				sourceType,
				sourceRef: parsed.sourceRef ?? null,
				nodeId: input.nodeId ?? null,
				// Defaults to true for personal content, false for non-personal,
				// matching the cards BC. Non-personal content is either imported
				// or course-authored and should not be edited downstream.
				isEditable: parsed.isEditable ?? sourceType === CONTENT_SOURCES.PERSONAL,
				regReferences: parsed.regReferences ?? [],
				status: SCENARIO_STATUSES.ACTIVE,
				createdAt: now,
			})
			.returning();

		// Namespace the option PK by scenario so authored ids ('a','b','c'
		// across many scenarios) stay collision-free on a single PK column.
		// The pre-migration JSONB blobs used the same letter ids per scenario;
		// the 0008 migration backfills with the same `${scenario_id}__${id}`
		// rule so historical chosen_option text values resolve correctly via
		// the FK rewrite.
		const optionsToInsert = (parsed.options as ScenarioOption[]).map((o, idx) => ({
			id: `${inserted.id}__${o.id}`,
			scenarioId: inserted.id,
			text: o.text,
			isCorrect: o.isCorrect,
			outcome: o.outcome,
			whyNot: o.whyNot,
			position: idx,
		}));
		await tx.insert(scenarioOption).values(optionsToInsert);

		return inserted;
	});
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
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const cond = or(ilike(scenario.title, pattern), ilike(scenario.situation, pattern));
		if (cond) clauses.push(cond);
	}

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

/**
 * Count-only companion to `getScenarios`. Accepts the same filter shape
 * (minus `limit`/`offset`) and returns the total-matching-rows integer the
 * browse page needs for pagination display. Shares clause assembly with
 * `getScenarios` so list and count can't drift.
 */
export async function getScenariosCount(
	userId: string,
	filters: Omit<ScenarioFilters, 'limit' | 'offset'> = {},
	db: Db = defaultDb,
): Promise<number> {
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
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const cond = or(ilike(scenario.title, pattern), ilike(scenario.situation, pattern));
		if (cond) clauses.push(cond);
	}

	const [row] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(scenario)
		.where(and(...clauses));
	return Number(row?.total ?? 0);
}

/**
 * Per-facet bucket counts for the Browse filters. Each facet excludes its
 * own filter so the numbers answer "if I pick this option (keeping my other
 * filters), how many would I see?". Mirrors `getCardsFacetCounts` in shape.
 */
export interface ScenariosFacetCounts {
	domain: Record<string, number>;
	difficulty: Record<string, number>;
	phaseOfFlight: Record<string, number>;
	sourceType: Record<string, number>;
	status: Record<string, number>;
}

export async function getScenariosFacetCounts(
	userId: string,
	filters: Omit<ScenarioFilters, 'limit' | 'offset'> = {},
	db: Db = defaultDb,
): Promise<ScenariosFacetCounts> {
	const baseClauses: SQL[] = [eq(scenario.userId, userId)];
	if (filters.search && filters.search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const cond = or(ilike(scenario.title, pattern), ilike(scenario.situation, pattern));
		if (cond) baseClauses.push(cond);
	}

	const statusFilter = filters.status
		? Array.isArray(filters.status)
			? filters.status
			: [filters.status]
		: [SCENARIO_STATUSES.ACTIVE];

	const withExcept = (exclude: 'domain' | 'difficulty' | 'phaseOfFlight' | 'sourceType' | 'status'): SQL[] => {
		const c = [...baseClauses];
		if (exclude !== 'status') c.push(inArray(scenario.status, statusFilter));
		if (exclude !== 'domain' && filters.domain) c.push(eq(scenario.domain, filters.domain));
		if (exclude !== 'difficulty' && filters.difficulty) c.push(eq(scenario.difficulty, filters.difficulty));
		if (exclude !== 'phaseOfFlight' && filters.phaseOfFlight) c.push(eq(scenario.phaseOfFlight, filters.phaseOfFlight));
		if (exclude !== 'sourceType' && filters.sourceType) c.push(eq(scenario.sourceType, filters.sourceType));
		return c;
	};

	const [domainRows, difficultyRows, phaseRows, sourceRows, statusRows] = await Promise.all([
		db
			.select({ key: scenario.domain, n: sql<number>`count(*)::int` })
			.from(scenario)
			.where(and(...withExcept('domain')))
			.groupBy(scenario.domain),
		db
			.select({ key: scenario.difficulty, n: sql<number>`count(*)::int` })
			.from(scenario)
			.where(and(...withExcept('difficulty')))
			.groupBy(scenario.difficulty),
		db
			.select({ key: scenario.phaseOfFlight, n: sql<number>`count(*)::int` })
			.from(scenario)
			.where(and(...withExcept('phaseOfFlight')))
			.groupBy(scenario.phaseOfFlight),
		db
			.select({ key: scenario.sourceType, n: sql<number>`count(*)::int` })
			.from(scenario)
			.where(and(...withExcept('sourceType')))
			.groupBy(scenario.sourceType),
		db
			.select({ key: scenario.status, n: sql<number>`count(*)::int` })
			.from(scenario)
			.where(and(...withExcept('status')))
			.groupBy(scenario.status),
	]);

	const toRecord = (rows: Array<{ key: string | null; n: number }>): Record<string, number> => {
		const out: Record<string, number> = {};
		for (const r of rows) {
			if (r.key !== null) out[r.key] = Number(r.n);
		}
		return out;
	};

	return {
		domain: toRecord(domainRows),
		difficulty: toRecord(difficultyRows),
		phaseOfFlight: toRecord(phaseRows),
		sourceType: toRecord(sourceRows),
		status: toRecord(statusRows),
	};
}

/** Load a single scenario by id scoped to the caller. Returns the bare
 * scenario row without options. Use `getScenarioWithOptions` when the caller
 * needs the option list (rep render, attempt validation by app code). */
export async function getScenario(scenarioId: string, userId: string, db: Db = defaultDb): Promise<ScenarioRow | null> {
	const [row] = await db
		.select()
		.from(scenario)
		.where(and(eq(scenario.id, scenarioId), eq(scenario.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** Load every option row for a scenario, ordered by `position` ascending. */
export async function getScenarioOptions(scenarioId: string, db: Db = defaultDb): Promise<ScenarioOptionRow[]> {
	return await db
		.select()
		.from(scenarioOption)
		.where(eq(scenarioOption.scenarioId, scenarioId))
		.orderBy(asc(scenarioOption.position));
}

/**
 * Load a scenario plus its authored options in `position` order. Returns
 * `null` when the scenario does not exist for the caller. The companion to
 * `getScenario` for screens that render the options (rep view, browse
 * detail) without making the caller juggle two BC calls.
 */
export async function getScenarioWithOptions(
	scenarioId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<ScenarioWithOptions | null> {
	const sc = await getScenario(scenarioId, userId, db);
	if (!sc) return null;
	const options = await getScenarioOptions(scenarioId, db);
	return { scenario: sc, options };
}

/**
 * Bulk loader: option counts per scenario id. Backs the browse list which
 * shows "N options" without needing the option text. Single GROUP BY query
 * so callers don't fan out N requests.
 */
export async function getScenarioOptionCounts(scenarioIds: string[], db: Db = defaultDb): Promise<Map<string, number>> {
	const result = new Map<string, number>();
	if (scenarioIds.length === 0) return result;
	const rows = await db
		.select({ scenarioId: scenarioOption.scenarioId, c: count() })
		.from(scenarioOption)
		.where(inArray(scenarioOption.scenarioId, scenarioIds))
		.groupBy(scenarioOption.scenarioId);
	for (const r of rows) result.set(r.scenarioId, Number(r.c));
	return result;
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
/** Alias used for the outer scenario table wherever a correlated subquery
 * needs an unambiguous reference to `scenario.id`. Using a constant alias
 * plus `sql.identifier(OUTER_SCENARIO_ALIAS, 'id')` ensures the reference
 * never binds to a column on the inner subquery's table. No schema name
 * hardcoded -- the coupling is on the alias constant, not the string. */
const OUTER_SCENARIO_ALIAS = 'outer_scenario';

/**
 * `"outer_scenario"."id"` as a drizzle sql fragment. Emits qualified
 * identifiers that match the alias drizzle adds via `aliasedTable(
 * scenario, OUTER_SCENARIO_ALIAS)` in the FROM clause, so the correlated
 * subquery's outer reference is stable across schema renames.
 */
const outerScenarioId = sql`${sql.identifier(OUTER_SCENARIO_ALIAS)}.${sql.identifier('id')}`;

export async function getNextScenarios(
	userId: string,
	filters: Omit<ScenarioFilters, 'limit' | 'offset'> = {},
	limit: number = REP_BATCH_SIZE,
	db: Db = defaultDb,
): Promise<ScenarioRow[]> {
	// Alias the FROM so the correlated subquery below can reference
	// `"outer_scenario"."id"` unambiguously. The outer column reference is
	// emitted via `outerScenarioId` above.
	const outerScenario = aliasedTable(scenario, OUTER_SCENARIO_ALIAS);
	const clauses: SQL[] = [eq(outerScenario.userId, userId), eq(outerScenario.status, SCENARIO_STATUSES.ACTIVE)];
	if (filters.domain) clauses.push(eq(outerScenario.domain, filters.domain));
	if (filters.difficulty) clauses.push(eq(outerScenario.difficulty, filters.difficulty));
	if (filters.phaseOfFlight) clauses.push(eq(outerScenario.phaseOfFlight, filters.phaseOfFlight));
	if (filters.sourceType) clauses.push(eq(outerScenario.sourceType, filters.sourceType));

	// Correlated aggregate is cheaper than a full LATERAL for the expected
	// data volume (tens of scenarios, not thousands). The per-user
	// (user_id, item_kind, completed_at) index on session_item_result keeps
	// the subquery bounded to the caller's rep slots.
	const lastAttempt = sql<Date | null>`(
		SELECT max(${sessionItemResult.completedAt})
		FROM ${sessionItemResult}
		WHERE ${sessionItemResult.scenarioId} = ${outerScenarioId}
		  AND ${sessionItemResult.userId} = ${userId}
		  AND ${sessionItemResult.itemKind} = ${SESSION_ITEM_KINDS.REP}
		  AND ${sessionItemResult.completedAt} IS NOT NULL
		  AND ${sessionItemResult.skipKind} IS NULL
	)`.as('last_attempted_at');

	const rows = await db
		.select({ scenario: outerScenario, lastAttemptedAt: lastAttempt })
		.from(outerScenario)
		.where(and(...clauses))
		// NULLS FIRST puts unattempted scenarios at the top. `scenario.id` is
		// the final tiebreaker so scenarios created in the same millisecond
		// (seeders, batch imports) appear in a fully deterministic order.
		.orderBy(sql`last_attempted_at ASC NULLS FIRST`, desc(outerScenario.createdAt), asc(outerScenario.id))
		.limit(limit);

	return rows.map((r) => r.scenario);
}

/**
 * Resolved rep-attempt outcome. Carries exactly the fields the caller needs
 * to persist the result onto a session_item_result row (or to render a
 * response). Per ADR 012 the outcome is computed, never stored independently
 * of the slot.
 */
export interface RepAttemptOutcome {
	scenarioId: string;
	chosenOptionId: string;
	isCorrect: boolean;
	confidence: number | null;
	answerMs: number | null;
}

/**
 * Resolve a rep attempt against its scenario. Returns the server-validated
 * outcome for the caller to persist via `recordItemResult`; no longer
 * writes a standalone row. Post-ADR 012 the slot row on session_item_result
 * is the single place the outcome lives.
 *
 * Validation rules unchanged: the caller's chosen_option must match one of
 * the scenario's options (never trusted from the wire), the scenario must
 * belong to the caller, and it must be in ACTIVE status.
 *
 * Idempotency: double-submits fold at the slot level -- `recordItemResult`
 * updates the existing slot rather than inserting a fresh one, so re-submits
 * on the same (session, slotIndex) collapse inherently. submitAttempt stays
 * pure: it doesn't touch the DB for writes, which means repeated calls are
 * naturally safe.
 */
export async function submitAttempt(input: SubmitAttemptInput, db: Db = defaultDb): Promise<RepAttemptOutcome> {
	const parsed = submitAttemptSchema.parse({
		scenarioId: input.scenarioId,
		chosenOptionId: input.chosenOptionId,
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

	// Look the option up directly by id + scenario_id. The (scenario_id,
	// position) UNIQUE plus the partial UNIQUE on is_correct=true keep the
	// option set clean; we read just the row we need. The scenario_id
	// predicate is the authorization guard -- a chosen_option_id from
	// another scenario won't match here.
	const [chosen] = await db
		.select({ id: scenarioOption.id, isCorrect: scenarioOption.isCorrect })
		.from(scenarioOption)
		.where(and(eq(scenarioOption.id, parsed.chosenOptionId), eq(scenarioOption.scenarioId, parsed.scenarioId)))
		.limit(1);
	if (!chosen) throw new InvalidOptionError(parsed.scenarioId, parsed.chosenOptionId);

	return {
		scenarioId: parsed.scenarioId,
		chosenOptionId: parsed.chosenOptionId,
		isCorrect: chosen.isCorrect,
		confidence: parsed.confidence ?? null,
		answerMs: parsed.answerMs ?? null,
	};
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

/**
 * Accuracy for all attempts in a user's history. Optional filter narrows to a
 * single domain or a single knowledge-graph node (or both). Accepts the legacy
 * `Domain` positional form for backward compatibility with decision-reps
 * callers; new callers should pass the options object.
 */
export async function getRepAccuracy(
	userId: string,
	filterOrDomain?: Domain | { domain?: Domain; nodeId?: string },
	db: Db = defaultDb,
): Promise<RepAccuracyStats> {
	const filter =
		typeof filterOrDomain === 'string' || filterOrDomain === undefined ? { domain: filterOrDomain } : filterOrDomain;

	const clauses: SQL[] = [
		eq(sessionItemResult.userId, userId),
		eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
		isNotNull(sessionItemResult.completedAt),
		isNull(sessionItemResult.skipKind),
		// A completed, non-skipped rep without is_correct shouldn't be counted
		// as "attempted" -- that would deflate accuracy. This is belt-and-braces
		// over the BC write path, which always sets isCorrect for real attempts.
		isNotNull(sessionItemResult.isCorrect),
	];
	if (filter.domain) clauses.push(eq(scenario.domain, filter.domain));
	if (filter.nodeId) clauses.push(eq(scenario.nodeId, filter.nodeId));

	const [row] = await db
		.select({
			attempted: count(),
			// Postgres `FILTER (WHERE ...)` is faster than a portable sum(case when ...).
			correct: sql<number>`count(*) filter (where ${sessionItemResult.isCorrect})`,
		})
		.from(sessionItemResult)
		.innerJoin(
			scenario,
			and(eq(scenario.id, sessionItemResult.scenarioId), eq(scenario.userId, sessionItemResult.userId)),
		)
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
	const clauses: SQL[] = [
		eq(sessionItemResult.userId, userId),
		eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
		isNotNull(sessionItemResult.completedAt),
		isNull(sessionItemResult.skipKind),
		// Same "real attempt" invariant as getRepAccuracy above.
		isNotNull(sessionItemResult.isCorrect),
	];
	if (range?.start) clauses.push(gte(sessionItemResult.completedAt, range.start));
	if (range?.end) clauses.push(sql`${sessionItemResult.completedAt} <= ${range.end.toISOString()}`);

	const rows = await db
		.select({
			domain: scenario.domain,
			attempted: count(),
			// Postgres `FILTER (WHERE ...)` is faster than a portable sum(case when ...).
			correct: sql<number>`count(*) filter (where ${sessionItemResult.isCorrect})`,
		})
		.from(sessionItemResult)
		.innerJoin(
			scenario,
			and(eq(scenario.id, sessionItemResult.scenarioId), eq(scenario.userId, sessionItemResult.userId)),
		)
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
	const clauses: SQL[] = [
		eq(sessionItemResult.userId, userId),
		eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
		isNotNull(sessionItemResult.completedAt),
		isNull(sessionItemResult.skipKind),
		// Same "real attempt" invariant as getRepAccuracy above.
		isNotNull(sessionItemResult.isCorrect),
	];
	if (range?.start) clauses.push(gte(sessionItemResult.completedAt, range.start));
	if (range?.end) clauses.push(sql`${sessionItemResult.completedAt} <= ${range.end.toISOString()}`);

	const [totalsRow] = await db
		.select({
			attempted: count(),
			// Postgres `FILTER (WHERE ...)` is faster than a portable sum(case when ...).
			correct: sql<number>`count(*) filter (where ${sessionItemResult.isCorrect})`,
		})
		.from(sessionItemResult)
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
 *
 * Note on windows: `windowStart` (30-day rolling) feeds `accuracyLast30d`
 * and `domainBreakdown`. `todayStart` (learner's local midnight, computed
 * via `userStartOfDay`) feeds `attemptedToday`. These are intentionally
 * different scopes -- the spec separates "how much work did I do today?"
 * from "how accurate have I been over the last month?".
 *
 * Note on archived scenarios: `unattemptedCount` is "active scenarios with
 * zero attempts in history". If a learner attempts a scenario and later
 * archives it, the archived row disappears from `scenarioCount` but does
 * not affect `unattemptedCount` (the archived row was never in the
 * subquery). Accepted for MVP; future UX can surface archived-but-
 * unattempted rows as a separate count.
 */
export async function getRepDashboard(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
	tz: string = DEFAULT_USER_TIMEZONE,
): Promise<RepDashboardStats> {
	const windowStart = new Date(now.getTime() - REP_DASHBOARD_WINDOW_DAYS * MS_PER_DAY);
	const todayStart = userStartOfDay(now, tz);

	// Single per-domain aggregate over active scenarios that returns:
	//   - total active scenarios per domain (drives scenarioCount + scenariosByDomain)
	//   - unattempted-in-history count per domain (drives unattemptedCount)
	//
	// Previously this was three separate scans over `scenario` for the same
	// active-scenarios predicate. The NOT EXISTS stays correlated against the
	// same row we're aggregating, so the planner still uses
	// `sir_scenario_completed_idx` for the existence probe -- just once, under
	// one group-by. Alias the outer `scenario` so the correlated reference is
	// unambiguously `"outer_scenario"."id"`.
	const dashboardOuter = aliasedTable(scenario, OUTER_SCENARIO_ALIAS);
	const [domainRows, attemptedTodayRow, domainWindow] = await Promise.all([
		db
			.select({
				domain: dashboardOuter.domain,
				total: count(),
				unattempted: sql<number>`sum(case when not exists (
						select 1 from ${sessionItemResult}
						where ${sessionItemResult.scenarioId} = ${outerScenarioId}
						  and ${sessionItemResult.userId} = ${userId}
						  and ${sessionItemResult.itemKind} = ${SESSION_ITEM_KINDS.REP}
						  and ${sessionItemResult.completedAt} is not null
						  and ${sessionItemResult.skipKind} is null
					) then 1 else 0 end)`,
			})
			.from(dashboardOuter)
			.where(and(eq(dashboardOuter.userId, userId), eq(dashboardOuter.status, SCENARIO_STATUSES.ACTIVE)))
			.groupBy(dashboardOuter.domain)
			.orderBy(dashboardOuter.domain),
		db
			.select({ c: count() })
			.from(sessionItemResult)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					gte(sessionItemResult.completedAt, todayStart),
				),
			)
			.then((r) => r[0]),
		getDomainAccuracy(userId, { start: windowStart, end: now }, db),
	]);

	let scenarioCount = 0;
	let unattemptedCount = 0;
	const scenariosByDomain: Array<{ domain: Domain; count: number }> = [];
	for (const row of domainRows) {
		const total = Number(row.total);
		const unattempted = Number(row.unattempted ?? 0);
		scenarioCount += total;
		unattemptedCount += unattempted;
		scenariosByDomain.push({ domain: row.domain as Domain, count: total });
	}

	// accuracyLast30d rolls up the domain breakdown so the headline number
	// matches the per-domain rows under it -- no chance of one saying 80%
	// and the other showing rows that average 75%.
	const windowAttempted = domainWindow.reduce((s, d) => s + d.attempted, 0);
	const windowCorrect = domainWindow.reduce((s, d) => s + d.correct, 0);

	return {
		scenarioCount,
		scenariosByDomain,
		unattemptedCount,
		attemptedToday: Number(attemptedTodayRow?.c ?? 0),
		accuracyLast30d: {
			attempted: windowAttempted,
			correct: windowCorrect,
			accuracy: windowAttempted === 0 ? 0 : windowCorrect / windowAttempted,
		},
		domainBreakdown: domainWindow,
	};
}
