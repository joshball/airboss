import { clearSessionCookies as clearCookies, forwardAuthCookies as forwardCookies } from '@ab/auth';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

export function forwardAuthCookies(authResponse: Response, cookies: Cookies): void {
	forwardCookies(authResponse, cookies, dev);
}

export function clearSessionCookies(cookies: Cookies): void {
	clearCookies(cookies, dev);
}
