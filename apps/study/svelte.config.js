import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { PRE_HYDRATION_SCRIPT_CSP_HASH } from '../../libs/themes/generated/pre-hydration.ts';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// Content-Security-Policy as defense-in-depth. `renderMarkdown` (used in
		// knowledge pages and learn flow) already escapes HTML before re-emitting
		// a narrow tag set, but CSP protects against future renderer regressions
		// and third-party components. SvelteKit auto-generates nonces for inline
		// scripts it emits; 'self' covers the rest. better-auth OAuth is same-origin
		// (all requests proxied through /api/auth) so no external connect-src is needed.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				// Hash allowlists the pre-hydration theme script substituted into
				// `src/app.html` by `transformPageChunk`. SvelteKit's `auto` mode
				// only nonces scripts it emits, not inline scripts in the
				// template. Without the hash CSP blocks the script, FOUC returns,
				// and `data-appearance` stays stuck on the HTML default. The
				// hash is regenerated alongside the script body by
				// `bun themes:emit` -- never edit by hand.
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
			'@ab/utils': '../../libs/utils/src/index.ts',
			'@ab/utils/*': '../../libs/utils/src/*',
			'@ab/themes': '../../libs/themes/index.ts',
			'@ab/themes/*': '../../libs/themes/*',
			'@ab/ui': '../../libs/ui/src/index.ts',
			'@ab/ui/*': '../../libs/ui/src/*',
			'@ab/bc-study': '../../libs/bc/study/src/index.ts',
			'@ab/bc-study/*': '../../libs/bc/study/src/*',
			'@ab/bc-sim': '../../libs/bc/sim/src/index.ts',
			'@ab/bc-sim/*': '../../libs/bc/sim/src/*',
			'@ab/bc-avionics': '../../libs/bc/avionics/src/index.ts',
			'@ab/bc-avionics/*': '../../libs/bc/avionics/src/*',
			'@ab/bc-hangar': '../../libs/bc/hangar/src/index.ts',
			'@ab/bc-hangar/*': '../../libs/bc/hangar/src/*',
			'@ab/audit': '../../libs/audit/src/index.ts',
			'@ab/audit/*': '../../libs/audit/src/*',
			'@ab/hangar-jobs': '../../libs/hangar-jobs/src/index.ts',
			'@ab/hangar-jobs/*': '../../libs/hangar-jobs/src/*',
			'@ab/hangar-sync': '../../libs/hangar-sync/src/index.ts',
			'@ab/hangar-sync/*': '../../libs/hangar-sync/src/*',
			'@ab/aviation': '../../libs/aviation/src/index.ts',
			'@ab/aviation/*': '../../libs/aviation/src/*',
			'@ab/help': '../../libs/help/src/index.ts',
			'@ab/help/*': '../../libs/help/src/*',
			'@ab/activities': '../../libs/activities/src/index.ts',
			'@ab/activities/*': '../../libs/activities/src/*',
			'@ab/sources': '../../libs/sources/src/index.ts',
			'@ab/sources/*': '../../libs/sources/src/*',
		},
		env: {
			dir: '../../',
		},
	},
};

export default config;
