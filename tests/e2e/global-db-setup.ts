/**
 * Playwright globalSetup hook -- provisions the e2e Postgres database
 * once per `bun run test e2e` invocation.
 *
 * Drops + recreates `airboss_e2e`, runs migrations, runs the full seed
 * pipeline so every project sees the same starting fixtures. Skipped if
 * `PLAYWRIGHT_SKIP_DB_SETUP=1` is set, which is useful when iterating
 * locally on a flaky spec against an already-good DB.
 */

import { spawn } from 'node:child_process';

export default async function globalSetup(): Promise<void> {
	if (process.env.PLAYWRIGHT_SKIP_DB_SETUP === '1') {
		console.log('[e2e] PLAYWRIGHT_SKIP_DB_SETUP=1 -- reusing existing airboss_e2e contents');
		return;
	}

	console.log('[e2e] provisioning airboss_e2e (drop + create + migrate + seed)...');
	const start = Date.now();

	await new Promise<void>((resolve, reject) => {
		const proc = spawn('bun', ['scripts/db/e2e-setup.ts'], { stdio: 'inherit' });
		proc.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`e2e-setup.ts exited with code ${code}`));
		});
		proc.on('error', reject);
	});

	const elapsed = ((Date.now() - start) / 1000).toFixed(1);
	console.log(`[e2e] airboss_e2e ready in ${elapsed}s`);
}
