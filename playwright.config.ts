import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { DEV_DB_URL_E2E, ENV_VARS, PORTS } from './libs/constants/src';

const __dirname = dirname(fileURLToPath(import.meta.url));

// E2E ports = dev ports + 3. Tests get their own vite processes pointed at
// the e2e database, so a `bun run dev` session can keep running on the
// canonical ports without colliding. Override via env if you want to point
// the suite at a deployed preview instead.
const studyPort = PORTS.STUDY_E2E;
const hangarPort = PORTS.HANGAR_E2E;
const flightbagPort = PORTS.FLIGHTBAG_E2E;

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${studyPort}`;
const flightbagBaseURL = process.env.PLAYWRIGHT_FLIGHTBAG_BASE_URL ?? `http://127.0.0.1:${flightbagPort}`;
const hangarBaseURL = process.env.PLAYWRIGHT_HANGAR_BASE_URL ?? `http://127.0.0.1:${hangarPort}`;

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
const e2eEnv = {
	...rootEnv,
	[ENV_VARS.DATABASE_URL]: DEV_DB_URL_E2E,
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
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
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
			testIgnore: /unauthed\/.*|flightbag\/.*|hangar-review-queue\/.*/,
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
			testMatch: /hangar-review-queue\/.*\.spec\.ts/,
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
	],
	// Each webServer launches a dedicated vite process on the e2e port,
	// pointed at the e2e DB. `reuseExistingServer: false` so we never
	// silently bind to a `bun run dev` instance that's holding the
	// developer's working DB open -- that's exactly the cross-talk this
	// whole isolation pass is here to prevent.
	webServer: [
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
	],
});
