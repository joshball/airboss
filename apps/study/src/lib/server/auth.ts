import { createAuth } from '@ab/auth';
import { ENV_VARS } from '@ab/constants';
import { building, dev } from '$app/environment';

function getAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} environment variable is required`);
	}

	return createAuth({ secret, isDev: dev });
}

// Lazy init: skip during SvelteKit build analysis
export const auth = building ? (undefined as unknown as ReturnType<typeof createAuth>) : getAuth();
