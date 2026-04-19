import { AUTH_INTERNAL_ORIGIN, ROUTES } from '@ab/constants';
import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session) {
		redirect(302, ROUTES.HOME);
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
			return fail(400, { error: 'Email and password are required', email: email?.toString() ?? '' });
		}

		try {
			const authRequest = new Request(`${AUTH_INTERNAL_ORIGIN}${ROUTES.API_AUTH}/sign-in/email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			});
			const authResponse = await auth.handler(authRequest);

			if (!authResponse.ok) {
				const data = await authResponse.json().catch(() => null);
				return fail(401, {
					error: data?.message ?? 'Invalid email or password',
					email,
				});
			}

			forwardAuthCookies(authResponse, cookies);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Invalid email or password';
			return fail(401, { error: message, email });
		}

		const rawRedirect = url.searchParams.get('redirectTo') ?? '';
		const safe = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//');
		redirect(303, safe ? rawRedirect : ROUTES.HOME);
	},
};
