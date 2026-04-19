import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { HOSTS } from '../../libs/constants/src/hosts';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Bind to IPv4 loopback so study.airboss.test (which resolves to
		// 127.0.0.1 via the /etc/hosts entry added by `bun run setup`) can
		// connect. Without this, vite defaults to ::1 (IPv6 only) and IPv4
		// clients get ECONNREFUSED.
		host: '127.0.0.1',
		allowedHosts: [HOSTS.STUDY],
	},
});
