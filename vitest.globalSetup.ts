/**
 * Vitest globalSetup -- provisions the `airboss_unit_test` Postgres
 * database once per `bun test` invocation.
 *
 * Drops + recreates the DB, runs migrations, runs the full seed pipeline
 * so every test sees the same starting fixtures (knowledge graph, CFR
 * titles, handbooks, dev users). Mirrors `tests/e2e/global-db-setup.ts`.
 *
 * `vitest.setup.ts` pins `DATABASE_URL` to `DEV_DB_URL_UNIT` so test
 * modules connect to this DB and physically cannot reach the developer's
 * `airboss` dev dataset.
 *
 * ## Concurrency lock
 *
 * `airboss_unit_test` is a single machine-wide Postgres database. Two
 * overlapping `bun run test` invocations (an agent's run plus a
 * developer's, or two worktrees) would each DROP + reseed it and
 * `pg_terminate_backend` every connection to it -- killing the OTHER
 * run's live vitest worker pools mid-query with `57P01 ProcessInterrupts`
 * / `CONNECTION_CLOSED`. To prevent that, globalSetup takes a machine-wide
 * exclusive file lock BEFORE provisioning and holds it for the whole
 * vitest run; the returned teardown releases it. A second invocation
 * blocks at this lock until the first run completes, then provisions a
 * fresh DB and runs cleanly. The lock lives in the OS temp dir (not the
 * repo `.cache/`) so it is shared across worktrees on the same machine.
 */

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock } from './scripts/lib/file-lock';

/** Machine-wide lock file guarding the shared `airboss_unit_test` DB. */
const UNIT_DB_LOCK_PATH = join(tmpdir(), 'airboss-unit-test-db.lock');

/** Run `scripts/db/unit-test-setup.ts` and resolve on a clean exit. */
function provisionUnitDb(): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const proc = spawn('bun', ['scripts/db/unit-test-setup.ts'], { stdio: 'inherit' });
		proc.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`unit-test-setup.ts exited with code ${code}`));
		});
		proc.on('error', reject);
	});
}

export default async function globalSetup(): Promise<() => void> {
	const lock = await acquireLock(UNIT_DB_LOCK_PATH, `vitest pid ${process.pid}`, (holder) => {
		// `process.stdout.write` (not `console`) -- matches the setup scripts'
		// progress style and keeps the repo-wide `noConsole` lint rule happy.
		process.stdout.write(`> waiting for the unit-test DB lock held by ${holder}...\n`);
	});

	try {
		await provisionUnitDb();
	} catch (err) {
		// Provisioning failed -- release the lock so a retry isn't blocked,
		// then rethrow so vitest reports the setup failure.
		lock.release();
		throw err;
	}

	// Teardown: release the lock once the whole vitest run has finished, so
	// a queued second invocation can provision its own fresh DB.
	return () => {
		lock.release();
	};
}
