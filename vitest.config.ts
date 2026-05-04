import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Keep this alias list symmetric with `tsconfig.json` `paths` and
// `apps/*/svelte.config.js` `alias`. Three registries, one source of
// truth for what's real. The sub-path entries (`@ab/constants/env`,
// `@ab/auth/schema`) are covered by the wildcard variants below --
// they stay listed to document the most common deep imports.
const aliases = {
	'@ab/constants/env': resolve('./libs/constants/src/env.ts'),
	'@ab/constants': resolve('./libs/constants/src/index.ts'),
	'@ab/types': resolve('./libs/types/src/index.ts'),
	'@ab/db/connection': resolve('./libs/db/src/connection.ts'),
	'@ab/db': resolve('./libs/db/src/index.ts'),
	'@ab/auth/schema': resolve('./libs/auth/src/schema.ts'),
	'@ab/auth': resolve('./libs/auth/src/index.ts'),
	'@ab/audit': resolve('./libs/audit/src/index.ts'),
	'@ab/themes': resolve('./libs/themes/index.ts'),
	// Deep `@ab/ui/components/<Name>.svelte` imports mirror the SvelteKit
	// app aliases. The wildcard at the bottom (`@ab/ui/*`) handles every
	// other component without needing to enumerate them here.
	'@ab/ui/components/Drawer.svelte': resolve('./libs/ui/src/components/Drawer.svelte'),
	'@ab/ui/components': resolve('./libs/ui/src/components'),
	'@ab/ui/lib/focus-trap': resolve('./libs/ui/src/lib/focus-trap.ts'),
	'@ab/ui/lib/info-tip-resolver': resolve('./libs/ui/src/lib/info-tip-resolver.ts'),
	'@ab/ui/lib': resolve('./libs/ui/src/lib'),
	'@ab/ui': resolve('./libs/ui/src/index.ts'),
	'@ab/utils': resolve('./libs/utils/src/index.ts'),
	'@ab/bc-study/build': resolve('./libs/bc/study/src/build.ts'),
	'@ab/bc-study/schema': resolve('./libs/bc/study/src/schema.ts'),
	'@ab/bc-study/srs': resolve('./libs/bc/study/src/srs.ts'),
	'@ab/bc-study': resolve('./libs/bc/study/src/index.ts'),
	'@ab/bc-sim/persistence': resolve('./libs/bc/sim/src/persistence.ts'),
	'@ab/bc-sim': resolve('./libs/bc/sim/src/index.ts'),
	'@ab/bc-hangar/schema-types': resolve('./libs/bc/hangar/src/schema-types.ts'),
	'@ab/bc-hangar/schema': resolve('./libs/bc/hangar/src/schema.ts'),
	'@ab/bc-hangar/source-seed-registry': resolve('./libs/bc/hangar/src/source-seed-registry.ts'),
	'@ab/bc-hangar': resolve('./libs/bc/hangar/src/index.ts'),
	'@ab/aviation/sources': resolve('./libs/aviation/src/sources/index.ts'),
	'@ab/aviation/ui/ReferenceText.svelte': resolve('./libs/aviation/src/ui/ReferenceText.svelte'),
	'@ab/aviation/ui': resolve('./libs/aviation/src/ui'),
	'@ab/aviation': resolve('./libs/aviation/src/index.ts'),
	'@ab/help': resolve('./libs/help/src/index.ts'),
	'@ab/activities/crosswind-component/CrosswindComponent.svelte': resolve(
		'./libs/activities/src/crosswind-component/CrosswindComponent.svelte',
	),
	'@ab/activities/pfd': resolve('./libs/activities/src/pfd'),
	'@ab/activities/cockpit-panel': resolve('./libs/activities/src/cockpit-panel'),
	'@ab/activities/crosswind-component': resolve('./libs/activities/src/crosswind-component'),
	'@ab/activities': resolve('./libs/activities/src/index.ts'),
	'@ab/hangar-jobs/schema': resolve('./libs/hangar-jobs/src/schema.ts'),
	'@ab/hangar-jobs': resolve('./libs/hangar-jobs/src/index.ts'),
	'@ab/hangar-sync': resolve('./libs/hangar-sync/src/index.ts'),
	'@ab/library/RenderedSection.svelte': resolve('./libs/library/src/RenderedSection.svelte'),
	'@ab/library/CitationChip.svelte': resolve('./libs/library/src/CitationChip.svelte'),
	'@ab/library/SourceLinks.svelte': resolve('./libs/library/src/SourceLinks.svelte'),
	'@ab/library': resolve('./libs/library/src/index.ts'),
	'@ab/sources/registry/__test_helpers__': resolve('./libs/sources/src/registry/__test_helpers__.ts'),
	'@ab/sources/registry': resolve('./libs/sources/src/registry/index.ts'),
	'@ab/sources/regs': resolve('./libs/sources/src/regs/index.ts'),
	'@ab/sources/handbooks-extras': resolve('./libs/sources/src/handbooks-extras/index.ts'),
	'@ab/sources/handbooks': resolve('./libs/sources/src/handbooks/index.ts'),
	'@ab/sources/aim': resolve('./libs/sources/src/aim/index.ts'),
	'@ab/sources/ac': resolve('./libs/sources/src/ac/index.ts'),
	'@ab/sources/acs': resolve('./libs/sources/src/acs/index.ts'),
	'@ab/sources/safo': resolve('./libs/sources/src/safo/index.ts'),
	'@ab/sources/info': resolve('./libs/sources/src/info/index.ts'),
	'@ab/sources': resolve('./libs/sources/src/index.ts'),
};

