import {
	clearSessionCookies as clearCookies,
	forwardAuthCookies as forwardCookies,
	rewriteSetCookieDomain as rewriteDomain,
} from '@ab/auth';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

export function forwardAuthCookies(authResponse: Response, cookies: Cookies, host: string | null | undefined): void {
	forwardCookies(authResponse, cookies, dev, host);
}

export function clearSessionCookies(cookies: Cookies, host: string | null | undefined): void {
	clearCookies(cookies, dev, host);
}

export function rewriteSetCookieDomain(response: Response, host: string | null | undefined): Response {
	return rewriteDomain(response, host, dev);
}
