import { createAuth } from '@ab/auth';
import { ENV_VARS } from '@ab/constants';
import { building, dev } from '$app/environment';

function getAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} environment variable is required`);
	}

	// BETTER_AUTH_URL drives trustedOrigins (CSRF) and email-embedded links.
	// Required in prod; the lib falls back to localhost:STUDY in dev.
	const baseURL = process.env[ENV_VARS.BETTER_AUTH_URL];

	return createAuth({ secret, baseURL, isDev: dev });
}

// Lazy init: skip during SvelteKit build analysis
export const auth = building ? (undefined as unknown as ReturnType<typeof createAuth>) : getAuth();
