import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { DEV_DB_URL_E2E, DEV_DB_URL_INTEGRATION, ENV_VARS, PORTS } from './libs/constants/src';

const __dirname = dirname(fileURLToPath(import.meta.url));

// E2E ports = dev ports + 3. Tests get their own vite processes pointed at
// the e2e database, so a `bun run dev` session can keep running on the
// canonical ports without colliding. Override via env if you want to point
// the suite at a deployed preview instead.
const studyPort = PORTS.STUDY_E2E;
const hangarPort = PORTS.HANGAR_E2E;
const flightbagPort = PORTS.FLIGHTBAG_E2E;
// Integration ports = dev ports + 7. The flightbag integration sweep runs
// against its own vite process, against `airboss_integration`, on a port
// disjoint from both `bun run dev` (9640) and the e2e flightbag project
// (9643). See `tests/integration/flightbag-coverage.spec.ts`.
const flightbagIntegrationPort = PORTS.FLIGHTBAG_INTEGRATION;

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${studyPort}`;
const flightbagBaseURL = process.env.PLAYWRIGHT_FLIGHTBAG_BASE_URL ?? `http://127.0.0.1:${flightbagPort}`;
const hangarBaseURL = process.env.PLAYWRIGHT_HANGAR_BASE_URL ?? `http://127.0.0.1:${hangarPort}`;
const flightbagIntegrationBaseURL =
	process.env.FLIGHTBAG_INTEGRATION_BASE_URL ?? `http://127.0.0.1:${flightbagIntegrationPort}`;

// Bun auto-loads `.env` based on the spawned process's cwd. Playwright
// launches each webServer with `cwd: 'apps/<app>'`, where no .env exists,
// so vital secrets (BETTER_AUTH_SECRET etc.) never make it into the dev
// process. We parse the repo-root .env once here and forward the whole
// payload through `webServer.env`. Anything in the parent shell still
// wins because process.env is also spread in.
function loadRootEnv(): Record<string, string> {
	const path = resolve(__dirname, '.env');
	const out: Record<string, string> = {};
	let raw: string;
	try {
		raw = readFileSync(path, 'utf8');
	} catch {
		return out; // .env optional in CI / fresh clones
	}
	for (const line of raw.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq < 0) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		out[key] = value;
	}
	return out;
}

const rootEnv = loadRootEnv();

// Every webServer command inherits this env so the SvelteKit/Drizzle layer
// connects to the e2e DB instead of the developer's working dataset.
//
// `HANGAR_JOBS_WORKER=off` disables the in-process hangar-jobs poller in the
// hangar webServer. Playwright launches webServers in parallel with
// `globalSetup`, so a worker that boots before the seed lands the schema
// crash-loops on `select ... from "hangar"."job"` and floods the test
// output with stack traces. No e2e spec depends on the in-process worker
// (specs that touch the queue insert + inspect rows directly), so leaving
// it off in this context is loss-free.
// `AUTH_RATE_LIMIT_ENABLED=0` disables better-auth's database-backed rate
// limiter for the e2e suite. Every parallel worker signs in from the same
// `127.0.0.1`, so the shared rate-limit key both throttles the run and races
// better-auth's SELECT-then-INSERT on `bauth_rate_limit` (a unique-constraint
// violation under concurrency). Rate-limit behaviour is covered by
// `libs/auth/src/rate-limit.test.ts`, which builds its own enabled instance.
const e2eEnv = {
	...rootEnv,
	[ENV_VARS.DATABASE_URL]: DEV_DB_URL_E2E,
	[ENV_VARS.HANGAR_JOBS_WORKER]: 'off',
	[ENV_VARS.AUTH_RATE_LIMIT_ENABLED]: '0',
};

// The integration sweep targets `airboss_integration` on its own port. Same
// shape as `e2eEnv`, different DATABASE_URL so the flightbag-integration
// webServer below renders pages out of the integration DB.
const integrationEnv = {
	...rootEnv,
	[ENV_VARS.DATABASE_URL]: DEV_DB_URL_INTEGRATION,
	[ENV_VARS.HANGAR_JOBS_WORKER]: 'off',
};

