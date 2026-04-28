import type { Role } from '@ab/constants';
import {
	APPEARANCE_COOKIE,
	injectPreHydrationScript,
	parseAppearancePreference,
	readThemeFromCookies,
} from '@ab/themes';
import { PRE_HYDRATION_SCRIPT } from '@ab/themes/generated/pre-hydration';
import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const REQUEST_ID_HEADER = 'x-request-id';

function resolveRequestId(req: Request): string {
	const raw = req.headers.get(REQUEST_ID_HEADER);
	return raw && REQUEST_ID_PATTERN.test(raw) ? raw : crypto.randomUUID();
}

/**
 * Avionics hooks.
 *
 * Avionics does not host the login UI -- study owns that. Avionics
 * just *reads* the cross-subdomain `bauth_session_token` cookie and
 * populates `event.locals.user` so server endpoints can attribute
 * writes to the authenticated learner.
 *
 * Anonymous visits stay fully functional: every avionics page renders
 * either way; only the persistence call sites (when they land) gate on
 * `event.locals.user`.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const requestId = resolveRequestId(event.request);
	event.locals.requestId = requestId;
	event.locals.appearance = parseAppearancePreference(event.cookies.get(APPEARANCE_COOKIE));
	event.locals.theme = readThemeFromCookies(event.cookies);

	try {
		const session = await auth.api.getSession({ headers: event.request.headers });
		event.locals.session = session?.session
			? {
					id: session.session.id,
					userId: session.session.userId,
					expiresAt: session.session.expiresAt,
				}
			: null;
		event.locals.user = session?.user
			? {
					id: session.user.id,
					email: session.user.email,
					name: session.user.name,
					firstName: ((session.user as Record<string, unknown>).firstName as string) ?? '',
					lastName: ((session.user as Record<string, unknown>).lastName as string) ?? '',
					emailVerified: session.user.emailVerified,
					role: (session.user.role as Role) ?? null,
					image: session.user.image ?? null,
					banned: session.user.banned ?? null,
					createdAt: session.user.createdAt,
					updatedAt: session.user.updatedAt,
				}
			: null;
	} catch {
		// Degrade gracefully -- session lookup is best-effort. Anonymous
		// visits stay functional; only persistence endpoints gate on
		// `event.locals.user` and reject unauthenticated callers there.
		event.locals.session = null;
		event.locals.user = null;
	}

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => injectPreHydrationScript(html, PRE_HYDRATION_SCRIPT),
	});

	try {
		response.headers.set(REQUEST_ID_HEADER, requestId);
	} catch {
		// Some response types (streaming/binary) have frozen headers; skip silently.
	}

	return response;
};
