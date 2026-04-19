import { COOKIE_DOMAIN_DEV, COOKIE_DOMAIN_PROD, PORTS, ROLES } from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId } from '@ab/utils';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins/admin';
import { magicLink } from 'better-auth/plugins/magic-link';
import { magicLinkEmail, resetPasswordEmail, sendEmail, verificationEmail } from './email';
import { bauthAccount, bauthSession, bauthUser, bauthVerification } from './schema';

// Keys must match better-auth modelNames (snake_case)
const authSchema = {
	bauth_user: bauthUser,
	bauth_session: bauthSession,
	bauth_account: bauthAccount,
	bauth_verification: bauthVerification,
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
 */
export function createAuth(options: { secret: string; baseURL?: string; isDev?: boolean }) {
	return betterAuth({
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
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
			crossSubDomainCookies: {
				enabled: true,
				domain: options.isDev ? COOKIE_DOMAIN_DEV : COOKIE_DOMAIN_PROD,
			},
		},

		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false, // Enable later when email is fully tested
			sendResetPassword: async ({ user, url }) => {
				const { subject, html } = resetPasswordEmail(url, user.name);
				void sendEmail({ to: user.email, subject, html });
			},
		},

		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				const { subject, html } = verificationEmail(url, user.name);
				void sendEmail({ to: user.email, subject, html });
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
					void sendEmail({ to: email, subject, html });
				},
			}),
		],
	});
}

/** Type of the auth instance returned by createAuth. */
export type Auth = ReturnType<typeof createAuth>;
