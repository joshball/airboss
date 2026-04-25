#!/usr/bin/env bun
/**
 * Print a per-table per-origin summary of seeded rows.
 *
 * Default: informational. Exit 0 always (so it's safe to run anywhere as
 * a status command).
 *
 * `--require-clean`: gate mode for CI. Exit 1 if any seeded rows remain.
 * Use this when you want to assert "this DB has no dev-seed rows".
 *
 * Usage:
 *   bun scripts/db/seed-check.ts                  # info, always exit 0
 *   bun scripts/db/seed-check.ts --require-clean  # CI gate, exit 1 if dirty
 */

import { DEV_DB_URL, ENV_VARS } from '@ab/constants';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { SEED_TABLES } from './seed-tables';

interface CountRow {
	origin: string;
	row_count: number;
}

async function main(): Promise<void> {
	const requireClean = process.argv.includes('--require-clean');
	const connectionString = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;
	const client = postgres(connectionString);
	const db = drizzle(client);

	let totalRows = 0;
	const lines: string[] = [];

	try {
		for (const t of SEED_TABLES) {
			const expr = t.markerExpression;
			const query = sql.raw(
				`SELECT (${expr}) AS origin, COUNT(*)::int AS row_count
				 FROM ${t.qualifiedName}
				 WHERE (${expr}) IS NOT NULL
				 GROUP BY (${expr})
				 ORDER BY origin ASC`,
			);
			const result = (await db.execute(query)) as unknown as CountRow[];
			if (result.length === 0) {
				lines.push(`  ${t.label.padEnd(48)} clean`);
				continue;
			}
			for (const row of result) {
				totalRows += row.row_count;
				lines.push(`  ${t.label.padEnd(48)} ${String(row.row_count).padStart(5)} rows  (origin='${row.origin}')`);
			}
		}

		process.stdout.write('\nseed:check\n');
		for (const line of lines) process.stdout.write(`${line}\n`);
		if (totalRows === 0) {
			process.stdout.write('\nResult: clean (0 seeded rows).\n');
			process.exitCode = 0;
		} else if (requireClean) {
			process.stdout.write(`\nResult: ${totalRows} seeded rows present (--require-clean specified, exit 1).\n`);
			process.exitCode = 1;
		} else {
			process.stdout.write(`\nResult: ${totalRows} seeded rows present.\n`);
			process.exitCode = 0;
		}
	} catch (err) {
		process.stderr.write(`seed:check failed: ${(err as Error).stack ?? err}\n`);
		process.exitCode = 2;
	} finally {
		await client.end();
		process.exit(process.exitCode ?? 0);
	}
}

void main();
