import { AUTH_INTERNAL_ORIGIN, BETTER_AUTH_ENDPOINTS, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { clearSessionCookies, forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:logout');

export const load: PageServerLoad = async () => {
	redirect(302, ROUTES.LOGIN);
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
				if (authResponse.status >= 500) {
					log.error('sign-out handler returned 5xx', {
						requestId: locals.requestId,
						status: authResponse.status,
					});
				} else if (authResponse.status >= 400) {
					log.warn('sign-out handler returned non-2xx', {
						requestId: locals.requestId,
						status: authResponse.status,
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
