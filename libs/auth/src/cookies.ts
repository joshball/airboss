/**
 * Cookie helpers for forwarding better-auth session cookies.
 *
 * Centralizes cookie parsing, URL decoding, and security options
 * so all auth flows use consistent, secure settings.
 *
 * In dev, cookies are scoped to the current request host (localhost) so
 * the app works without an /etc/hosts entry. In prod, they're scoped to
 * the cross-subdomain cookie domain so all airboss surface apps share a
 * session.
 */

import { COOKIE_DOMAIN_PROD, SESSION_MAX_AGE_SECONDS } from '@ab/constants';
import type { Cookies } from '@sveltejs/kit';

/** Default cookie options shared across all auth cookie forwarding. */
function authCookieOptions(isDev: boolean, maxAgeSeconds?: number) {
	return {
		path: '/',
		domain: isDev ? undefined : COOKIE_DOMAIN_PROD,
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: !isDev,
		maxAge: maxAgeSeconds ?? SESSION_MAX_AGE_SECONDS,
	};
}

/** Decode a cookie value, falling back to the raw string if the encoding is malformed. */
function decodeCookieValue(raw: string): string {
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

/**
 * Parse Set-Cookie headers from a better-auth response and forward them
 * to the browser via SvelteKit's cookies API.
 *
 * Handles URL decoding of cookie values (better-auth encodes / and + chars)
 * and applies secure cookie options based on environment.
 */
export function forwardAuthCookies(
	authResponse: Response,
	cookies: Cookies,
	isDev: boolean,
	maxAgeSeconds?: number,
): void {
	const opts = authCookieOptions(isDev, maxAgeSeconds);
	const setCookieHeaders = authResponse.headers.getSetCookie?.() ?? [];
	for (const raw of setCookieHeaders) {
		const parts = raw.split(';');
		const [nameVal] = parts;
		const eqIndex = nameVal.indexOf('=');
		if (eqIndex === -1) continue;
		const name = nameVal.substring(0, eqIndex).trim();
		if (!name) continue;

		const value = decodeCookieValue(nameVal.substring(eqIndex + 1).trim());

		// Check if the response is clearing this cookie (sign-out)
		const rawLower = raw.toLowerCase();
		const isExpiring = rawLower.includes('max-age=0') || rawLower.includes('expires=thu, 01 jan 1970');

		if (isExpiring || value === '') {
			cookies.delete(name, { path: '/', domain: opts.domain });
		} else {
			cookies.set(name, value, opts);
		}
	}
}
