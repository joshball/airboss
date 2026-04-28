import { AUTH_INTERNAL_ORIGIN, BETTER_AUTH_ENDPOINTS, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:login');

/** True when the path is a safe local redirect target (no open-redirect bypasses). */
function isSafeRedirect(path: string): boolean {
	if (!path.startsWith('/')) return false;
	if (path.startsWith('//')) return false;
	// Block backslashes (some browsers normalize /\evil.com -> //evil.com)
	if (path.includes('\\')) return false;
	// Block CR/LF header injection
	if (path.includes('\r') || path.includes('\n')) return false;
	return true;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session) {
		// 303 keeps the redirect-status story uniform with the action-side
		// `redirect(303, ...)` below; both are POST/GET-after-mutation in
		// shape (we just authenticated the session) and 303 is the right
		// "here is the resource for that submission" code.
		redirect(303, ROUTES.HOME);
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, locals, getClientAddress }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
			return fail(400, { error: 'Email and password are required', email: email?.toString() ?? '' });
		}

		try {
			// Forward to better-auth's HTTP handler. Better-auth's rate
			// limiter is wired into the router's `onRequest` hook, which
			// only runs for requests dispatched through `auth.handler` -- a
			// direct `auth.api.*` call bypasses it.
			//
			// We propagate the live client IP via `x-forwarded-for` so the
			// rate limiter buckets per-user instead of per-process. The
			// previous synthetic Request omitted forwarded-IP headers
			// entirely, so `getIp()` fell back to `127.0.0.1` for every
			// caller and one attacker could lock out the whole user base
			// from a single rate-limit bucket. Origin / Cookie /
			// Sec-Fetch-* are intentionally NOT forwarded -- the user
			// already cleared SvelteKit's CSRF gate to reach this action,
			// and re-running better-auth's origin check on an internal
			// forward would just trip on values it has no reason to see.
			const headers = new Headers({
				'content-type': 'application/json',
				'x-forwarded-for': getClientAddress(),
			});
			const authRequest = new Request(
				`${AUTH_INTERNAL_ORIGIN}${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`,
				{
					method: 'POST',
					headers,
					body: JSON.stringify({ email, password }),
				},
			);
			const authResponse = await auth.handler(authRequest);

			if (!authResponse.ok) {
				const data = (await authResponse.json().catch(() => null)) as { message?: string } | null;
				if (authResponse.status === 429) {
					return fail(429, {
						error: 'Too many sign-in attempts. Please wait a moment and try again.',
						email,
					});
				}
				return fail(authResponse.status === 401 ? 401 : 400, {
					error: data?.message ?? 'Invalid email or password',
					email,
				});
			}

			forwardAuthCookies(authResponse, cookies, url.host);
		} catch (err) {
			// Never leak internal error text to the client -- log server-side instead.
			// Redact the raw email: logs are a potential identity-enumeration signal
			// if an attacker can trigger 5xx paths. requestId is enough to correlate.
			log.error('login handler threw', { requestId: locals.requestId }, err instanceof Error ? err : undefined);
			return fail(500, { error: 'Sign-in failed, please try again', email });
		}

		const rawRedirect = url.searchParams.get(QUERY_PARAMS.REDIRECT_TO) ?? '';
		redirect(303, isSafeRedirect(rawRedirect) ? rawRedirect : ROUTES.HOME);
	},
};
