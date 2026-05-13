import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { PRE_HYDRATION_SCRIPT_CSP_HASH } from '../../libs/themes/generated/pre-hydration.ts';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// Content-Security-Policy as defense-in-depth. Mirrors apps/study:
		// auto-generated nonces cover SvelteKit inline scripts; self covers
		// the rest. better-auth OAuth is same-origin (all requests proxied
		// through /api/auth) so no external connect-src is needed.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				// Hash allowlists the shared pre-hydration script substituted
				// into `app.html` by `transformPageChunk` in hooks.server.ts.
				// SvelteKit's `auto` mode only nonces scripts it emits, not
				// scripts injected after template read. The hash is regenerated
				// alongside the body by `bun themes:emit` -- never edit by hand.
				'script-src': ['self', PRE_HYDRATION_SCRIPT_CSP_HASH],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self', 'data:'],
				'connect-src': ['self'],
				'frame-ancestors': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'object-src': ['none'],
			},
		},
		alias: {
			'@ab/constants': '../../libs/constants/src/index.ts',
			'@ab/constants/*': '../../libs/constants/src/*',
			'@ab/types': '../../libs/types/src/index.ts',
			'@ab/types/*': '../../libs/types/src/*',
			'@ab/db': '../../libs/db/src/index.ts',
			'@ab/db/*': '../../libs/db/src/*',
			'@ab/auth': '../../libs/auth/src/index.ts',
			'@ab/auth/*': '../../libs/auth/src/*',
			'@ab/audit': '../../libs/audit/src/index.ts',
			'@ab/audit/*': '../../libs/audit/src/*',
			'@ab/utils': '../../libs/utils/src/index.ts',
			'@ab/utils/*': '../../libs/utils/src/*',
			'@ab/themes': '../../libs/themes/index.ts',
			'@ab/themes/*': '../../libs/themes/*',
			'@ab/ui': '../../libs/ui/src/index.ts',
			'@ab/ui/*': '../../libs/ui/src/*',
			'@ab/aviation': '../../libs/aviation/src/index.ts',
			'@ab/aviation/*': '../../libs/aviation/src/*',
			'@ab/autocomplete': '../../libs/autocomplete/src/index.ts',
			'@ab/autocomplete/*': '../../libs/autocomplete/src/*',
			'@ab/hangar-jobs': '../../libs/hangar-jobs/src/index.ts',
			'@ab/hangar-jobs/*': '../../libs/hangar-jobs/src/*',
			'@ab/hangar-sync': '../../libs/hangar-sync/src/index.ts',
			'@ab/hangar-sync/*': '../../libs/hangar-sync/src/*',
			'@ab/bc-hangar': '../../libs/bc/hangar/src/index.ts',
			'@ab/bc-hangar/*': '../../libs/bc/hangar/src/*',
			'@ab/bc-ingest-review': '../../libs/bc/ingest-review/src/index.ts',
			'@ab/bc-ingest-review/*': '../../libs/bc/ingest-review/src/*',
			// course-reader-and-editor WP, Phase 6: the hangar courses editor
			// imports the study BC for course CRUD + the YAML schemas. The
			// editor never writes to study tables directly; the BC's read
			// helpers + `seedCourses()` pipeline carry the writes.
			'@ab/bc-study': '../../libs/bc/study/src/index.ts',
			'@ab/bc-study/*': '../../libs/bc/study/src/*',
			'@ab/bc-avionics': '../../libs/bc/avionics/src/index.ts',
			'@ab/bc-avionics/*': '../../libs/bc/avionics/src/*',
			'@ab/help': '../../libs/help/src/index.ts',
			'@ab/help/*': '../../libs/help/src/*',
			'@ab/sources': '../../libs/sources/src/index.ts',
			'@ab/sources/*': '../../libs/sources/src/*',
			// Hangar `/roadmap` Phase 8 imports the read-only WP loader from
			// `scripts/lib/wp-loader.ts` (server-only; uses node:fs). The
			// loader's top-of-file comment anticipates this exact callsite
			// (see ADR 025 + tracking-system-overhaul WP). Aliased so the
			// `+page.server.ts` import path stays grep-able and survives a
			// future loader move into a `libs/tracking/` server entry point.
			'@ab/wp-loader': '../../scripts/lib/wp-loader.ts',
			// course-reader-and-editor WP, Phase 6: hangar editor save actions
			// invoke the seed pipeline directly. Aliased so the import path
			// stays grep-able + a future move of the seed entry into
			// `libs/bc/study/src/seed-courses.ts` only touches one place.
			'@ab/seed-courses': '../../scripts/db/seed-courses.ts',
		},
		env: {
			dir: '../../',
		},
	},
};

export default config;
