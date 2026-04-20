/**
 * Cookie helpers for forwarding better-auth session cookies.
 *
 * Centralizes cookie parsing, URL decoding, and security options
 * so all auth flows use consistent, secure settings.
 *
 * The Domain attribute is chosen per-request:
 * - If the request host lives under the configured cross-subdomain domain
 *   (`.airboss.test` in dev, `.air-boss.org` in prod), Domain is set so
 *   sessions flow across surface apps.
 * - Otherwise (127.0.0.1, localhost, LAN IPs), Domain is omitted -> the
 *   cookie becomes host-only. This lets dev work both on
 *   `study.airboss.test` and on `127.0.0.1` without swapping config.
 */

import { COOKIE_DOMAIN_DEV, COOKIE_DOMAIN_PROD, SESSION_MAX_AGE_SECONDS } from '@ab/constants';
import type { Cookies } from '@sveltejs/kit';

/**
 * Pick the Domain cookie attribute for a request host. Returns the
 * configured cross-subdomain domain when `host` is under it, otherwise
 * undefined (caller should omit Domain -> browser scopes the cookie to
 * the exact host).
 */
export function resolveCookieDomain(host: string | null | undefined, isDev: boolean): string | undefined {
	const configured = isDev ? COOKIE_DOMAIN_DEV : COOKIE_DOMAIN_PROD;
	if (!host) return undefined;
	const hostname = host.split(':')[0].toLowerCase();
	const base = configured.startsWith('.') ? configured.slice(1) : configured;
	if (hostname === base || hostname.endsWith(`.${base}`)) return configured;
	return undefined;
}

function authCookieOptions(isDev: boolean, host: string | null | undefined, maxAgeSeconds?: number) {
	const domain = resolveCookieDomain(host, isDev);
	return {
		path: '/',
		...(domain ? { domain } : {}),
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
 * and applies secure cookie options based on environment and request host.
 */
export function forwardAuthCookies(
	authResponse: Response,
	cookies: Cookies,
	isDev: boolean,
	host: string | null | undefined,
	maxAgeSeconds?: number,
): void {
	const opts = authCookieOptions(isDev, host, maxAgeSeconds);
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
			cookies.delete(name, { path: '/', ...(opts.domain ? { domain: opts.domain } : {}) });
		} else {
			cookies.set(name, value, opts);
		}
	}
}

/**
 * Rewrite the Domain attribute on every Set-Cookie header in `response`
 * to match what's appropriate for the request host. Used in the hooks
 * passthrough path where better-auth's Response flows straight to the
 * browser -- better-auth bakes the configured cross-subdomain domain into
 * every Set-Cookie, but we need to strip it when the browser is on
 * 127.0.0.1 / localhost so the cookie isn't silently dropped.
 *
 * Returns a new Response; the body stream is re-used (not consumed).
 */
export function rewriteSetCookieDomain(response: Response, host: string | null | undefined, isDev: boolean): Response {
	const setCookies = response.headers.getSetCookie?.() ?? [];
	if (setCookies.length === 0) return response;

	const domain = resolveCookieDomain(host, isDev);
	const newHeaders = new Headers(response.headers);
	newHeaders.delete('set-cookie');
	for (const raw of setCookies) {
		newHeaders.append('set-cookie', replaceCookieDomain(raw, domain));
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

function replaceCookieDomain(cookie: string, domain: string | undefined): string {
	const parts = cookie
		.split(';')
		.map((p) => p.trim())
		.filter((p) => p.length > 0 && !/^domain\s*=/i.test(p));
	if (domain) parts.push(`Domain=${domain}`);
	return parts.join('; ');
}
