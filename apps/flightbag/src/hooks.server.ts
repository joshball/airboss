import { mapBetterAuthSession } from '@ab/auth';
import {
	APPEARANCE_COOKIE,
	injectPreHydrationScript,
	parseAppearancePreference,
	readThemeFromCookies,
} from '@ab/themes';
import { PRE_HYDRATION_SCRIPT } from '@ab/themes/generated/pre-hydration';
import { createLogger } from '@ab/utils';
import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';

const log = createLogger('flightbag');

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Inbound request-id is correlation-only, never trust-bearing. We accept any
 * 64-char alphanumeric+`_-` value the caller supplies for log threading and
 * mint a random UUID when nothing valid arrived. The value is echoed back as
 * the response header so a client can correlate failures.
 */
function acceptOrGenerateRequestId(req: Request): string {
	const raw = req.headers.get(REQUEST_ID_HEADER);
	return raw && REQUEST_ID_PATTERN.test(raw) ? raw : crypto.randomUUID();
}

/**
 * Flightbag hooks.
 *
 * Flightbag does not host the login UI -- study owns that. Flightbag just
 * *reads* the cross-subdomain `bauth_session_token` cookie and populates
 * `event.locals.user` so server endpoints can attribute writes (read-state
 * heartbeats, future highlights/notes) to the authenticated learner.
 *
 * Anonymous visits stay fully functional: every flightbag page renders for
 * unauthenticated readers; only the per-user persistence call sites (the
 * heartbeat endpoint, future notes/highlights actions) gate on
 * `event.locals.user`. This matches `apps/avionics/src/hooks.server.ts`.
 *
 * TODO(ADR-024): When the entitlement primitive lands, replace the per-route
 * `requireAuth` calls with `requireEntitlement(event, 'flightbag:read')` so
 * the public-deploy flip in REFERENCES_ROADMAP.md Wave 8 is a single config
 * switch. Until then `requireAuth` is the gate.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const requestId = acceptOrGenerateRequestId(event.request);
	event.locals.requestId = requestId;
	event.locals.appearance = parseAppearancePreference(event.cookies.get(APPEARANCE_COOKIE));
	event.locals.theme = readThemeFromCookies(event.cookies);

	try {
		const session = await auth.api.getSession({ headers: event.request.headers });
		event.locals.session = session?.session
			? {
					id: session.session.id,
					userId: session.session.userId,
				}
			: null;
		event.locals.user = mapBetterAuthSession(session);
	} catch (err) {
		// Degrade gracefully -- session lookup is best-effort. Anonymous
		// visits stay functional; only persistence endpoints gate on
		// `event.locals.user` and reject unauthenticated callers there.
		// Log so on-call has signal when "I'm signed in on study but flightbag
		// says I'm not" gets reported.
		log.error(
			'session lookup failed',
			{ requestId, metadata: { path: event.url.pathname } },
			err instanceof Error ? err : undefined,
		);
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
