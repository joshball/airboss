import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
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
			'@ab/activities/*': '../../libs/activities/*',
		},
		env: {
			dir: '../../',
		},
	},
};

export default config;