export default defineConfig({
	testDir: './tests/e2e',
	outputDir: './tests/e2e/.out',
	// Provision the e2e DB once per `bun run test e2e`. Drops + recreates
	// `airboss_e2e`, runs migrations, runs the full seed pipeline. Skipped
	// when PLAYWRIGHT_SKIP_DB_SETUP=1 -- handy for fast re-runs against a
	// known-good DB while iterating on a flaky spec.
	globalSetup: './tests/e2e/global-db-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	// Worker count is a TOP-LEVEL setting -- Playwright ignores a `workers`
	// field placed inside a `projects[]` entry. So we resolve it here: when
	// the integration sweep is the only project requested, `integrationWorkers()`
	// (default 100) applies; otherwise `undefined` lets Playwright pick its
	// default (~CPUs/2) for the browser-driven e2e suites, where 100 chromium
	// instances would thrash the box. Override the sweep with the
	// `TEST_INTEGRATION_WORKERS` env var or Playwright's own `--workers=N`.
	workers: workersFor(),
	// Reporter selection is suite-aware. The integration sweep
	// (`flightbag-coverage`) parameterises several thousand URLs into
	// individual tests; the stock `list` reporter would print one line per
	// test -- thousands of lines that bury the signal. For that run we use
	// the compact `dot` reporter (one char per test, live progress) plus the
	// custom `tests/integration/reporter.ts`, which stays silent during the
	// run and prints a single grouped, actionable summary at the end.
	//
	// For the e2e suites `list` is the right call -- a few hundred tests with
	// readable names. The custom reporter is a no-op there (it filters by
	// project name) but stays layered so a mixed run still gets the summary.
	reporter: reportersFor(),
	timeout: 30_000,
	expect: { timeout: 5_000 },
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		// 5s is too tight for SvelteKit form actions whose dependent navigation
		// has to bounce through a server-render of a heavy admin/board page
		// (the hangar loader, the bucket-edit pre-fill, etc.). 15s leaves
		// room for that without papering over a real regression -- a true
		// hang still trips the per-test 30s budget set above.
		actionTimeout: 15_000,
		navigationTimeout: 15_000,
	},
	projects: [
		{
			// Study (default) auth setup. Scoped to the top-level
			// `tests/e2e/global.setup.ts` so per-feature setup files (e.g.
			// `hangar-review-queue/global.setup.ts`) don't pile into this
			// project and run against the wrong base URL. The negative
			// look-ahead before `global.setup.ts` excludes any nested setup
			// file (e.g. anything under `hangar-review-queue/`).
			name: 'setup',
			testMatch: /e2e\/global\.setup\.ts$/,
		},
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'tests/e2e/.auth/learner.json',
			},
			dependencies: ['setup'],
			// `content-census-smoke` is a hangar-app spec -- it runs in the
			// `hangar-review-queue` project (hangar webServer + admin auth),
			// so it is excluded from the study `chromium` project here.
			testIgnore: /unauthed\/.*|flightbag\/.*|hangar-review-queue\/.*|content-census-smoke\.spec\.ts/,
		},
		{
			// Study `unauthed/` -- specs in `tests/e2e/unauthed/`. The
			// `hangar-review-queue/unauthed/` tree has its own dedicated
			// project below (different baseURL), so we exclude it here to
			// keep the projects disjoint.
			name: 'chromium-unauthed',
			use: devices['Desktop Chrome'],
			testMatch: /unauthed\/.*\.spec\.ts/,
			testIgnore: /hangar-review-queue\/.*/,
		},
		{
			// Flightbag is a public reader served from its own host on its own
			// port -- no auth, no shared dev server. The webServer entry below
			// boots `apps/flightbag` independently so this project can drive
			// real navigation against the rendered flightbag UI.
			name: 'flightbag',
			use: {
				...devices['Desktop Chrome'],
				baseURL: flightbagBaseURL,
			},
			testMatch: /flightbag\/.*\.spec\.ts/,
		},
		{
			// Hangar review-queue setup -- authenticate the admin reviewer once
			// and seed `review_item` rows via the admin loader so the
			// dependent specs see a populated board on first navigation.
			// Lives outside the study `setup` project so the two auth flows
			// don't interleave.
			name: 'hangar-review-queue-setup',
			use: {
				...devices['Desktop Chrome'],
				baseURL: hangarBaseURL,
			},
			testMatch: /hangar-review-queue\/global\.setup\.ts/,
		},
		{
			// Hangar review-queue e2e -- authoring/admin surface served on its
			// own port. Storage state captured by the setup project carries
			// the admin session cookies so each spec lands directly inside
			// `(app)`. Tests under `unauthed/` are excluded so they run via
			// the storage-state-less project below.
			name: 'hangar-review-queue',
			use: {
				...devices['Desktop Chrome'],
				baseURL: hangarBaseURL,
				storageState: 'tests/e2e/.auth/hangar-admin.json',
			},
			dependencies: ['hangar-review-queue-setup'],
			// Matches the review-queue specs plus the top-level hangar smoke
			// specs (`content-census-smoke.spec.ts`) -- both run against the
			// hangar webServer + admin storage state.
			testMatch: /(hangar-review-queue\/.*|content-census-smoke)\.spec\.ts/,
			testIgnore: /hangar-review-queue\/unauthed\/.*/,
		},
		{
			// Hangar review-queue unauthed -- auth gate / 401-403 redirect
			// coverage. No storage state so each spec exercises the
			// bounce-to-login flow without re-using the admin session.
			name: 'hangar-review-queue-unauthed',
			use: {
				...devices['Desktop Chrome'],
				baseURL: hangarBaseURL,
			},
			testMatch: /hangar-review-queue\/unauthed\/.*\.spec\.ts/,
		},
		{
			// Flightbag coverage sweep -- HTTP-only request fixture (no browser
			// context), highly parallel, no auth, no storage state. Iterates
			// every reader URL derived from `notSupersededInRegistry()`
			// references and asserts each one responds with a non-error status
			// and a non-empty body. The integration spec lives outside
			// `tests/e2e/` so the e2e project filters never sweep it up.
			//
			// Worker count: each test is a single GET against the in-process
			// vite SSR -- no browser, negligible per-worker memory -- so the
			// sweep runs far more workers than CPU cores. The count is set at
			// the top-level `workers:` field (`workersFor()`); a `workers` field
			// on this project object would be silently ignored by Playwright.
			//
			// Pointed at the dedicated `flightbag-integration` webServer below
			// so the e2e flightbag project (also on its own webServer) can
			// continue to run unaffected by this project's traffic.
			name: 'flightbag-coverage',
			testDir: './tests/integration',
			testMatch: /flightbag-coverage\.spec\.ts/,
			// Worker count is resolved at the TOP LEVEL (`workers: workersFor()`)
			// -- a `workers` field here would be silently ignored by Playwright.
			fullyParallel: true,
			use: {
				baseURL: flightbagIntegrationBaseURL,
				// The sweep uses Playwright's `request` fixture (no `page`); the
				// shorter timeout below catches a stalled SSR before the global
				// 30s test timeout chews through wall-clock budget on a hung
				// page.
				actionTimeout: 10_000,
				navigationTimeout: 10_000,
			},
		},
	],
	// Each webServer launches a dedicated vite process on the e2e port,
	// pointed at the e2e DB. `reuseExistingServer: false` so we never
	// silently bind to a `bun run dev` instance that's holding the
	// developer's working DB open -- that's exactly the cross-talk this
	// whole isolation pass is here to prevent.
	//
	// When `--project=flightbag-coverage` is the only project requested
	// (the integration sweep), the e2e webServers are skipped so we don't
	// pay the 2-minute warm-up for vite processes the sweep never touches.
	// Detect by walking `process.argv` for the project flag -- Playwright
	// applies the same parse to its CLI args.
	webServer: chooseWebServers(),
});

