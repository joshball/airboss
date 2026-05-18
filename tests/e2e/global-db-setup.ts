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

const INTEGRATION_PROJECT = 'flightbag-coverage';

interface ProvisionTarget {
	readonly label: string;
	readonly script: string;
	readonly dbName: string;
	/** True for the DB only the integration sweep consumes. */
	readonly integrationOnly: boolean;
}

const TARGETS: readonly ProvisionTarget[] = [
	{ label: 'e2e', script: 'scripts/db/e2e-setup.ts', dbName: 'airboss_e2e', integrationOnly: false },
	{
		label: 'integration',
		script: 'scripts/db/integration-setup.ts',
		dbName: 'airboss_integration',
		integrationOnly: true,
	},
];

/** `--project` / `-p` values passed to Playwright (mirrors playwright.config.ts). */
function projectArgs(): readonly string[] {
	const args = process.argv;
	const out: string[] = [];
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === undefined) continue;
		if (arg === '--project' || arg === '-p') {
			const next = args[i + 1];
			if (next !== undefined) out.push(next);
		} else if (arg.startsWith('--project=')) {
			out.push(arg.slice('--project='.length));
		}
	}
	return out;
}

/**
 * Which databases this run actually needs. An integration-only run
 * (`--project=flightbag-coverage`) queries `airboss_integration` alone, so
 * provisioning `airboss_e2e` too just doubles the wait and interleaves two
 * seed streams into one unreadable log. Scope to what the run will query.
 */
function neededTargets(): readonly ProvisionTarget[] {
	const requested = projectArgs();
	const integrationOnly = requested.length > 0 && requested.every((p) => p === INTEGRATION_PROJECT);
	if (integrationOnly) return TARGETS.filter((t) => t.integrationOnly);
	// The e2e suite drives the study/flightbag/hangar projects; it never
	// reads `airboss_integration`. Provision only `airboss_e2e`.
	const e2eOnly = requested.length > 0 && requested.every((p) => p !== INTEGRATION_PROJECT);
	if (e2eOnly) return TARGETS.filter((t) => !t.integrationOnly);
	// Bare `playwright test` (no --project) runs the whole matrix -> both.
	return TARGETS;
}

async function provisionOne(target: ProvisionTarget): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const proc = spawn('bun', [target.script], { stdio: 'inherit' });
		proc.on('exit', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			// The child (`*-setup.ts` -> `seed-all.ts`) has already printed a
			// clean one-line diagnosis + the per-phase log path. Reject with a
			// short message so Playwright doesn't stack another dump on top.
			reject(new Error(`${target.label} DB provisioning failed (see the diagnosis above)`));
		});
		proc.on('error', reject);
	});
}

export default async function globalSetup(): Promise<void> {
	// `list` mode runs one trivial sentinel test that touches no database
	// (the spec, seeing SWEEP_LIST=1, prints the URL plan and runs nothing
	// else). Provisioning two databases to then query neither is pure waste
	// -- and the dominant cost of `bun run test integration list`. Skip it.
	if (process.env.SWEEP_LIST === '1') {
		console.log('[setup] list mode -- no database needed, skipping provision');
		return;
	}

	const targets = neededTargets();

	if (process.env.PLAYWRIGHT_SKIP_DB_SETUP === '1') {
		console.log(`[setup] PLAYWRIGHT_SKIP_DB_SETUP=1 -- reusing existing ${targets.map((t) => t.dbName).join(' + ')}`);
		return;
	}

	console.log(`[setup] provisioning ${targets.map((t) => t.dbName).join(' + ')} (drop + create + migrate + seed)...`);
	const start = Date.now();

	await Promise.all(targets.map(provisionOne));

	const elapsed = ((Date.now() - start) / 1000).toFixed(1);
	console.log(`[setup] ${targets.length === 1 ? 'test DB' : 'all test DBs'} ready in ${elapsed}s`);
}
