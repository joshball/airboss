#!/usr/bin/env bun

/**
 * Plan / Goal cert drift checker (engine-goal-cutover phase 7).
 *
 * Walks every active study_plan whose `cert_goals` is non-empty and
 * compares it against `getDerivedCertGoals(userId)` (the cert projection
 * from the user's primary goal). Reports rows where the two lists differ.
 *
 * Read-only. Use during the dual-read window to spot flows that still
 * write the legacy `study_plan.cert_goals` column. Expected count after
 * the cutover lands and the redirect-to-goal-composer UX ships: zero.
 *
 * Usage:
 *   bun scripts/db/check-plan-goal-drift.ts
 *   bun scripts/db/check-plan-goal-drift.ts --json
 */

import { studyPlan } from '@ab/bc-study/schema';
import { getDerivedCertGoals } from '@ab/bc-study/server';
import { PLAN_STATUSES } from '@ab/constants';
import { client, db } from '@ab/db/connection';
import { and, eq, sql } from 'drizzle-orm';

interface DriftRow {
	userId: string;
	planId: string;
	planCertGoals: readonly string[];
	derivedFromGoal: readonly string[];
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

	const drift: DriftRow[] = [];
	for (const row of rows) {
		const derived = await getDerivedCertGoals(row.userId);
		const derivedSorted = [...derived].sort();
		const planSorted = [...row.certGoals].sort();
		if (derivedSorted.length !== planSorted.length || derivedSorted.some((v, i) => v !== planSorted[i])) {
			drift.push({
				userId: row.userId,
				planId: row.id,
				planCertGoals: planSorted,
				derivedFromGoal: derivedSorted,
			});
		}
	}

	if (wantsJson) {
		process.stdout.write(`${JSON.stringify({ totalActivePlans: rows.length, drift }, null, 2)}\n`);
		return;
	}

	if (drift.length === 0) {
		console.log(
			`0 users with drift between primary goal and study_plan.cert_goals (${rows.length} active plans scanned).`,
		);
		return;
	}

	console.log(`${drift.length} users with drift (out of ${rows.length} active plans):\n`);
	for (const d of drift) {
		console.log(`  user=${d.userId} plan=${d.planId}`);
		console.log(`    plan.cert_goals     = [${d.planCertGoals.join(', ')}]`);
		console.log(`    derived from goal   = [${d.derivedFromGoal.join(', ')}]`);
	}
}

try {
	await main();
} finally {
	await client.end();
}
