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
 */

import { spawn } from 'node:child_process';

export default async function globalSetup(): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const proc = spawn('bun', ['scripts/db/unit-test-setup.ts'], { stdio: 'inherit' });
		proc.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`unit-test-setup.ts exited with code ${code}`));
		});
		proc.on('error', reject);
	});
}
