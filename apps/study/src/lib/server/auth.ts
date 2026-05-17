import { createAuditAuthEventEmitter } from '@ab/audit/server';
import { createAuth } from '@ab/auth';
import { ENV_VARS, getEnvBool } from '@ab/constants';
import { building, dev } from '$app/environment';

function getAuth() {
	const secret = process.env[ENV_VARS.BETTER_AUTH_SECRET];
	if (!secret) {
		throw new Error(`${ENV_VARS.BETTER_AUTH_SECRET} environment variable is required`);
	}

	// BETTER_AUTH_URL drives trustedOrigins (CSRF) and email-embedded links.
	// Required in prod; the lib falls back to localhost:STUDY in dev.
	const baseURL = process.env[ENV_VARS.BETTER_AUTH_URL];

	// The e2e webServer disables the rate limiter (every parallel worker
	// shares `127.0.0.1`, so the rate-limit key both throttles the suite and
	// races better-auth's upsert on `bauth_rate_limit`). Default: enabled.
	const rateLimitEnabled = getEnvBool(ENV_VARS.AUTH_RATE_LIMIT_ENABLED, true);

	// Wire audit emission so every sign-in / failed sign-in / sign-out lands
	// in `audit.audit_log`. Hangar admin home reads this to answer "who
	// signed in last hour" and to spot brute-force traffic.
	return createAuth({
		secret,
		baseURL,
		isDev: dev,
		rateLimitEnabled,
		authEventEmitter: createAuditAuthEventEmitter(),
	});
}

// Lazy init: skip during SvelteKit build analysis. SvelteKit's build pass
// imports this module; auth isn't initialised until runtime, so we satisfy
// the type with an `undefined` placeholder. Any caller during build is
// itself buggy -- runtime code paths never read this value during build.
export const auth = building ? (undefined as unknown as ReturnType<typeof createAuth>) : getAuth();
