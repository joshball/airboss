import { AUTH_INTERNAL_ORIGIN, BETTER_AUTH_ENDPOINTS, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:login');

/** True when the path is a safe local redirect target (no open-redirect bypasses). */
function isSafeRedirect(path: string): boolean {
	if (!path.startsWith('/')) return false;
	if (path.startsWith('//')) return false;
	if (path.includes('\\')) return false;
	if (path.includes('\r') || path.includes('\n')) return false;
	return true;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session) {
		// 303 keeps redirect codes uniform with the action below.
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
			// Forward to better-auth's HTTP handler. We propagate the live
			// client IP via `x-forwarded-for` so the rate limiter buckets
			// per-user instead of per-process. See the matching
			// study/login action for the full rationale (rate-limit lives
			// in the router's onRequest hook, so direct `auth.api.*` calls
			// bypass it; and the previous synthetic Request omitted IP
			// headers entirely, so every user shared one bucket).
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
			// Never leak internal error text to the client. Redact the raw email
			// from logs: it's an identity-enumeration signal.
			log.error('login handler threw', { requestId: locals.requestId }, err instanceof Error ? err : undefined);
			return fail(500, { error: 'Sign-in failed, please try again', email });
		}

		const rawRedirect = url.searchParams.get(QUERY_PARAMS.REDIRECT_TO) ?? '';
		redirect(303, isSafeRedirect(rawRedirect) ? rawRedirect : ROUTES.HOME);
	},
};
