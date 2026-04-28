import { createAuth } from '@ab/auth';
import { ENV_VARS } from '@ab/constants';
import { building, dev } from '$app/environment';

/**
 * Avionics' better-auth instance. Avionics does not host the login UI --
 * that lives on study (`study.airboss.test`). Avionics only needs to
 * *read* the cross-subdomain `bauth_session_token` cookie and resolve
 * it back to a user, so server endpoints can attribute persisted
 * progress to the right learner.
 *
 * Cookie domain is set in `libs/auth/src/server.ts` (cross-subdomain
 * for `*.airboss.test` in dev when /etc/hosts maps the subdomains;
 * production uses the real domain from BETTER_AUTH_URL).
 */
function getAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} environment variable is required`);
	}
	const baseURL = process.env[ENV_VARS.BETTER_AUTH_URL];
	return createAuth({ secret, baseURL, isDev: dev });
}

// Lazy init: skip during SvelteKit build analysis.
export const auth = building ? (undefined as unknown as ReturnType<typeof createAuth>) : getAuth();
