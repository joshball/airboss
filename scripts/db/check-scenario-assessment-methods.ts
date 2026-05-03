#!/usr/bin/env bun

/**
 * Scenario assessment-methods distribution audit (evidence-kind-data-layer WP).
 *
 * Read-only. Walks `study.scenario` and reports row counts grouped by their
 * `assessment_methods` jsonb value, plus a default vs explicit breakdown.
 * The migration applies `'["scenario"]'::jsonb` to every existing row;
 * this script flags rows that match the default (so the content team
 * knows they haven't been audited yet) versus rows that already declare
 * an explicit set (e.g. demonstration-flavored maneuver scenarios).
 *
 * Usage:
 *   bun scripts/db/check-scenario-assessment-methods.ts
 *   bun scripts/db/check-scenario-assessment-methods.ts --json
 */

import { scenario } from '@ab/bc-study/schema';
import { SCENARIO_DEFAULT_ASSESSMENT_METHODS, SCENARIO_STATUSES } from '@ab/constants';
import { client, db } from '@ab/db/connection';
import { eq, sql } from 'drizzle-orm';

interface DistRow {
	methods: string;
	count: number;
}

function methodsKey(arr: readonly string[]): string {
	const sorted = [...arr].sort();
	return JSON.stringify(sorted);
}

const DEFAULT_KEY = methodsKey([...SCENARIO_DEFAULT_ASSESSMENT_METHODS]);

async function main(): Promise<void> {
	const wantsJson = process.argv.includes('--json');

	const rows = await db
		.select({
			methods: scenario.assessmentMethods,
			c: sql<number>`count(*)::int`,
		})
		.from(scenario)
		.where(eq(scenario.status, SCENARIO_STATUSES.ACTIVE))
		.groupBy(scenario.assessmentMethods);

	const counts = new Map<string, number>();
	for (const r of rows) {
		const key = methodsKey(r.methods);
		counts.set(key, (counts.get(key) ?? 0) + Number(r.c));
	}

	let defaultCount = 0;
	let explicitCount = 0;
	const dist: DistRow[] = [];
	for (const [key, count] of counts.entries()) {
		dist.push({ methods: key, count });
		if (key === DEFAULT_KEY) defaultCount += count;
		else explicitCount += count;
	}
	dist.sort((a, b) => b.count - a.count);

	if (wantsJson) {
		process.stdout.write(
			`${JSON.stringify(
				{ defaultCount, explicitCount, defaultMethods: SCENARIO_DEFAULT_ASSESSMENT_METHODS, breakdown: dist },
				null,
				2,
			)}\n`,
		);
		await client.end();
		return;
	}

	process.stdout.write('\nstudy.scenario -- assessment_methods distribution (active rows only)\n');
	process.stdout.write('--------------------------------------------------------------------\n');
	process.stdout.write(`  default applied:   ${defaultCount}  (${DEFAULT_KEY})\n`);
	process.stdout.write(`  explicit values:   ${explicitCount}\n`);
	if (dist.length === 0) {
		process.stdout.write('  (no active scenarios)\n');
	} else {
		process.stdout.write('\nbreakdown:\n');
		const widthKey = Math.max(...dist.map((r) => r.methods.length), 'methods'.length);
		process.stdout.write(`  ${'methods'.padEnd(widthKey)}  count\n`);
		for (const r of dist) {
			const tag = r.methods === DEFAULT_KEY ? ' (default)' : '';
			process.stdout.write(`  ${r.methods.padEnd(widthKey)}  ${r.count}${tag}\n`);
		}
	}
	process.stdout.write('\n');
	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
