import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { HOSTS } from '../../libs/constants/src/hosts';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: [HOSTS.STUDY],
	},
});
