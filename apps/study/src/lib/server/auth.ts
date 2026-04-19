import { createAuth } from '@ab/auth';
import { PORTS } from '@ab/constants';
import { building, dev } from '$app/environment';

function getAuth() {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error('BETTER_AUTH_SECRET environment variable is required');
	}

	return createAuth({ secret, baseURL: `http://localhost:${PORTS.STUDY}`, isDev: dev });
}

// Lazy init: skip during SvelteKit build analysis
export const auth = building ? (undefined as unknown as ReturnType<typeof createAuth>) : getAuth();
