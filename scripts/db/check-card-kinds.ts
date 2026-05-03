#!/usr/bin/env bun

/**
 * Card-kind distribution audit (evidence-kind-data-layer WP).
 *
 * Read-only. Walks `study.card` and reports per-(domain, kind) row counts.
 * The default is informational so the content team can spot domains that
 * are mostly recall when they should be calculation (or vice versa) -- the
 * migration applies `kind='recall'` to every existing row, which is wrong
 * for any node that's actually calc-heavy. This script is the punch list.
 *
 * Usage:
 *   bun scripts/db/check-card-kinds.ts
 *   bun scripts/db/check-card-kinds.ts --json
 */

import { card } from '@ab/bc-study/schema';
import { CARD_STATUSES } from '@ab/constants';
import { client, db } from '@ab/db/connection';
import { eq, sql } from 'drizzle-orm';

interface DomainRow {
	domain: string;
	kind: string;
	count: number;
}

async function main(): Promise<void> {
	const wantsJson = process.argv.includes('--json');

	const rows = await db
		.select({
			domain: card.domain,
			kind: card.kind,
			c: sql<number>`count(*)::int`,
		})
		.from(card)
		.where(eq(card.status, CARD_STATUSES.ACTIVE))
		.groupBy(card.domain, card.kind)
		.orderBy(card.domain, card.kind);

	const out: DomainRow[] = rows.map((r) => ({ domain: r.domain, kind: r.kind, count: Number(r.c) }));

	const totals = new Map<string, number>();
	for (const r of out) totals.set(r.kind, (totals.get(r.kind) ?? 0) + r.count);

	if (wantsJson) {
		process.stdout.write(
			`${JSON.stringify({ totalsByKind: Object.fromEntries(totals.entries()), perDomain: out }, null, 2)}\n`,
		);
		await client.end();
		return;
	}

	process.stdout.write('\nstudy.card -- per-(domain, kind) distribution (active rows only)\n');
	process.stdout.write('-----------------------------------------------------------\n');
	if (out.length === 0) {
		process.stdout.write('  (no active cards)\n');
	} else {
		const widthDomain = Math.max(...out.map((r) => r.domain.length), 'domain'.length);
		const widthKind = Math.max(...out.map((r) => r.kind.length), 'kind'.length);
		process.stdout.write(`  ${'domain'.padEnd(widthDomain)}  ${'kind'.padEnd(widthKind)}  count\n`);
		for (const r of out) {
			process.stdout.write(`  ${r.domain.padEnd(widthDomain)}  ${r.kind.padEnd(widthKind)}  ${r.count}\n`);
		}
	}

	process.stdout.write('\ntotals by kind:\n');
	for (const [k, v] of totals.entries()) process.stdout.write(`  ${k.padEnd(12)} ${v}\n`);
	process.stdout.write('\n');
	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
