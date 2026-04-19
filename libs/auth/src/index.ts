// Auth lib -- identity, sessions, permissions.
// Infrastructure: same interface for all apps.

// Guards and types
export { type AuthSession, type AuthUser, requireAuth, requireRole } from './auth';
// Client-side auth (Svelte)
export { authClient } from './client';
// Cookie forwarding
export { forwardAuthCookies } from './cookies';
// Email transport and templates
export { type EmailMessage, magicLinkEmail, resetPasswordEmail, sendEmail, verificationEmail } from './email';
// Logout
export { clearSessionCookies } from './logout';
// Read-only Drizzle schemas for better-auth tables
export { bauthAccount, bauthSession, bauthUser, bauthVerification } from './schema';
// Server-side auth factory
export { type Auth, createAuth } from './server';
