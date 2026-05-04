import { isSafeRedirect } from '@ab/auth';
import { AUTH_INTERNAL_ORIGIN, BETTER_AUTH_ENDPOINTS, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:login');

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
				// Read the body text first so we can use it for both the parsed
				// JSON path and the raw-snippet path on 5xx. Body can only be
				// consumed once.
				const bodyText = await authResponse.text().catch(() => '');
				let parsed: { message?: string } | null = null;
				try {
					parsed = bodyText ? (JSON.parse(bodyText) as { message?: string }) : null;
				} catch {
					parsed = null;
				}
				// Server-side log so on-call can distinguish "wrong password" from
				// "banned" / "verification required" / "validation error" without
				// leaking the difference to the client. 5xx is upgraded to error
				// because it points at a server fault (better-auth threw, DB
				// flapped); 4xx stays at warn so on-call doesn't drown in
				// invalid-credential noise. On 5xx we capture a body snippet so
				// the responder has context about which row / endpoint failed.
				if (authResponse.status >= 500) {
					log.error('sign in failed', {
						requestId: locals.requestId,
						metadata: {
							status: authResponse.status,
							betterAuthMessage: parsed?.message ?? null,
							bodySnippet: bodyText.slice(0, 200),
						},
					});
					return fail(500, {
						error: 'Sign-in service is having trouble. Try again in a moment.',
						email,
					});
				}
				log.warn('login non-ok response', {
					requestId: locals.requestId,
					metadata: { status: authResponse.status, betterAuthMessage: parsed?.message ?? null },
				});
				if (authResponse.status === 429) {
					return fail(429, {
						error: 'Too many sign-in attempts. Please wait a moment and try again.',
						email,
					});
				}
				if (authResponse.status === 401) {
					// Blank the echoed email on a credential-stuffing 401 so the form
					// doesn't double as a low-cost enumeration assistant. The 400
					// (validation) path still echoes so a typo doesn't force a
					// re-type of the email. Force a uniform user-facing message on
					// 400/401 because better-auth's distinct "user not found" vs
					// "invalid password" strings are a user-enumeration vector.
					return fail(401, { error: 'Invalid email or password', email: '' });
				}
				return fail(400, { error: 'Invalid email or password', email });
			}

			forwardAuthCookies(authResponse, cookies, url.host);
		} catch (err) {
			// Never leak internal error text to the client -- log server-side instead.
			// Redact the raw email: logs are a potential identity-enumeration signal
			// if an attacker can trigger 5xx paths. requestId is enough to correlate.
			log.error('sign in failed', { requestId: locals.requestId }, err instanceof Error ? err : undefined);
			return fail(500, { error: 'Sign-in service is having trouble. Try again in a moment.', email });
		}

		const rawRedirect = url.searchParams.get(QUERY_PARAMS.REDIRECT_TO) ?? '';
		redirect(303, isSafeRedirect(rawRedirect) ? rawRedirect : ROUTES.HOME);
	},
};
