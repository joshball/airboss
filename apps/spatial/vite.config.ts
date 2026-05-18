import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { HOSTS } from '../../libs/constants/src/hosts';
import { PORTS } from '../../libs/constants/src/ports';

const port = Number(process.env.PORT ?? PORTS.SPATIAL);

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: '127.0.0.1',
		port,
		strictPort: true,
		allowedHosts: [HOSTS.SPATIAL],
	},
});
