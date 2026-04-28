/**
 * Auth constants tests.
 *
 * The `AUTH_RATE_LIMIT` policy is consumed by `libs/auth/src/server.ts` to
 * configure better-auth's `rateLimit.customRules`. The shape and the
 * tightening relationship between default and per-endpoint limits is the
 * security contract -- a regression here would silently widen the
 * brute-force / email-flood window on sign-in or password-reset triggers.
 *
 * The integration test in `libs/auth/src/rate-limit.test.ts` verifies the
 * sign-in surface end-to-end (window + max + DB persistence). These tests
 * are the policy guards: they assert the constant SHAPES so a typo or a
 * loosening of the cap is caught at the constant boundary, before the
 * better-auth wiring runs.
 */

import { describe, expect, it } from 'vitest';
import { AUTH_RATE_LIMIT, BETTER_AUTH_ENDPOINTS } from './auth';

describe('AUTH_RATE_LIMIT', () => {
	it('exposes default window + max for any /api/auth/* endpoint', () => {
		expect(AUTH_RATE_LIMIT.WINDOW_SECONDS).toBeGreaterThan(0);
		expect(AUTH_RATE_LIMIT.MAX_REQUESTS).toBeGreaterThan(0);
	});

	it('sign-in policy is at least as tight as the default (smaller max OR same window)', () => {
		// Sign-in is the brute-force surface; the per-endpoint clamp must
		// not be wider than the default fallback. If someone swaps the
		// numbers, the test fails before the policy reaches better-auth.
		expect(AUTH_RATE_LIMIT.SIGN_IN_MAX_REQUESTS).toBeLessThanOrEqual(AUTH_RATE_LIMIT.MAX_REQUESTS);
		expect(AUTH_RATE_LIMIT.SIGN_IN_WINDOW_SECONDS).toBeGreaterThan(0);
	});

	it('email-trigger policy caps at 3 / 5 minutes (matches policy doc)', () => {
		// Magic-link + password-reset trigger an email on success. Cap at 3
		// per 5 minutes prevents inbox flooding and SMTP-quota burn.
		expect(AUTH_RATE_LIMIT.EMAIL_TRIGGER_WINDOW_SECONDS).toBe(60 * 5);
		expect(AUTH_RATE_LIMIT.EMAIL_TRIGGER_MAX_REQUESTS).toBe(3);
	});

	it('email-trigger window is wider than sign-in window (per-endpoint shape)', () => {
		// Email triggers should bucket over a longer window than sign-in
		// because the success cost is higher (an email goes out per request)
		// and brute-force on an email link is far slower-paced than password
		// stuffing.
		expect(AUTH_RATE_LIMIT.EMAIL_TRIGGER_WINDOW_SECONDS).toBeGreaterThanOrEqual(AUTH_RATE_LIMIT.SIGN_IN_WINDOW_SECONDS);
	});

	it('points at the better-auth-prefixed table name', () => {
		// Drizzle generates the table; the constant double-checks that the
		// adapter and the schema agree on the name. Drift here surfaces as
		// 500s on the rate-limit insert.
		expect(AUTH_RATE_LIMIT.TABLE_NAME).toBe('bauth_rate_limit');
	});

	it('exposes every endpoint that has a per-endpoint rule', () => {
		// The per-endpoint custom-rule wiring in libs/auth/src/server.ts
		// references these endpoints. If one is renamed without updating
		// the wiring, the policy silently falls back to the default.
		expect(BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL).toBe('/sign-in/email');
		expect(BETTER_AUTH_ENDPOINTS.MAGIC_LINK).toBe('/sign-in/magic-link');
		expect(BETTER_AUTH_ENDPOINTS.REQUEST_PASSWORD_RESET).toBe('/request-password-reset');
		expect(BETTER_AUTH_ENDPOINTS.FORGET_PASSWORD).toBe('/forget-password');
	});
});
