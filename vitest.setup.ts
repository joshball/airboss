/**
 * Vitest setup -- load the dev `.env` into `process.env`, then FORCE
 * DATABASE_URL to point at the dedicated `airboss_unit_test` database.
 *
 * vite only exposes `VITE_`-prefixed env vars to `import.meta.env`; our
 * libs read raw `process.env` (DATABASE_URL, BETTER_AUTH_SECRET, ...) and
 * drizzle-orm/postgres-js errors out at import time when DATABASE_URL is
 * missing. This mirrors how `bun` auto-loads `.env` when running scripts.
 *
 * The DATABASE_URL override is the load-bearing line: it runs BEFORE any
 * test module imports `@ab/db/connection`, so tests connect to the
 * isolated test DB even if the developer's shell has DATABASE_URL set
 * to the dev DB. `vitest.globalSetup.ts` provisions that DB once per
 * `bun test` invocation.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEV_DB_URL_UNIT, ENV_VARS } from '@ab/constants';

function loadEnvFile(path: string): void {
	let raw: string;
	try {
		raw = readFileSync(path, 'utf8');
	} catch {
		return;
	}
	for (const line of raw.split('\n')) {
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		// Strip surrounding quotes if present.
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		// Do not overwrite anything that's already in the environment -- the
		// shell wins, the file fills in the rest.
		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

loadEnvFile(resolve(process.cwd(), '.env'));
// Fall back to `.env.example` so a fresh worktree (which inherits
// `.env.example` from git but has no personal `.env`) can still boot the
// test suite against the dev-DB defaults. The no-overwrite rule above keeps
// real `.env` entries winning when both files exist.
loadEnvFile(resolve(process.cwd(), '.env.example'));

// Force the test suite onto the isolated unit-test DB regardless of what
// the developer's shell or .env files set. globalSetup has already dropped
// + recreated + seeded this database.
process.env[ENV_VARS.DATABASE_URL] = DEV_DB_URL_UNIT;
