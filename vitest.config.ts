import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		// Keep this alias list symmetric with `tsconfig.json` `paths` and
		// `apps/*/svelte.config.js` `alias`. Three registries, one source of
		// truth for what's real. The sub-path entries (`@ab/constants/env`,
		// `@ab/auth/schema`) are covered by the wildcard variants below --
		// they stay listed to document the most common deep imports.
		alias: {
			'@ab/constants/env': resolve('./libs/constants/src/env.ts'),
			'@ab/constants': resolve('./libs/constants/src/index.ts'),
			'@ab/types': resolve('./libs/types/src/index.ts'),
			'@ab/db': resolve('./libs/db/src/index.ts'),
			'@ab/auth/schema': resolve('./libs/auth/src/schema.ts'),
			'@ab/auth': resolve('./libs/auth/src/index.ts'),
			'@ab/themes': resolve('./libs/themes/index.ts'),
			'@ab/ui': resolve('./libs/ui/src/index.ts'),
			'@ab/utils': resolve('./libs/utils/src/index.ts'),
			'@ab/bc-study': resolve('./libs/bc/study/src/index.ts'),
			'@ab/bc-sim': resolve('./libs/bc/sim/src/index.ts'),
			'@ab/aviation/sources': resolve('./libs/aviation/src/sources/index.ts'),
			'@ab/aviation': resolve('./libs/aviation/src/index.ts'),
			'@ab/help': resolve('./libs/help/src/index.ts'),
			'@ab/activities': resolve('./libs/activities/src/index.ts'),
		},
	},
	test: {
		environment: 'node',
		include: ['libs/**/*.test.ts', 'scripts/**/*.test.ts', 'tools/**/*.test.ts'],
		// Load the dev `.env` before any test module runs. Required for any
		// BC test that touches the shared db connection.
		setupFiles: ['./vitest.setup.ts'],
		coverage: {
			provider: 'v8',
			include: ['libs/**/*.ts'],
			exclude: ['libs/**/*.test.ts', 'libs/**/*.d.ts', 'libs/db/src/**', 'libs/constants/src/**'],
			reporter: ['text', 'html', 'json-summary'],
		},
	},
});