// `$app/state` is a SvelteKit runtime module. The standalone DOM project
// doesn't ship SvelteKit, so we point library DOM tests at a static stub
// that exposes the same shape (page / navigating / updated). Apps still
// resolve the real module via their own svelte.config.js / vite.config.ts.
const domAliases = {
	...aliases,
	$app: resolve('./libs/ui/__tests__/stubs/app'),
};

// Two-project workspace:
//   - `unit-node`: every existing `.test.ts` runs in a node env. BC/lib
//     logic, server endpoints, schema codegen -- none of this needs a
//     DOM and pulling in happy-dom across all 600+ tests would slow the
//     suite. Globs explicitly EXCLUDE `*.svelte.test.ts` so component
//     tests never accidentally run here.
//   - `unit-dom`: `*.svelte.test.ts` files run under happy-dom with the
//     svelte vite plugin loaded. happy-dom (not jsdom) for Svelte/Vite
//     stacks: faster, modern default, sufficient for focus / keyboard /
//     ARIA-attribute reads which is all the picker tests need.
export default defineConfig({
	resolve: { alias: aliases },
	test: {
		coverage: {
			provider: 'v8',
			include: ['libs/**/*.ts'],
			exclude: [
				'libs/**/*.test.ts',
				'libs/**/*.svelte.test.ts',
				'libs/**/*.d.ts',
				'libs/db/src/**',
				'libs/constants/src/**',
			],
			reporter: ['text', 'html', 'json-summary'],
		},
		projects: [
			{
				resolve: { alias: aliases },
				test: {
					name: 'unit-node',
					environment: 'node',
					include: ['libs/**/*.test.ts', 'scripts/**/*.test.ts', 'tools/**/*.test.ts', 'apps/**/*.test.ts'],
					exclude: [
						'libs/**/*.svelte.test.ts',
						'apps/**/*.svelte.test.ts',
						'**/node_modules/**',
						'**/dist/**',
						'**/.svelte-kit/**',
					],
					// Load the dev `.env` before any test module runs. Required for any
					// BC test that touches the shared db connection.
					setupFiles: ['./vitest.setup.ts'],
				},
			},
			{
				plugins: [svelte({ hot: false })],
				resolve: { alias: domAliases, conditions: ['browser'] },
				test: {
					name: 'unit-dom',
					environment: 'happy-dom',
					include: ['libs/**/*.svelte.test.ts', 'apps/**/*.svelte.test.ts'],
					exclude: ['**/node_modules/**', '**/dist/**', '**/.svelte-kit/**'],
					// `@testing-library/jest-dom/vitest` registers DOM matchers
					// (`.toBeInTheDocument()`, etc.) used by Svelte component
					// tests. Loaded only on the DOM project; node tests have
					// no DOM and don't need them.
					setupFiles: ['./vitest.setup.ts', './vitest.setup.dom.ts'],
				},
			},
		],
	},
});
