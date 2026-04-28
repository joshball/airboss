// Auth lib -- identity, sessions, permissions.
// Infrastructure: same interface for all apps.

// Guards and types
export { type AuthSession, type AuthUser, requireAuth, requireRole, requireVerifiedEmail } from './auth';
// Client-side auth (Svelte)
export { authClient } from './client';
// Reusable Drizzle column helpers tied to `bauthUser`
export { auditColumns } from './columns';
// Cookie forwarding
export { forwardAuthCookies, resolveCookieDomain, rewriteSetCookieDomain } from './cookies';
// Email transport and templates
export { type EmailMessage, magicLinkEmail, resetPasswordEmail, sendEmail, verificationEmail } from './email';
// Logout
export { clearSessionCookies } from './logout';
// Read-only count helpers over `bauth_user`
export { countAllUsers } from './queries';
// Read-only Drizzle schemas for better-auth tables
export { bauthAccount, bauthSession, bauthUser, bauthVerification } from './schema';
// Server-side auth factory
export { type Auth, createAuth } from './server';
