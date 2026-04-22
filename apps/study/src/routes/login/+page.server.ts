import { AUTH_INTERNAL_ORIGIN, BETTER_AUTH_ENDPOINTS, ROUTES } from '@ab/constants';
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
		redirect(302, ROUTES.HOME);
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
			return fail(400, { error: 'Email and password are required', email: email?.toString() ?? '' });
		}

		try {
			const authRequest = new Request(
				`${AUTH_INTERNAL_ORIGIN}${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
				},
			);
			const authResponse = await auth.handler(authRequest);

			if (!authResponse.ok) {
				const data = (await authResponse.json().catch(() => null)) as { message?: string } | null;
				return fail(401, {
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

		const rawRedirect = url.searchParams.get('redirectTo') ?? '';
		redirect(303, isSafeRedirect(rawRedirect) ? rawRedirect : ROUTES.HOME);
	},
};
