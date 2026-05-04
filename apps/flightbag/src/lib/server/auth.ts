import { createAuth } from '@ab/auth';
import { ENV_VARS } from '@ab/constants';
import { building, dev } from '$app/environment';

/**
 * Flightbag's better-auth instance. The flightbag does not host the login UI
 * (study owns that). Flightbag only *reads* the cross-subdomain
 * `bauth_session_token` cookie and resolves it back to a user so server
 * endpoints can attribute reading-progress / heartbeat writes to the right
 * learner.
 *
 * Cookie domain is set in `libs/auth/src/server.ts` (cross-subdomain for
 * `*.airboss.test` in dev when /etc/hosts maps the subdomains; production
 * uses the real domain from BETTER_AUTH_URL).
 */
function getAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} environment variable is required`);
	}
	const baseURL = process.env[ENV_VARS.BETTER_AUTH_URL];
	return createAuth({ secret, baseURL, isDev: dev });
}

// Lazy init: skip during SvelteKit build analysis. SvelteKit's build pass
// imports this module; auth isn't initialised until runtime, so we satisfy
// the type with an `undefined` placeholder. Any caller during build is
// itself buggy -- runtime code paths never read this value during build.
export const auth = building ? (undefined as unknown as ReturnType<typeof createAuth>) : getAuth();
