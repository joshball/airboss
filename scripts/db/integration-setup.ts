#!/usr/bin/env bun
/**
 * Provision the integration test database.
 *
 * - DROPs and recreates the `airboss_integration` database on the local
 *   Postgres container (separate from `airboss` so test runs never trash
 *   the developer's working dataset, and separate from `airboss_e2e` /
 *   `airboss_unit_test` so the integration coverage sweep can run in
 *   parallel with either of those without cross-talk).
 * - Installs pg_trgm, pushes the Drizzle schema, and runs the full seed
 *   pipeline against the integration DB by overriding $DATABASE_URL for
 *   the child processes.
 *
 * Idempotent: safe to run repeatedly. Playwright's globalSetup invokes
 * this once per `bun run test integration` invocation.
 *
 * Mirrors `scripts/db/e2e-setup.ts` -- same shape, different DB name.
 */

import { DEV_DB, DEV_DB_URL_INTEGRATION, ENV_VARS, INTEGRATION_DB_NAME } from '@ab/constants';
import { runOrThrow, runQuiet } from '../lib/spawn';
import { startStatusLine } from '../lib/status-line';

const CONTAINER = 'airboss-db';
const DB_USER = DEV_DB.USER;

function psql(database: string, sql: string): readonly string[] {
	return ['docker', 'exec', CONTAINER, 'psql', '-U', DB_USER, '-d', database, '-c', sql];
}

function formatElapsed(ms: number): string {
	const s = ms / 1000;
	const text = s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${(s % 60).toFixed(0)}s`;
	return text.padStart(7);
}

async function provisionSchema(childEnv: Record<string, string | undefined>): Promise<void> {
	const start = Date.now();
	const status = startStatusLine('integration (pre-seed)');
	const steps: ReadonlyArray<readonly [string, readonly string[], Record<string, string | undefined> | undefined]> = [
		[
			'terminating lingering connections',
			psql(
				'postgres',
				`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${INTEGRATION_DB_NAME}' AND pid <> pg_backend_pid();`,
			),
			undefined,
		],
		['dropping database', psql('postgres', `DROP DATABASE IF EXISTS ${INTEGRATION_DB_NAME};`), undefined],
		['creating database', psql('postgres', `CREATE DATABASE ${INTEGRATION_DB_NAME};`), undefined],
		['installing pg_trgm extension', psql(INTEGRATION_DB_NAME, 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'), undefined],
		['drizzle-kit push (schema)', ['bunx', 'drizzle-kit', 'push'], childEnv],
	];
	try {
		for (const [label, cmd, env] of steps) {
			status.detail(label);
			await runQuiet(cmd, env ? { env } : undefined);
		}
	} finally {
		status.finish();
	}
	process.stdout.write(
		`  ✓ integration (pre-seed)   ${formatElapsed(Date.now() - start)}  drop + create + extension + push\n`,
	);
}

async function main(): Promise<void> {
	// Push schema and run seed against the integration DB. drizzle-kit and the
	// seed scripts both read DATABASE_URL; overriding it on the child env
	// keeps the dev DATABASE_URL untouched in the parent shell.
	const childEnv = { ...process.env, [ENV_VARS.DATABASE_URL]: DEV_DB_URL_INTEGRATION };

	await provisionSchema(childEnv);

	// Seed orchestrator prints its own per-phase status lines + final summary.
	// Run with inherited stdio so those land in the operator's terminal as-is.
	await runOrThrow(['bun', 'scripts/db/seed-all.ts'], { env: childEnv });

	process.stdout.write(`integration DB ready: ${INTEGRATION_DB_NAME}\n`);
}

main().catch((err) => {
	// `seed-all.ts` already printed a clean one-line diagnosis + log path.
	// Don't re-dump the `subprocess failed (exit N)` stack on top of it --
	// just exit non-zero so Playwright's globalSetup sees the failure.
	const msg = err instanceof Error ? err.message : String(err);
	process.stderr.write(`integration-setup: ${msg.split('\n')[0]}\n`);
	process.exit(1);
});
