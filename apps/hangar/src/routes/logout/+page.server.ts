import { AUTH_INTERNAL_ORIGIN, BETTER_AUTH_ENDPOINTS, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { clearSessionCookies, forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:logout');

export const load: PageServerLoad = async () => {
	// 303 keeps the redirect-status story uniform across the auth surface
	// (study/login, study/logout, hangar/login all 303 too).
	redirect(303, ROUTES.LOGIN);
};

export const actions: Actions = {
	default: async ({ request, cookies, locals, url }) => {
		try {
			try {
				const authRequest = new Request(`${AUTH_INTERNAL_ORIGIN}${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_OUT}`, {
					method: 'POST',
					headers: { cookie: request.headers.get('cookie') ?? '' },
				});
				const authResponse = await auth.handler(authRequest);
				// 5xx body snippet: log a 256-char prefix of the response body so
				// on-call can see better-auth's error message without round-tripping
				// to the request log. Bounded to keep log lines small.
				if (authResponse.status >= 500) {
					const bodyText = await authResponse
						.clone()
						.text()
						.catch(() => '<unreadable>');
					log.error('sign-out handler returned 5xx', {
						requestId: locals.requestId,
						metadata: { status: authResponse.status, bodySnippet: bodyText.slice(0, 256) },
					});
				} else if (authResponse.status >= 400) {
					log.warn('sign-out handler returned non-2xx', {
						requestId: locals.requestId,
						metadata: { status: authResponse.status },
					});
				}
				forwardAuthCookies(authResponse, cookies, url.host);
			} catch (err) {
				log.error('sign-out handler failed', { requestId: locals.requestId }, err instanceof Error ? err : undefined);
			}
		} finally {
			// Defence-in-depth: clear session cookies unconditionally.
			clearSessionCookies(cookies, url.host);
		}

		redirect(303, ROUTES.LOGIN);
	},
};
