import { defineConfig, devices } from '@playwright/test';
import { PORTS } from './libs/constants/src/ports';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORTS.STUDY}`;

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
			name: 'setup',
			testMatch: /global\.setup\.ts/,
		},
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'tests/e2e/.auth/learner.json',
			},
			dependencies: ['setup'],
			testIgnore: /unauthed\/.*/,
		},
		{
			name: 'chromium-unauthed',
			use: devices['Desktop Chrome'],
			testMatch: /unauthed\/.*\.spec\.ts/,
		},
	],
	webServer: {
		command: 'bun run dev',
		url: baseURL,
		reuseExistingServer: true,
		timeout: 60_000,
	},
});