/**
 * Pick the reporter stack. When the integration sweep is the only project
 * requested (`--project=flightbag-coverage`), use the compact `dot` reporter
 * so progress stays visible without thousands of per-test lines; the custom
 * reporter then prints the grouped summary. Every other run keeps `list`.
 */
function reportersFor(): NonNullable<Parameters<typeof defineConfig>[0]['reporter']> {
	const requested = projectArgs();
	const integrationOnly = requested.length > 0 && requested.every((p) => p === 'flightbag-coverage');
	const base: Array<[string] | [string, Record<string, unknown>]> = integrationOnly ? [['dot']] : [['list']];
	if (process.env.CI) base.unshift(['github']);
	base.push(['./tests/integration/reporter.ts']);
	return base;
}

/**
 * Top-level worker count. Playwright reads `workers` ONLY from the top-level
 * config -- a `workers` field inside a `projects[]` entry is silently ignored.
 *
 * When the integration sweep (`flightbag-coverage`) is the only project
 * requested, return a high count: every test is a single HTTP GET against the
 * in-process vite SSR -- no browser, negligible per-worker memory -- so
 * concurrency far above CPU-core count is safe and is the lever for wall-clock
 * time. Default 100, override via `TEST_INTEGRATION_WORKERS` (clamped 1..512).
 *
 * For every other run, return `undefined` so Playwright picks its default
 * (~CPUs/2). The e2e suites drive real chromium instances; 100 of those would
 * thrash the box. `--workers=N` on the CLI still overrides either path.
 */
