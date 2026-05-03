import {
	APPEARANCE_COOKIE,
	injectPreHydrationScript,
	parseAppearancePreference,
	readThemeFromCookies,
} from '@ab/themes';
import { PRE_HYDRATION_SCRIPT } from '@ab/themes/generated/pre-hydration';
import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';

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
 * Flightbag is a public reader -- no auth gate. The hooks pipeline is the
 * minimum needed to land theme cookies + a request id for log correlation.
 * If a future WP introduces visibility rules, the auth lookup pattern from
 * `apps/avionics/src/hooks.server.ts` is the precedent to copy.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	event.locals.requestId = acceptOrGenerateRequestId(event.request);
	event.locals.appearance = parseAppearancePreference(event.cookies.get(APPEARANCE_COOKIE));
	event.locals.theme = readThemeFromCookies(event.cookies);

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => injectPreHydrationScript(html, PRE_HYDRATION_SCRIPT),
	});

	try {
		response.headers.set(REQUEST_ID_HEADER, event.locals.requestId);
	} catch {
		// Some response types (streaming/binary) have frozen headers; skip silently.
	}

	return response;
};
