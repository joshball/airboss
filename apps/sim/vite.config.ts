import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { HOSTS } from '../../libs/constants/src/hosts';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: '127.0.0.1',
		allowedHosts: [HOSTS.SIM],
	},
});
