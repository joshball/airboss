/**
 * Helper: wipe better-auth's per-IP sign-in rate-limit bucket against the
 * e2e database.
 *
 * Better-auth caps `/sign-in/email` to ~5 attempts per minute per client
 * IP. Every test in the suite hits the dev server from `127.0.0.1`, so a
 * spec that drives more than five sign-ins (auth.spec walks six) silently
 * locks out every later spec that needs to authenticate (storage-state
 * setup, fresh-user fixtures, hangar admin login). Resetting the bucket
 * before each affected test keeps the limiter useful in production while
 * letting the suite drive every login surface deterministically.
 *
 * Hard-pins to the e2e DB by design -- bun's auto-loaded `DATABASE_URL`
 * points at the developer's working DB, which is NOT what the playwright
 * webServer entries connect to.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { bauthRateLimit } from '../../../libs/auth/src/schema';
import { DEV_DB_URL_E2E } from '../../../libs/constants/src';

export async function clearAuthRateLimit(): Promise<void> {
	const client = postgres(DEV_DB_URL_E2E, { max: 1 });
	try {
		await drizzle(client).delete(bauthRateLimit);
	} finally {
		await client.end({ timeout: 1 });
	}
}
