import { AUTH_INTERNAL_ORIGIN, ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { clearSessionCookies, forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	redirect(302, ROUTES.LOGIN);
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const authRequest = new Request(`${AUTH_INTERNAL_ORIGIN}${ROUTES.API_AUTH}/sign-out`, {
			method: 'POST',
			headers: { cookie: request.headers.get('cookie') ?? '' },
		});
		const authResponse = await auth.handler(authRequest);
		forwardAuthCookies(authResponse, cookies);
		clearSessionCookies(cookies);

		redirect(303, ROUTES.LOGIN);
	},
};
