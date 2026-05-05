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
 */

import { DEV_DB, DEV_DB_URL_E2E, E2E_DB_NAME, ENV_VARS } from '@ab/constants';
import { run } from '../lib/spawn';

const CONTAINER = 'airboss-db';
const DB_USER = DEV_DB.USER;

async function execPsql(database: string, sql: string): Promise<void> {
	await run(['docker', 'exec', CONTAINER, 'psql', '-U', DB_USER, '-d', database, '-c', sql]);
}

async function main(): Promise<void> {
	// Terminate lingering connections so DROP DATABASE doesn't fail with
	// "database is being accessed by other users". Same dance as the dev
	// reset path.
	await execPsql(
		'postgres',
		`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${E2E_DB_NAME}' AND pid <> pg_backend_pid();`,
	);
	await execPsql('postgres', `DROP DATABASE IF EXISTS ${E2E_DB_NAME};`);
	await execPsql('postgres', `CREATE DATABASE ${E2E_DB_NAME};`);
	await execPsql(E2E_DB_NAME, 'CREATE EXTENSION IF NOT EXISTS pg_trgm;');

	// Push schema and run seed against the e2e DB. drizzle-kit and the seed
	// scripts both read DATABASE_URL; overriding it on the child env keeps
	// the dev DATABASE_URL untouched in the parent shell.
	const childEnv = { ...process.env, [ENV_VARS.DATABASE_URL]: DEV_DB_URL_E2E };

	await run(['bunx', 'drizzle-kit', 'push'], { env: childEnv });
	await run(['bun', 'scripts/db/seed-all.ts'], { env: childEnv });

	console.log(`e2e DB ready: ${E2E_DB_NAME}`);
}

await main();
