/**
 * Cross-BC bridge: sim weakness signal -> per-knowledge-node pressure.
 *
 * `getRecentSimWeakness` (from `@ab/bc-sim/persistence`) produces a
 * per-scenario weakness signal -- one entry per scenario the user has
 * been grading low on in the configured window. This module fans that
 * signal out across the authored `SIM_SCENARIO_NODE_MAPPINGS` so the
 * scheduler can score cards / reps by node id without knowing about
 * scenarios at all.
 *
 * The pure aggregation helper (`aggregateSimNodePressure`) lets unit
 * tests stay DB-free; the DB-aware function (`simWeaknessByNode`)
 * composes it with the sim BC's persistence read.
 */

import { type GetRecentSimWeaknessOptions, getRecentSimWeakness, type SimWeaknessSignal } from '@ab/bc-sim/persistence';
import {
	SIM_SCENARIO_NODE_MAPPINGS,
	type SimScenarioId,
	type SimScenarioIdGraded,
	type SimScenarioNodeLink,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Default mapping argument shape used by `aggregateSimNodePressure`.
 * Exposed so callers (and tests) can supply a custom mapping table -- the
 * BC layer always passes `SIM_SCENARIO_NODE_MAPPINGS`, but a test can
 * stub it.
 */
export type SimScenarioNodeMappings = Readonly<Partial<Record<SimScenarioId, readonly SimScenarioNodeLink[]>>>;

/**
 * Pure aggregation rule: sum each (scenarioWeight * edgeWeight) into the
 * target node, clamp at 1.0. Order-independent, no DB. The clamp prevents
 * a single learner with multiple weak parents on a shared node from
 * drowning every other slice in the strengthen scoring.
 *
 * Scenarios with no mapping row are silently ignored (defensive against
 * scenarios that haven't been authored into the mapping yet, and against
 * playground / playground-pa28 ids if they ever leak through).
 */
export function aggregateSimNodePressure(
	signals: ReadonlyArray<SimWeaknessSignal>,
	mappings: SimScenarioNodeMappings = SIM_SCENARIO_NODE_MAPPINGS,
): Map<string, number> {
	const accum = new Map<string, number>();
	for (const signal of signals) {
		const links = mappings[signal.scenarioId as SimScenarioIdGraded];
		if (!links) continue;
		for (const link of links) {
			const contribution = signal.weight * link.weight;
			const previous = accum.get(link.nodeId) ?? 0;
			accum.set(link.nodeId, previous + contribution);
		}
	}
	for (const [nodeId, raw] of accum) {
		if (raw > 1) accum.set(nodeId, 1);
	}
	return accum;
}

/**
 * Read recent sim weakness for a user, fan it out across the authored
 * mapping, and return per-node pressure clamped to `[0, 1]`. Empty map
 * when the user has no weak scenarios in the window.
 *
 * The `db` parameter passes through to `getRecentSimWeakness`; pool
 * builders in `sessions.ts` thread their own connection so a single
 * preview run uses one transaction-friendly handle.
 */
export async function simWeaknessByNode(
	userId: string,
	options: GetRecentSimWeaknessOptions = {},
	db: Db = defaultDb,
): Promise<Map<string, number>> {
	const signals = await getRecentSimWeakness(userId, options, db);
	return aggregateSimNodePressure(signals);
}
