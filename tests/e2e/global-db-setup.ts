/**
 * Playwright globalSetup hook -- provisions the test Postgres databases
 * once per `bun run test e2e` (or `bun run test integration`) invocation.
 *
 * Provisions BOTH `airboss_e2e` and `airboss_integration` in parallel via
 * `Promise.all`. The two suites consume different databases on different
 * vite processes; provisioning them together avoids the race where the
 * integration sweep boots its webServer against an empty `airboss_integration`
 * DB while the e2e suite still has the only seeded one.
 *
 * Each provisioner drops + recreates its DB, runs `drizzle-kit push`, and
 * runs the full seed pipeline (the two processes operate on independent
 * databases via per-child `DATABASE_URL`, so they don't collide). Skipped
 * if `PLAYWRIGHT_SKIP_DB_SETUP=1`, which is useful when iterating locally
 * on a flaky spec against an already-good DB.
 */

import { spawn } from 'node:child_process';

interface ProvisionTarget {
	readonly label: string;
	readonly script: string;
	readonly dbName: string;
}

const TARGETS: readonly ProvisionTarget[] = [
	{ label: 'e2e', script: 'scripts/db/e2e-setup.ts', dbName: 'airboss_e2e' },
	{ label: 'integration', script: 'scripts/db/integration-setup.ts', dbName: 'airboss_integration' },
];

async function provisionOne(target: ProvisionTarget): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const proc = spawn('bun', [target.script], { stdio: 'inherit' });
		proc.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${target.script} exited with code ${code}`));
		});
		proc.on('error', reject);
	});
}

export default async function globalSetup(): Promise<void> {
	if (process.env.PLAYWRIGHT_SKIP_DB_SETUP === '1') {
		console.log('[setup] PLAYWRIGHT_SKIP_DB_SETUP=1 -- reusing existing airboss_e2e + airboss_integration contents');
		return;
	}

	console.log(`[setup] provisioning ${TARGETS.map((t) => t.dbName).join(' + ')} (drop + create + migrate + seed)...`);
	const start = Date.now();

	await Promise.all(TARGETS.map(provisionOne));

	const elapsed = ((Date.now() - start) / 1000).toFixed(1);
	console.log(`[setup] all test DBs ready in ${elapsed}s`);
}
