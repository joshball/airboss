/**
 * Engine targeting -- the bridge between learner intent (the goal model) and
 * the session engine's filter contract.
 *
 * Pre-cutover the engine read targeting straight off `study_plan.cert_goals`
 * + `focus_domains` / `skip_domains` / `skip_nodes`. Post-cutover the engine
 * reads from the user's primary `goal` instead. This module owns the read
 * order and the dual-read telemetry that drives the trigger condition for
 * dropping `study_plan.cert_goals`.
 *
 * Read order (per `engine-goal-cutover` spec):
 *
 *   1. Primary goal -- when present, derive `certs` from the goal's
 *      `goal_syllabus -> credential_syllabus(primary) -> credential.slug`
 *      projection (via `getDerivedCertGoals`); take focus / skip lists from
 *      the goal's targeting columns.
 *   2. Active study_plan -- legacy fallback; cert/focus/skip come from the
 *      plan's columns.
 *   3. Empty -- neither exists. The engine treats this as "no cert filter"
 *      and falls through to the all-cert pool.
 *
 * `depthPreference` and `sessionLength` always come from the active plan
 * (or the system defaults when no plan exists). They are session-shape
 * settings, not learner intent, and stay on the plan post-drop.
 *
 * Disagreement: when both a primary goal and a non-empty `cert_goals`
 * exist and project to different cert sets, the goal wins. The
 * disagreement flag is set on the snapshot so the telemetry pipeline can
 * surface drift without losing the read.
 *
 * See `docs/work-packages/engine-goal-cutover/spec.md`.
 */

import {
	CERT_VALUES,
	type Cert,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	type DepthPreference,
	type Domain,
	ENGINE_TARGETING_SOURCES,
	type EngineTargetingSource,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createLogger } from '@ab/utils';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getDerivedCertGoals, getPrimaryGoal } from './goals';
import { getActivePlan } from './plans';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const log = createLogger('study:engine-targeting');

/**
 * Resolved filter set the engine consumes. Merges goal-derived intent
 * (cert / focus / skip) with plan-derived session shape (depth /
 * session length). The `source` label tells the caller which path the
 * targeting came from -- used by tests and the telemetry log line.
 */
export interface EngineTargeting {
	source: EngineTargetingSource;
	certs: readonly Cert[];
	focusDomains: readonly Domain[];
	skipDomains: readonly Domain[];
	skipNodes: readonly string[];
	depthPreference: DepthPreference;
	sessionLength: number;
}

/**
 * Snapshot bundle returned by `getEngineTargetingSnapshot`. Carries the
 * resolved targeting plus telemetry fields the caller can emit. Captured
 * once per `previewSession` call so the structured-log line and the
 * engine read see the same view of the world.
 */
export interface EngineTargetingSnapshot {
	targeting: EngineTargeting;
	disagreementDetected: boolean;
	recordedAt: Date;
}

/**
 * Resolve the engine's targeting filter for `userId`. Goal wins over plan
 * on disagreement; depth / session length always come from the plan.
 *
 * Read order:
 *   1. Primary goal -> goal-derived cert projection + goal targeting columns.
 *   2. Active study_plan -> legacy fallback.
 *   3. Empty -> system defaults.
 */
export async function getEngineTargeting(userId: string, db: Db = defaultDb): Promise<EngineTargeting> {
	const snapshot = await getEngineTargetingSnapshot(userId, db);
	return snapshot.targeting;
}

/**
 * Resolve the engine's targeting filter and build a telemetry envelope so
 * the caller can both consume and emit. The disagreement flag is true
 * only when the goal path was taken AND the plan would have produced a
 * different cert set.
 */
export async function getEngineTargetingSnapshot(userId: string, db: Db = defaultDb): Promise<EngineTargetingSnapshot> {
	const recordedAt = new Date();

	// Plan + primary goal are independent reads -- fan them out so the
	// helper costs at most one round-trip in the parallel case.
	const [primary, plan] = await Promise.all([getPrimaryGoal(userId, db), getActivePlan(userId, db)]);

	const depthPreference = (plan?.depthPreference as DepthPreference | undefined) ?? DEPTH_PREFERENCES.WORKING;
	const sessionLength = plan?.sessionLength ?? DEFAULT_SESSION_LENGTH;

	if (primary !== null) {
		const derivedCertSlugs = await getDerivedCertGoals(userId, db);
		const certs = derivedCertSlugs.filter((slug): slug is Cert => (CERT_VALUES as readonly string[]).includes(slug));

		// Disagreement detection: the goal path is the source, but if the
		// plan also has a non-empty cert_goals AND the two project to
		// different cert sets, surface the drift on the snapshot. The goal
		// always wins for the actual read.
		let disagreementDetected = false;
		if (plan && plan.certGoals.length > 0) {
			const goalSet = new Set(certs);
			const planSet = new Set(plan.certGoals);
			if (goalSet.size !== planSet.size) {
				disagreementDetected = true;
			} else {
				for (const c of planSet) {
					if (!goalSet.has(c)) {
						disagreementDetected = true;
						break;
					}
				}
			}
		}

		return {
			targeting: {
				source: ENGINE_TARGETING_SOURCES.GOAL,
				certs,
				focusDomains: primary.focusDomains,
				skipDomains: primary.skipDomains,
				skipNodes: primary.skipNodes,
				depthPreference,
				sessionLength,
			},
			disagreementDetected,
			recordedAt,
		};
	}

	if (plan !== null) {
		// Surface the partial-migration case: user has active goals but none
		// is_primary. The plan path is correct here, but a missing primary
		// can mean the cert-syllabus migrator didn't complete cleanly for
		// this user; flag it once per call so the operator notices.
		log.warn('engine targeting fell back to plan with no primary goal', {
			userId,
			metadata: { planId: plan.id, certCount: plan.certGoals.length },
		});

		return {
			targeting: {
				source: ENGINE_TARGETING_SOURCES.PLAN,
				certs: plan.certGoals,
				focusDomains: plan.focusDomains,
				skipDomains: plan.skipDomains,
				skipNodes: plan.skipNodes,
				depthPreference,
				sessionLength,
			},
			disagreementDetected: false,
			recordedAt,
		};
	}

	return {
		targeting: {
			source: ENGINE_TARGETING_SOURCES.EMPTY,
			certs: [],
			focusDomains: [],
			skipDomains: [],
			skipNodes: [],
			depthPreference,
			sessionLength,
		},
		disagreementDetected: false,
		recordedAt,
	};
}

/**
 * Emit the structured log line that drives the dual-read telemetry. One
 * call per `previewSession`. The shape is JSON so an analyst can `jq`
 * over an hour of production logs to confirm the goal path is dominant
 * before applying the column-drop migration (see Open Question (d) in
 * the WP spec).
 *
 * The log call is `info` level so it survives default log retention and
 * does not require a debug-level deploy. Telemetry failure does not
 * block the engine -- the logger's warn-on-error path is enough.
 */
export function emitEngineTargetingTelemetry(userId: string, snapshot: EngineTargetingSnapshot): void {
	log.info('engine-targeting', {
		userId,
		metadata: {
			event: 'engine-targeting',
			source: snapshot.targeting.source,
			disagreementDetected: snapshot.disagreementDetected,
			certsCount: snapshot.targeting.certs.length,
			focusDomainsCount: snapshot.targeting.focusDomains.length,
			skipDomainsCount: snapshot.targeting.skipDomains.length,
			skipNodesCount: snapshot.targeting.skipNodes.length,
		},
	});
}
