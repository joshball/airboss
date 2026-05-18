#!/usr/bin/env bun
/**
 * Provision the e2e test database.
 *
 * - DROPs and recreates the `airboss_e2e` database on the local Postgres
 *   container (separate from `airboss` so test runs never trash the dev
 *   developer's working dataset).
 * - Installs pg_trgm, pushes the Drizzle schema, and runs the full seed
 *   pipeline against the e2e DB by overriding $DATABASE_URL for the child
 *   processes.
 *
 * Idempotent: safe to run repeatedly. Playwright's globalSetup invokes
 * this once per `bun run test e2e` invocation.
 *
 * Output shape mirrors `scripts/db.ts`'s `db reset` pre-seed: a single
 * status line walks through each step, then prints one summary line on
 * completion. `runQuiet` swallows the docker/psql/drizzle-kit chatter
 * (including drizzle's identifier-truncation NOTICE blobs) on success
 * and re-emits everything on failure so a real error stays diagnosable.
 */

import { DEV_DB, DEV_DB_URL_E2E, E2E_DB_NAME, ENV_VARS } from '@ab/constants';
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
	const status = startStatusLine('e2e (pre-seed)');
	const steps: ReadonlyArray<readonly [string, readonly string[], Record<string, string | undefined> | undefined]> = [
		[
			'terminating lingering connections',
			psql(
				'postgres',
				`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${E2E_DB_NAME}' AND pid <> pg_backend_pid();`,
			),
			undefined,
		],
		['dropping database', psql('postgres', `DROP DATABASE IF EXISTS ${E2E_DB_NAME};`), undefined],
		['creating database', psql('postgres', `CREATE DATABASE ${E2E_DB_NAME};`), undefined],
		['installing pg_trgm extension', psql(E2E_DB_NAME, 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'), undefined],
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
		`  ✓ e2e (pre-seed)           ${formatElapsed(Date.now() - start)}  drop + create + extension + push\n`,
	);
}

async function main(): Promise<void> {
	// Push schema and run seed against the e2e DB. drizzle-kit and the seed
	// scripts both read DATABASE_URL; overriding it on the child env keeps
	// the dev DATABASE_URL untouched in the parent shell.
	const childEnv = { ...process.env, [ENV_VARS.DATABASE_URL]: DEV_DB_URL_E2E };

	await provisionSchema(childEnv);

	// Seed orchestrator prints its own per-phase status lines + final summary.
	// Run with inherited stdio so those land in the operator's terminal as-is.
	await runOrThrow(['bun', 'scripts/db/seed-all.ts'], { env: childEnv });

	process.stdout.write(`e2e DB ready: ${E2E_DB_NAME}\n`);
}

main().catch((err) => {
	// `seed-all.ts` already printed a clean one-line diagnosis + log path.
	// Don't re-dump the `subprocess failed (exit N)` stack on top of it --
	// just exit non-zero so Playwright's globalSetup sees the failure.
	const msg = err instanceof Error ? err.message : String(err);
	process.stderr.write(`e2e-setup: ${msg.split('\n')[0]}\n`);
	process.exit(1);
});
