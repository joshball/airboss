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

function authCookieOptions(isDev: boolean, host: string | null | undefined, maxAgeSeconds: number) {
	const domain = resolveCookieDomain(host, isDev);
	return {
		path: '/',
		...(domain ? { domain } : {}),
		httpOnly: true,
		// sameSite=strict: there are no cross-origin entry points (no OAuth,
		// no magic-link email sign-in, no public content). All mutation is
		// POST form actions, and SameSite never relaxes POST. Tightening from
		// `lax` closes the residual gap where a future `+server.ts` GET handler
		// could be triggered by a cross-origin top-level navigation.
		// If magic-link or OAuth lands later, downgrade to `lax` at that point.
		sameSite: 'strict' as const,
		secure: !isDev,
		maxAge: maxAgeSeconds,
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
 * Parse the per-cookie lifetime from a Set-Cookie header. Prefers Max-Age
 * (RFC 6265 §5.2.2 -- takes precedence over Expires when both are present).
 * Returns the lifetime in seconds, or `undefined` if neither attribute was set.
 *
 * Critical for security: better-auth issues short-lived cookies (e.g. the
 * 5-minute `bauth_session_data` cookie-cache) alongside the long-lived
 * session cookie. Forwarding all of them with one fixed Max-Age silently
 * extends the short ones -- and the cookie-cache is what ban / role-change
 * propagation depends on, so extending it neutralizes those guarantees.
 */
function parseCookieMaxAge(setCookie: string): number | undefined {
	const parts = setCookie.split(';').slice(1);
	let maxAge: number | undefined;
	let expiresAt: number | undefined;
	for (const part of parts) {
		const trimmed = part.trim();
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const attr = trimmed.substring(0, eq).trim().toLowerCase();
		const val = trimmed.substring(eq + 1).trim();
		if (attr === 'max-age') {
			const n = Number.parseInt(val, 10);
			if (Number.isFinite(n)) maxAge = n;
		} else if (attr === 'expires') {
			const t = Date.parse(val);
			if (Number.isFinite(t)) expiresAt = t;
		}
	}
	if (maxAge !== undefined) return maxAge;
	if (expiresAt !== undefined) {
		const seconds = Math.floor((expiresAt - Date.now()) / 1000);
		return seconds > 0 ? seconds : 0;
	}
	return undefined;
}

/**
 * Parse Set-Cookie headers from a better-auth response and forward them
 * to the browser via SvelteKit's cookies API.
 *
 * Handles URL decoding of cookie values (better-auth encodes / and + chars)
 * and applies secure cookie options based on environment and request host.
 *
 * Per-cookie lifetime is preserved from the better-auth Set-Cookie header
 * (Max-Age, falling back to Expires). The optional `fallbackMaxAgeSeconds`
 * parameter only applies to cookies where better-auth set NO TTL at all
 * (i.e. session cookies that should default to the configured session
 * lifetime). This prevents silently extending better-auth's short-lived
 * cookies -- in particular the 5-minute `bauth_session_data` cookie-cache,
 * which is the propagation channel for ban / role-change.
 */
export function forwardAuthCookies(
	authResponse: Response,
	cookies: Cookies,
	isDev: boolean,
	host: string | null | undefined,
	fallbackMaxAgeSeconds?: number,
): void {
	const fallback = fallbackMaxAgeSeconds ?? SESSION_MAX_AGE_SECONDS;
	const setCookieHeaders = authResponse.headers.getSetCookie?.() ?? [];
	for (const raw of setCookieHeaders) {
		const parts = raw.split(';');
		const [nameVal] = parts;
		const eqIndex = nameVal.indexOf('=');
		if (eqIndex === -1) continue;
		const name = nameVal.substring(0, eqIndex).trim();
		if (!name) continue;

		const value = decodeCookieValue(nameVal.substring(eqIndex + 1).trim());

		// Detect cookie-clear: better-auth signals deletion via Max-Age=0 or
		// an Expires date in the past. Use the parsed lifetime so format
		// changes (capitalization, exact past-date string) don't silently
		// turn a delete into a 7-day set.
		const parsedMaxAge = parseCookieMaxAge(raw);
		const isExpiring = parsedMaxAge === 0;

		if (isExpiring || value === '') {
			const domain = resolveCookieDomain(host, isDev);
			cookies.delete(name, { path: '/', ...(domain ? { domain } : {}) });
		} else {
			// Preserve the better-auth-set lifetime. Only fall back when
			// better-auth set no Max-Age and no Expires (rare; typically only
			// session cookies, where the fallback is the session lifetime).
			const opts = authCookieOptions(isDev, host, parsedMaxAge ?? fallback);
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
 *
 * Trust note: `host` is derived from `event.url.host` at the call site,
 * which is OK without a reverse proxy in front of the app. Once a proxy
 * lands, the caller should prefer the `Forwarded:` / `X-Forwarded-Host`
 * value (after CSRF validation) so the cookie Domain matches what the
 * browser actually sent the request to.
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
		.filter(
			(p) =>
				p.length > 0 &&
				!/^domain\s*=/i.test(p) &&
				// Strip any SameSite= better-auth emits so we can normalize to strict below.
				!/^samesite\s*=/i.test(p),
		);
	if (domain) parts.push(`Domain=${domain}`);
	// Match the SameSite policy used by authCookieOptions so first-party cookies
	// emitted by better-auth directly (not via forwardAuthCookies) stay consistent.
	parts.push('SameSite=Strict');
	return parts.join('; ');
}
