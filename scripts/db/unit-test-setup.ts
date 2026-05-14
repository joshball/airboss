#!/usr/bin/env bun
/**
 * Provision the vitest (unit / BC integration) test database.
 *
 * - DROPs and recreates the `airboss_unit_test` database on the local
 *   Postgres container (separate from `airboss` so test runs never trash
 *   the developer's working dataset, and separate from `airboss_e2e` so
 *   parallel `bun run test` + `bun run test e2e` don't collide).
 * - Installs pg_trgm, pushes the Drizzle schema, and runs the full seed
 *   pipeline against the unit-test DB by overriding $DATABASE_URL for
 *   the child processes.
 *
 * Idempotent: safe to run repeatedly. Vitest's globalSetup invokes this
 * once per `bun test` invocation.
 *
 * Mirrors `scripts/db/e2e-setup.ts` -- same shape, different DB name.
 */

import { DEV_DB, DEV_DB_URL_UNIT, ENV_VARS, UNIT_DB_NAME } from '@ab/constants';
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
	const status = startStatusLine('unit-test (pre-seed)');
	const steps: ReadonlyArray<readonly [string, readonly string[], Record<string, string | undefined> | undefined]> = [
		[
			'terminating lingering connections',
			psql(
				'postgres',
				`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${UNIT_DB_NAME}' AND pid <> pg_backend_pid();`,
			),
			undefined,
		],
		['dropping database', psql('postgres', `DROP DATABASE IF EXISTS ${UNIT_DB_NAME};`), undefined],
		['creating database', psql('postgres', `CREATE DATABASE ${UNIT_DB_NAME};`), undefined],
		['installing pg_trgm extension', psql(UNIT_DB_NAME, 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'), undefined],
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
		`  ✓ unit-test (pre-seed)     ${formatElapsed(Date.now() - start)}  drop + create + extension + push\n`,
	);
}

async function main(): Promise<void> {
	const childEnv = { ...process.env, [ENV_VARS.DATABASE_URL]: DEV_DB_URL_UNIT };

	await provisionSchema(childEnv);

	await runOrThrow(['bun', 'scripts/db/seed-all.ts'], { env: childEnv });

	process.stdout.write(`unit-test DB ready: ${UNIT_DB_NAME}\n`);
}

await main();
