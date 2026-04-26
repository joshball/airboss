/**
 * Sim attempt persistence -- the BC's database-side surface.
 *
 * Pure-physics code (FDM, fault model, scenario runner, grading) stays
 * in this BC's other files and never touches the DB. Persistence helpers
 * live here so the cockpit / horizon / dual / future-server-route call
 * sites have one well-named import to wire when sim auth lands.
 *
 * Today's call sites: none. The sim app has no auth (see
 * `apps/sim/src/hooks.server.ts`), so there is no `userId` to attach to
 * a row. The functions are wired and tested so the wire-up later is one
 * line.
 */

import { SIM_BIAS } from '@ab/constants';
import { db as defaultDb, type SimAttemptRow, simAttempt } from '@ab/db';
import { generateSimAttemptId } from '@ab/utils';
import { and, desc, eq, gte, isNotNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { parseTape, serializeTape } from './replay/tape';
import type { ReplayTape } from './replay/types';
import type { GradeReport } from './scenarios/grading';
import type { ScenarioRunResult } from './types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Input shape for `recordSimAttempt`. Tape is the structured object the
 * worker emits; it gets serialised through the BC's canonical
 * `serializeTape` so the row-vs-buffer hash stays stable across versions.
 */
export interface RecordSimAttemptInput {
	userId: string;
	scenarioId: string;
	result: ScenarioRunResult;
	tape: ReplayTape | null;
	grade: GradeReport | null;
	endedAt?: Date;
}

/**
 * Insert one `sim_attempt` row for a completed flight. Returns the
 * persisted row. Any existing attempts for the same user+scenario are
 * left in place -- history is append-only; trim to "last attempt"
 * client-side via `loadLatestSimAttempt` when only the most recent one
 * is interesting.
 */
export async function recordSimAttempt(input: RecordSimAttemptInput, db: Db = defaultDb): Promise<SimAttemptRow> {
	const id = generateSimAttemptId();
	const endedAt = input.endedAt ?? new Date();
	const tapeJson = input.tape ? JSON.parse(serializeTape(input.tape)) : null;
	const [row] = await db
		.insert(simAttempt)
		.values({
			id,
			userId: input.userId,
			scenarioId: input.scenarioId,
			outcome: input.result.outcome,
			reason: input.result.reason,
			elapsedSeconds: input.result.elapsedSeconds,
			gradeTotal: input.grade?.total ?? null,
			grade: input.grade ?? null,
			tape: tapeJson,
			endedAt,
		})
		.returning();
	if (!row) {
		throw new Error('recordSimAttempt: insert returned no row');
	}
	return row;
}

/**
 * Load the most recent attempt for a user+scenario, or `null` if the
 * user has never flown that scenario. Used by the dashboard / debrief
 * "last attempt" surface.
 */
export async function loadLatestSimAttempt(
	userId: string,
	scenarioId: string,
	db: Db = defaultDb,
): Promise<SimAttemptRow | null> {
	const rows = await db
		.select()
		.from(simAttempt)
		.where(and(eq(simAttempt.userId, userId), eq(simAttempt.scenarioId, scenarioId)))
		.orderBy(desc(simAttempt.endedAt))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * List recent attempts for one user, newest first. `limit` defaults to
 * 50 so a noisy training session does not produce a 10MB payload.
 *
 * The `tape` column is excluded -- callers that need the tape for one
 * row should call `loadSimAttempt(id)`. Loading 50 multi-MB tapes for a
 * dashboard list is unnecessary.
 */
export async function listRecentSimAttempts(
	userId: string,
	limit = 50,
	db: Db = defaultDb,
): Promise<ReadonlyArray<Omit<SimAttemptRow, 'tape'>>> {
	const rows = await db
		.select({
			id: simAttempt.id,
			userId: simAttempt.userId,
			scenarioId: simAttempt.scenarioId,
			outcome: simAttempt.outcome,
			reason: simAttempt.reason,
			elapsedSeconds: simAttempt.elapsedSeconds,
			gradeTotal: simAttempt.gradeTotal,
			grade: simAttempt.grade,
			endedAt: simAttempt.endedAt,
			createdAt: simAttempt.createdAt,
			updatedAt: simAttempt.updatedAt,
		})
		.from(simAttempt)
		.where(eq(simAttempt.userId, userId))
		.orderBy(desc(simAttempt.endedAt))
		.limit(limit);
	return rows;
}

/**
 * Load one attempt by id, including the full tape. Returns null when
 * the row does not exist or belongs to a different user (caller passes
 * the requesting user; ownership check guards against URL guessing).
 */
export async function loadSimAttempt(id: string, userId: string, db: Db = defaultDb): Promise<SimAttemptRow | null> {
	const rows = await db
		.select()
		.from(simAttempt)
		.where(and(eq(simAttempt.id, id), eq(simAttempt.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Re-parse a stored tape back into a ReplayTape. The DB stores it as
 * JSONB; the BC's tape format has version + hash invariants that
 * `parseTape` enforces. Returns null when the row has no tape (aborted
 * runs, or an older row missing the column).
 */
export function tapeFromRow(row: Pick<SimAttemptRow, 'tape'>): ReplayTape | null {
	if (row.tape === null || row.tape === undefined) return null;
	return parseTape(JSON.stringify(row.tape));
}

/** Per-scenario weakness signal returned by `getRecentSimWeakness`. */
export interface SimWeaknessSignal {
	scenarioId: string;
	/** Number of attempts considered (capped by `maxAttemptsPerScenario`). */
	attempts: number;
	/** Average grade total across the considered attempts (0..1). */
	avgGradeTotal: number;
	/** Weight in [0..1]; higher = the scheduler should pressure related cards more. */
	weight: number;
}

export interface GetRecentSimWeaknessOptions {
	/** Cutoff for "recent". Defaults to `now - SIM_BIAS.DEFAULT_WINDOW_DAYS`. */
	since?: Date;
	/** Max attempts considered per scenario; defaults to `SIM_BIAS.DEFAULT_MAX_ATTEMPTS_PER_SCENARIO`. */
	maxAttemptsPerScenario?: number;
	/** Override the poor-grade threshold; defaults to `SIM_BIAS.POOR_THRESHOLD`. */
	poorThreshold?: number;
}

/**
 * Read-only spaced-rep signal: which scenarios has the user been flying
 * poorly recently?
 *
 * Returns one entry per scenario with at least
 * `SIM_BIAS.MIN_ATTEMPTS` attempts in the window whose average grade
 * total is at or below the poor threshold. Weight scales linearly from
 * `WEIGHT_FLOOR` (at the threshold) to 1.0 (at zero); a scenario that
 * is in the window but grading well returns nothing.
 *
 * Designed for cross-BC consumption by the study scheduler. Study
 * imports this from `@ab/bc-sim/persistence` (deep import; not
 * re-exported from the package index, mirroring the rest of the
 * persistence surface).
 *
 * Authoring the actual sim-scenario -> study-card mapping is a
 * separate work-package -- this fn produces the signal; the consumer
 * decides what to do with it.
 */
export async function getRecentSimWeakness(
	userId: string,
	options: GetRecentSimWeaknessOptions = {},
	db: Db = defaultDb,
): Promise<ReadonlyArray<SimWeaknessSignal>> {
	const since = options.since ?? new Date(Date.now() - SIM_BIAS.DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
	const maxPerScenario = options.maxAttemptsPerScenario ?? SIM_BIAS.DEFAULT_MAX_ATTEMPTS_PER_SCENARIO;
	const poorThreshold = options.poorThreshold ?? SIM_BIAS.POOR_THRESHOLD;

	const rows = await db
		.select({
			scenarioId: simAttempt.scenarioId,
			gradeTotal: simAttempt.gradeTotal,
			endedAt: simAttempt.endedAt,
		})
		.from(simAttempt)
		.where(and(eq(simAttempt.userId, userId), gte(simAttempt.endedAt, since), isNotNull(simAttempt.gradeTotal)))
		.orderBy(desc(simAttempt.endedAt));

	const buckets = new Map<string, { sum: number; count: number }>();
	for (const row of rows) {
		const grade = row.gradeTotal;
		if (grade === null) continue;
		const bucket = buckets.get(row.scenarioId) ?? { sum: 0, count: 0 };
		if (bucket.count >= maxPerScenario) continue;
		bucket.sum += grade;
		bucket.count += 1;
		buckets.set(row.scenarioId, bucket);
	}

	const signals: SimWeaknessSignal[] = [];
	for (const [scenarioId, bucket] of buckets) {
		if (bucket.count < SIM_BIAS.MIN_ATTEMPTS) continue;
		const avg = bucket.sum / bucket.count;
		if (avg > poorThreshold) continue;
		// Linear ramp: at threshold -> WEIGHT_FLOOR, at zero -> 1.0.
		// Clamped to [WEIGHT_FLOOR, 1].
		const span = poorThreshold > 0 ? (poorThreshold - avg) / poorThreshold : 0;
		const weight = Math.max(
			SIM_BIAS.WEIGHT_FLOOR,
			Math.min(1, SIM_BIAS.WEIGHT_FLOOR + (1 - SIM_BIAS.WEIGHT_FLOOR) * span),
		);
		signals.push({ scenarioId, attempts: bucket.count, avgGradeTotal: avg, weight });
	}

	signals.sort((a, b) => b.weight - a.weight);
	return signals;
}
