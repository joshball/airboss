import { AUTH_INTERNAL_ORIGIN, BETTER_AUTH_ENDPOINTS, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { clearSessionCookies, forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:logout');

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
				forwardAuthCookies(authResponse, cookies, url.host);
			} catch (err) {
				log.error('sign-out handler failed', { requestId: locals.requestId }, err instanceof Error ? err : undefined);
			}
		} finally {
			// Clear session cookies unconditionally. Forwarding from better-auth
			// above is best-effort (it may 5xx, the response may omit Set-Cookie,
			// or the caller may be in a banned/expired state). Running the
			// cookie-clear in finally guarantees the server-side response always
			// ends in a signed-out state. Idempotent -- safe alongside forward.
			clearSessionCookies(cookies, url.host);
		}

		redirect(303, ROUTES.LOGIN);
	},
};
