/**
 * Clear all better-auth session cookies.
 *
 * better-auth's sign-out endpoint doesn't always return Set-Cookie headers
 * to clear the session. This function explicitly deletes the known cookie names
 * on the cross-subdomain cookie domain so logout works reliably.
 */

import { BETTER_AUTH_COOKIES, COOKIE_DOMAIN_DEV, COOKIE_DOMAIN_PROD } from '@ab/constants';
import type { Cookies } from '@sveltejs/kit';

const SESSION_COOKIE_NAMES = [BETTER_AUTH_COOKIES.SESSION_TOKEN, BETTER_AUTH_COOKIES.SESSION_DATA];

export function clearSessionCookies(cookies: Cookies, isDev: boolean): void {
	const domain = isDev ? COOKIE_DOMAIN_DEV : COOKIE_DOMAIN_PROD;
	for (const name of SESSION_COOKIE_NAMES) {
		cookies.delete(name, { path: '/', domain });
	}
}
