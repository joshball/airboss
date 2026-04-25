#!/usr/bin/env bun
/**
 * Atomically remove every row tagged with the given seed-origin marker.
 *
 * Usage:
 *   bun scripts/db/seed-remove.ts --origin <tag>
 *
 * The delete order respects FK constraints: session_item_result before
 * review/session, scenario before nothing (referenced only via
 * session_item_result, already removed), card before knowledge_node, then
 * bauth_user last. card_state cascades from card delete -- it isn't tagged.
 *
 * Wraps the entire run in a single transaction so a failure mid-cleanup
 * leaves the DB unchanged.
 */

import { DEV_DB_URL, ENV_VARS } from '@ab/constants';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { SEED_TABLES } from './seed-tables';

function parseArgs(argv: readonly string[]): { origin: string | null } {
	let origin: string | null = null;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--origin') {
			origin = argv[i + 1] ?? null;
			i++;
		} else if (arg.startsWith('--origin=')) {
			origin = arg.slice('--origin='.length);
		}
	}
	return { origin };
}

async function main(): Promise<void> {
	const { origin } = parseArgs(process.argv.slice(2));
	if (!origin) {
		process.stderr.write('Usage: bun scripts/db/seed-remove.ts --origin <tag>\n');
		process.exit(1);
	}

	const connectionString = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;
	const client = postgres(connectionString);
	const db = drizzle(client);

	process.stdout.write(`\nseed:remove origin='${origin}'\n`);
	let total = 0;

	try {
		await db.transaction(async (tx) => {
			for (const t of SEED_TABLES) {
				const expr = t.markerExpression;
				// For bauth_user we strip the marker out of the address jsonb
				// rather than DELETE, so we don't destroy a user that may still
				// own data outside the seed set. Other tables get a hard delete.
				if (t.qualifiedName === 'public.bauth_user') {
					const result = await tx.execute(
						sql.raw(
							`UPDATE ${t.qualifiedName}
							 SET address = address - 'seed_origin'
							 WHERE (${expr}) = '${origin.replace(/'/g, "''")}'`,
						),
					);
					const count = Number((result as unknown as { count?: number }).count ?? 0);
					total += count;
					process.stdout.write(`  ${t.label.padEnd(48)} ${String(count).padStart(5)} rows untagged\n`);
					continue;
				}
				const result = await tx.execute(
					sql.raw(
						`DELETE FROM ${t.qualifiedName}
						 WHERE (${expr}) = '${origin.replace(/'/g, "''")}'`,
					),
				);
				const count = Number((result as unknown as { count?: number }).count ?? 0);
				total += count;
				process.stdout.write(`  ${t.label.padEnd(48)} ${String(count).padStart(5)} rows removed\n`);
			}
		});
		process.stdout.write(`\nDone. ${total} rows total.\n`);
	} catch (err) {
		process.stderr.write(`seed:remove failed (rolled back): ${(err as Error).stack ?? err}\n`);
		process.exitCode = 1;
	} finally {
		await client.end();
		process.exit(process.exitCode ?? 0);
	}
}

void main();
