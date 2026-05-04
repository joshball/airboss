import { defineConfig, devices } from '@playwright/test';
import { PORTS } from './libs/constants/src/ports';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORTS.STUDY}`;
const flightbagBaseURL = process.env.PLAYWRIGHT_FLIGHTBAG_BASE_URL ?? `http://localhost:${PORTS.FLIGHTBAG}`;
const hangarBaseURL = process.env.PLAYWRIGHT_HANGAR_BASE_URL ?? `http://localhost:${PORTS.HANGAR}`;

export default defineConfig({
	testDir: './tests/e2e',
	outputDir: './tests/e2e/.out',
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
		actionTimeout: 5_000,
		navigationTimeout: 10_000,
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
	webServer: [
		{
			command: 'bun run dev',
			url: baseURL,
			reuseExistingServer: true,
			timeout: 60_000,
		},
		{
			command: 'cd apps/flightbag && bun run dev',
			url: flightbagBaseURL,
			reuseExistingServer: true,
			timeout: 60_000,
		},
		{
			command: 'cd apps/hangar && bun run dev',
			url: hangarBaseURL,
			reuseExistingServer: true,
			timeout: 60_000,
		},
	],
});
