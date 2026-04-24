import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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
				// Hash allowlists the hand-authored pre-hydration theme script in
				// `src/app.html` -- SvelteKit's `auto` mode only nonces scripts it
				// emits, not inline scripts in the template. Without the hash CSP
				// blocks the script, FOUC returns, and `data-appearance` stays
				// stuck on the HTML default. Regenerate with:
				//   bun -e "import('crypto').then(c=>import('fs/promises').then(async f=>{const m=(await f.readFile('apps/study/src/app.html','utf8')).match(/<script>([\\s\\S]*?)<\\/script>/);console.log('sha256-'+c.createHash('sha256').update(m[1]).digest('base64'))}))"
				// The FOUC Playwright test (tests/e2e/unauthed/theme-fouc.spec.ts)
				// fails if this hash drifts.
				'script-src': ['self', 'sha256-uZg+LUdqFwlAPrf1bltQac2iAlhXLPA7JuD/P3RE684='],
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
			'@ab/aviation': '../../libs/aviation/src/index.ts',
			'@ab/aviation/*': '../../libs/aviation/src/*',
			'@ab/help': '../../libs/help/src/index.ts',
			'@ab/help/*': '../../libs/help/src/*',
			'@ab/activities': '../../libs/activities/src/index.ts',
			'@ab/activities/*': '../../libs/activities/src/*',
		},
		env: {
			dir: '../../',
		},
	},
};

export default config;
