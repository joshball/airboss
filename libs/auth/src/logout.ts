/**
 * Clear all better-auth session cookies.
 *
 * better-auth's sign-out endpoint doesn't always return Set-Cookie headers
 * to clear the session. This function explicitly deletes the known cookie
 * names so logout works reliably.
 *
 * The Domain used for deletion must match the Domain the cookie was set
 * with, otherwise the browser keeps the old cookie. We derive the Domain
 * from the request host via `resolveCookieDomain`, mirroring the set path.
 */

import { BETTER_AUTH_COOKIES } from '@ab/constants';
import type { Cookies } from '@sveltejs/kit';
import { resolveCookieDomain } from './cookies';

const SESSION_COOKIE_NAMES = [BETTER_AUTH_COOKIES.SESSION_TOKEN, BETTER_AUTH_COOKIES.SESSION_DATA];

/**
 * Clear the known better-auth session cookies.
 *
 * Trust note: `host` is derived from `event.url.host` at the call site,
 * which is OK without a reverse proxy in front of the app. Once a proxy
 * lands, callers should prefer the `Forwarded:` / `X-Forwarded-Host`
 * value (after CSRF validation) so the Domain matches the cookie the
 * browser actually stored.
 */
export function clearSessionCookies(cookies: Cookies, isDev: boolean, host: string | null | undefined): void {
	const domain = resolveCookieDomain(host, isDev);
	for (const name of SESSION_COOKIE_NAMES) {
		cookies.delete(name, { path: '/', ...(domain ? { domain } : {}) });
	}
}