function workersFor(): number | undefined {
	const requested = projectArgs();
	const integrationOnly = requested.length > 0 && requested.every((p) => p === 'flightbag-coverage');
	if (!integrationOnly) return undefined;
	const raw = process.env.TEST_INTEGRATION_WORKERS;
	const parsed = raw ? Number.parseInt(raw, 10) : NaN;
	if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 512);
	return 100;
}

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

function chooseWebServers() {
	const requested = projectArgs();
	// Only the integration project requested -> boot the integration vite
	// process only. Skip the e2e study/flightbag/hangar webServers.
	if (requested.length > 0 && requested.every((p) => p === 'flightbag-coverage')) {
		return [
			{
				command: 'bun run dev',
				cwd: 'apps/flightbag',
				url: flightbagIntegrationBaseURL,
				reuseExistingServer: false,
				timeout: 120_000,
				env: { ...integrationEnv, PORT: String(flightbagIntegrationPort) },
			},
		];
	}
	return [
		{
			command: 'bun run dev',
			cwd: 'apps/study',
			url: baseURL,
			reuseExistingServer: false,
			timeout: 120_000,
			env: { ...e2eEnv, PORT: String(studyPort) },
		},
		{
			command: 'bun run dev',
			cwd: 'apps/flightbag',
			url: flightbagBaseURL,
			reuseExistingServer: false,
			timeout: 120_000,
			env: { ...e2eEnv, PORT: String(flightbagPort) },
		},
		{
			command: 'bun run dev',
			cwd: 'apps/hangar',
			url: hangarBaseURL,
			reuseExistingServer: false,
			timeout: 120_000,
			env: { ...e2eEnv, PORT: String(hangarPort) },
		},
		{
			// Flightbag integration -- dedicated vite process pointed at
			// `airboss_integration`. The `flightbag-coverage` project drives
			// 32 parallel workers against it; running it on its own port
			// (PORTS.FLIGHTBAG_INTEGRATION = 9647) keeps the e2e flightbag
			// webServer at 9643 free for `representative-pages.spec.ts`.
			command: 'bun run dev',
			cwd: 'apps/flightbag',
			url: flightbagIntegrationBaseURL,
			reuseExistingServer: false,
			timeout: 120_000,
			env: { ...integrationEnv, PORT: String(flightbagIntegrationPort) },
		},
	];
}
