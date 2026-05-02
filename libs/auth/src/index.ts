// Auth lib -- identity, sessions, permissions.
// Infrastructure: same interface for all apps.

// AuthEventEmitter contract -- duck-typed mirror of `@ab/audit`'s emitter
// shape. Apps inject `createAuditAuthEventEmitter()` into `createAuth` to
// route sign-in / sign-out events into the audit log.
export type {
	AuthEventContext,
	AuthEventEmitter,
	AuthLoginFailedOutcome,
} from './audit-events-contract';
// Guards and types
export { type AuthSession, type AuthUser, requireAuth, requireRole, requireVerifiedEmail } from './auth';
// Client-side auth (Svelte)
export { authClient } from './client';
// Reusable Drizzle column helpers tied to `bauthUser`
export { auditColumns } from './columns';
// Cookie forwarding
export { forwardAuthCookies, resolveCookieDomain, rewriteSetCookieDomain } from './cookies';
// Email transport and templates
export {
	type EmailMessage,
	inviteEmail,
	magicLinkEmail,
	resetPasswordEmail,
	sendEmail,
	verificationEmail,
} from './email';
// Logout
export { clearSessionCookies } from './logout';
// Read-only count helpers over `bauth_user`
export { countAllUsers } from './queries';
// Read-only Drizzle schemas for better-auth tables
export { bauthAccount, bauthRateLimit, bauthSession, bauthUser, bauthVerification } from './schema';
// Server-side auth factory
export { type Auth, createAuth } from './server';
