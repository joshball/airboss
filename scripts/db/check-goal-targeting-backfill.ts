#!/usr/bin/env bun

/**
 * Goal-targeting backfill sanity check (engine-goal-cutover phase 8).
 *
 * Walks every active study_plan with a non-empty `cert_goals` array and
 * asks `getEngineTargeting(userId)` for the same user. Counts plans
 * where the helper resolves with `source='plan'` (the legacy fallback
 * path). Expected count post-cutover: zero -- every learner has a
 * primary goal materialized by `migrate-study-plans-to-goals`.
 *
 * Read-only. If the script reports a non-zero count, re-run the
 * cert-syllabus migrator against the affected users before merging the
 * engine cutover so no learner falls into the legacy path on day one.
 *
 * Usage:
 *   bun scripts/db/check-goal-targeting-backfill.ts
 *   bun scripts/db/check-goal-targeting-backfill.ts --json
 */

import { getEngineTargeting } from '@ab/bc-study/server';
import { studyPlan } from '@ab/bc-study/schema';
import { ENGINE_TARGETING_SOURCES, PLAN_STATUSES } from '@ab/constants';
import { client, db } from '@ab/db/connection';
import { and, eq, sql } from 'drizzle-orm';

interface OrphanedPlan {
	userId: string;
	planId: string;
	certGoals: readonly string[];
}

async function main(): Promise<void> {
	const wantsJson = process.argv.includes('--json');

	const rows = await db
		.select({
			id: studyPlan.id,
			userId: studyPlan.userId,
			certGoals: studyPlan.certGoals,
		})
		.from(studyPlan)
		.where(and(eq(studyPlan.status, PLAN_STATUSES.ACTIVE), sql`jsonb_array_length(${studyPlan.certGoals}) > 0`));

	const orphaned: OrphanedPlan[] = [];
	for (const row of rows) {
		const targeting = await getEngineTargeting(row.userId);
		if (targeting.source === ENGINE_TARGETING_SOURCES.PLAN) {
			orphaned.push({ userId: row.userId, planId: row.id, certGoals: row.certGoals });
		}
	}

	if (wantsJson) {
		process.stdout.write(`${JSON.stringify({ scanned: rows.length, orphaned }, null, 2)}\n`);
		return;
	}

	if (orphaned.length === 0) {
		console.log(
			`0 active study_plans with non-empty cert_goals fall back to legacy source='plan' (${rows.length} plans scanned).`,
		);
		return;
	}

	console.log(
		`${orphaned.length} active study_plans without a corresponding primary goal (out of ${rows.length} scanned):\n`,
	);
	for (const o of orphaned) {
		console.log(`  user=${o.userId} plan=${o.planId} cert_goals=[${o.certGoals.join(', ')}]`);
	}
	console.log('\nFix: re-run the cert-syllabus migrator against the affected users before merging the engine cutover.');
	console.log('  bun scripts/db/migrate-study-plans-to-goals.ts');
	process.exitCode = 1;
}

try {
	await main();
} finally {
	await client.end();
}
