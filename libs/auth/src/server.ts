import {
	AUTH_RATE_LIMIT,
	BETTER_AUTH_ENDPOINTS,
	COOKIE_DOMAIN_DEV,
	COOKIE_DOMAIN_PROD,
	DB_ADAPTER_PROVIDER,
	PORTS,
	ROLES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins/admin';
import { magicLink } from 'better-auth/plugins/magic-link';
import { magicLinkEmail, resetPasswordEmail, sendEmail, verificationEmail } from './email';
import { bauthAccount, bauthRateLimit, bauthSession, bauthUser, bauthVerification } from './schema';

// Keys must match better-auth modelNames (snake_case).
// The rate-limit table key uses the configured `modelName` so
// drizzle-adapter resolves it to the same Drizzle table.
const authSchema = {
	bauth_user: bauthUser,
	bauth_session: bauthSession,
	bauth_account: bauthAccount,
	bauth_verification: bauthVerification,
	[AUTH_RATE_LIMIT.TABLE_NAME]: bauthRateLimit,
};

/**
 * Create a better-auth instance configured for airboss.
 *
 * Uses Drizzle adapter with the shared db connection.
 * All better-auth tables are prefixed with "bauth_".
 *
 * @param options.secret - BETTER_AUTH_SECRET env var for signing sessions.
 * @param options.baseURL - Base URL for the app (defaults to localhost:STUDY).
 * @param options.isDev - Whether running in dev mode (controls cookie domain).
 * @param options.rateLimitEnabled - Override rate-limit enablement. Defaults to
 *   `true` in every environment so the limit is on in dev, prod, and tests.
 *   Tests that need to bypass it can pass `false` and reset the storage table
 *   between cases.
 */
export function createAuth(options: { secret: string; baseURL?: string; isDev?: boolean; rateLimitEnabled?: boolean }) {
	return betterAuth({
		database: drizzleAdapter(db, { provider: DB_ADAPTER_PROVIDER, schema: authSchema }),
		baseURL: options.baseURL ?? `http://localhost:${PORTS.STUDY}`,
		secret: options.secret,

		// Prefix all better-auth tables with bauth_
		user: {
			modelName: 'bauth_user',
			additionalFields: {
				firstName: {
					type: 'string',
					required: true,
					input: true,
				},
				lastName: {
					type: 'string',
					required: true,
					input: true,
				},
			},
		},
		session: {
			modelName: 'bauth_session',
			// Enable cookie-cache so getSession doesn't hit the DB on every request.
			// 5-min TTL: short enough that ban / revoke propagates quickly, long
			// enough to absorb the typical review-session burst.
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60,
			},
		},
		account: {
			modelName: 'bauth_account',
		},
		verification: {
			modelName: 'bauth_verification',
		},

		advanced: {
			database: {
				generateId: () => generateAuthId(),
			},
			// Cross-subdomain cookies let sessions flow across the airboss
			// surface apps (study, hangar, spatial, ...) in both dev and prod.
			// Dev requires /etc/hosts entries mapping the subdomains to
			// 127.0.0.1; `bun run setup` verifies them.
			crossSubDomainCookies: {
				enabled: true,
				domain: options.isDev ? COOKIE_DOMAIN_DEV : COOKIE_DOMAIN_PROD,
			},
		},

		// Database-backed rate limit. Survives a process restart and is shared
		// across instances behind a load balancer; better-auth's default is
		// memory-only, which both buckets every request behind a multi-instance
		// deploy into independent slots and resets at every redeploy.
		//
		// Window/max defaults below cover every `/api/auth/*` endpoint;
		// `customRules` clamps the high-cost paths -- sign-in (brute-force
		// surface) and the two email-trigger endpoints (magic-link request and
		// password-reset request, where success cost is an outbound email).
		rateLimit: {
			enabled: options.rateLimitEnabled ?? true,
			storage: 'database',
			modelName: AUTH_RATE_LIMIT.TABLE_NAME,
			window: AUTH_RATE_LIMIT.WINDOW_SECONDS,
			max: AUTH_RATE_LIMIT.MAX_REQUESTS,
			customRules: {
				[BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL]: {
					window: AUTH_RATE_LIMIT.SIGN_IN_WINDOW_SECONDS,
					max: AUTH_RATE_LIMIT.SIGN_IN_MAX_REQUESTS,
				},
				[BETTER_AUTH_ENDPOINTS.MAGIC_LINK]: {
					window: AUTH_RATE_LIMIT.EMAIL_TRIGGER_WINDOW_SECONDS,
					max: AUTH_RATE_LIMIT.EMAIL_TRIGGER_MAX_REQUESTS,
				},
				[BETTER_AUTH_ENDPOINTS.FORGET_PASSWORD]: {
					window: AUTH_RATE_LIMIT.EMAIL_TRIGGER_WINDOW_SECONDS,
					max: AUTH_RATE_LIMIT.EMAIL_TRIGGER_MAX_REQUESTS,
				},
				[BETTER_AUTH_ENDPOINTS.REQUEST_PASSWORD_RESET]: {
					window: AUTH_RATE_LIMIT.EMAIL_TRIGGER_WINDOW_SECONDS,
					max: AUTH_RATE_LIMIT.EMAIL_TRIGGER_MAX_REQUESTS,
				},
			},
		},

		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			sendResetPassword: async ({ user, url }) => {
				const { subject, html } = resetPasswordEmail(url, user.name);
				await sendEmail({ to: user.email, subject, html });
			},
		},

		// Verification gating stays disabled until the email transport is
		// production-ready. We also skip sendOnSignUp so users don't receive a
		// verification email that has no effect -- re-enable both together.
		emailVerification: {
			sendOnSignUp: false,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				const { subject, html } = verificationEmail(url, user.name);
				await sendEmail({ to: user.email, subject, html });
			},
		},

		plugins: [
			admin({
				defaultRole: ROLES.LEARNER,
				adminRoles: [ROLES.ADMIN],
			}),
			magicLink({
				sendMagicLink: async ({ email, url }) => {
					const { subject, html } = magicLinkEmail(url);
					await sendEmail({ to: email, subject, html });
				},
			}),
		],
	});
}

/** Type of the auth instance returned by createAuth. */
export type Auth = ReturnType<typeof createAuth>;
