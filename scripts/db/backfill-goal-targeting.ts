#!/usr/bin/env bun

/**
 * Goal targeting backfill (engine-goal-cutover phase 1).
 *
 * Copies `focus_domains` / `skip_domains` / `skip_nodes` from each
 * user's active `study_plan` onto every goal that user owns. Idempotent:
 * a goal that already has non-default targeting (any of the three lists
 * non-empty) is skipped, so re-runs land zero updates.
 *
 * Use case: bring the goal model in sync with whatever targeting users
 * had on their plan before the cutover; after this lands the engine's
 * goal-path read sees identical filters to what they had pre-cutover.
 *
 * Usage:
 *   bun scripts/db/backfill-goal-targeting.ts
 *   bun scripts/db/backfill-goal-targeting.ts --dry-run
 *   bun scripts/db/backfill-goal-targeting.ts --json
 */

import { goal, studyPlan } from '@ab/bc-study/schema';
import { GOAL_STATUSES, PLAN_STATUSES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

interface BackfillSummary {
	scanned: number;
	updated: number;
	skipped: number;
	missingPlan: number;
}

export async function backfillGoalTargeting(
	options: { dryRun?: boolean } = {},
	db: Db = defaultDb,
): Promise<BackfillSummary> {
	const dryRun = options.dryRun ?? false;
	let scanned = 0;
	let updated = 0;
	let skipped = 0;
	let missingPlan = 0;

	// Pull every active goal. Inactive (abandoned / completed) goals are
	// left alone -- the cutover only matters for goals that drive the engine.
	const goals = await db.select().from(goal).where(eq(goal.status, GOAL_STATUSES.ACTIVE));

	for (const g of goals) {
		scanned += 1;

		// Skip if any targeting field is already non-default. Idempotency:
		// a re-run after a user has curated their goal targeting must not
		// clobber their work.
		if (g.focusDomains.length > 0 || g.skipDomains.length > 0 || g.skipNodes.length > 0) {
			skipped += 1;
			continue;
		}

		const [plan] = await db
			.select({
				focusDomains: studyPlan.focusDomains,
				skipDomains: studyPlan.skipDomains,
				skipNodes: studyPlan.skipNodes,
			})
			.from(studyPlan)
			.where(and(eq(studyPlan.userId, g.userId), eq(studyPlan.status, PLAN_STATUSES.ACTIVE)))
			.limit(1);

		if (!plan) {
			missingPlan += 1;
			continue;
		}

		// If the plan also has all-empty targeting, the update is a no-op.
		if (plan.focusDomains.length === 0 && plan.skipDomains.length === 0 && plan.skipNodes.length === 0) {
			skipped += 1;
			continue;
		}

		if (!dryRun) {
			await db
				.update(goal)
				.set({
					focusDomains: plan.focusDomains,
					skipDomains: plan.skipDomains,
					skipNodes: plan.skipNodes,
					updatedAt: new Date(),
				})
				.where(eq(goal.id, g.id));
		}
		updated += 1;
	}

	return { scanned, updated, skipped, missingPlan };
}

async function main(): Promise<void> {
	const wantsJson = process.argv.includes('--json');
	const dryRun = process.argv.includes('--dry-run');

	const summary = await backfillGoalTargeting({ dryRun });

	if (wantsJson) {
		process.stdout.write(`${JSON.stringify({ ...summary, dryRun }, null, 2)}\n`);
		return;
	}

	const verb = dryRun ? 'would update' : 'updated';
	console.log(`scanned ${summary.scanned} active goals; ${verb} ${summary.updated}; skipped ${summary.skipped}.`);
	if (summary.missingPlan > 0) {
		console.log(`note: ${summary.missingPlan} goal(s) had no active study_plan -- targeting left at defaults.`);
	}
}

if (import.meta.main) {
	await main();
}
