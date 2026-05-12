import { mapBetterAuthSession } from '@ab/auth';
import { ROUTES } from '@ab/constants';
import { initRegistry } from '@ab/sources/server';
import {
	APPEARANCE_COOKIE,
	injectPreHydrationScript,
	parseAppearancePreference,
	readThemeFromCookies,
} from '@ab/themes';
import { PRE_HYDRATION_SCRIPT } from '@ab/themes/generated/pre-hydration';
import { createErrorHandler, createLogger } from '@ab/utils';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building, dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { rewriteSetCookieDomain } from '$lib/server/cookies';
import { maybeRunDiscovery } from '$lib/server/discovery';
import { resolveLegacyRedirect } from '$lib/server/legacy-redirects';

const log = createLogger('study');
const errorHandler = createErrorHandler({ logger: log });

// Fire-and-forget errata discovery scan at startup. Non-blocking; freshness-
// gated so the common case is a single sentinel read. See WP
// `apply-errata-and-afh-mosaic` phase R7.
if (!building) {
	void maybeRunDiscovery();
	// Hydrate the @ab/sources registry from Postgres so the lifecycle overlay
	// + editions cache reflect the persisted audit trail before the first
	// request lands. Errors are logged but never block bootstrap; the empty
	// state is identical to a fresh DB and only blocks reviewer ops.
	void initRegistry().catch((err: unknown) =>
		log.error('initRegistry failed', undefined, err instanceof Error ? err : undefined),
	);
}

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

function isAuthPath(pathname: string): boolean {
	return pathname === ROUTES.API_AUTH || pathname.startsWith(`${ROUTES.API_AUTH}/`);
}

/**
 * Defense-in-depth security headers. CSP + form-action + frame-ancestors are
 * emitted by SvelteKit's `kit.csp` (in `svelte.config.js`) so nonces can be
 * injected into auto-generated inline scripts. The remaining hardening headers
 * are set here because they're static strings with no framework dependency.
 */
function applySecurityHeaders(response: Response): void {
	try {
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		response.headers.set('X-Frame-Options', 'DENY');
		response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
		if (!dev) {
			// HSTS only in prod; dev uses http on 127.0.0.1/localhost.
			response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
		}
	} catch (err) {
		// Streaming / binary responses throw `TypeError: Headers immutable` --
		// expected, swallow silently. Anything else is a real bug (a future
		// `Permissions-Policy` syntax error, a regressed header value) that
		// would otherwise turn off CSRF / clickjacking defenses with zero
		// signal; surface it so on-call sees the regression. In dev keep the
		// noisier `warn` so the failure shows up immediately during iteration.
		if (err instanceof TypeError) return;
		if (dev) {
			log.warn('set security headers failed', { metadata: { err: String(err) } });
		} else {
			log.error(
				'set security headers failed',
				{ metadata: { err: String(err) } },
				err instanceof Error ? err : undefined,
			);
		}
	}
}

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const requestId = event.locals.requestId ?? acceptOrGenerateRequestId(event.request);
	return errorHandler({ error, status, message, requestId, userId: event.locals.user?.id });
};

/**
 * Legacy IA-cleanup redirects. Runs FIRST so an unauthenticated user
 * landing on `/dashboard` redirects cleanly to `/insights` rather than
 * bouncing through the auth gate first. The auth handle below sees only
 * canonical paths after this layer.
 *
 * 301 (permanent) is correct here -- the rename is intentional and
 * search engines / bookmark managers should pin the new URL. Tests
 * assert the status code, not just the `Location` header.
 */
export const handleLegacyRedirects: Handle = ({ event, resolve }) => {
	if (building) return resolve(event);
	const target = resolveLegacyRedirect(event.url.pathname, event.url.search);
	if (target !== null) {
		return new Response(null, { status: 301, headers: { location: target } });
	}
	return resolve(event);
};

const handleAppRequest: Handle = async ({ event, resolve }) => {
	// No-op during SvelteKit build/prerender analysis -- auth is not initialized then.
	if (building) return resolve(event);

	const start = performance.now();
	const requestId = acceptOrGenerateRequestId(event.request);
	event.locals.requestId = requestId;
	event.locals.appearance = parseAppearancePreference(event.cookies.get(APPEARANCE_COOKIE));
	event.locals.theme = readThemeFromCookies(event.cookies);

	let response: Response;

	if (isAuthPath(event.url.pathname)) {
		// Auth endpoints bypass session hydration and the banned-user guard:
		// better-auth already rejects banned users at session-creation time and
		// sign-out must remain callable for stale/banned cookie states.
		try {
			const authResponse = await auth.handler(event.request);
			// better-auth bakes the configured cross-subdomain Domain into every
			// Set-Cookie. Rewrite per-request so cookies land on 127.0.0.1/localhost
			// (host-only) as well as *.airboss.test (cross-subdomain).
			response = rewriteSetCookieDomain(authResponse, event.url.host);
		} catch (err) {
			log.error(
				'auth handler failed',
				{ requestId, metadata: { path: event.url.pathname } },
				err instanceof Error ? err : undefined,
			);
			throw err;
		}
	} else {
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
			// Degrade gracefully: anonymous requests (e.g. /login) should still load
			// when the DB is flapping. requireAuth guards protect authenticated routes.
			log.error(
				'session lookup failed',
				{ requestId, metadata: { path: event.url.pathname } },
				err instanceof Error ? err : undefined,
			);
			event.locals.session = null;
			event.locals.user = null;
		}

		if (event.locals.user?.banned) {
			// `info`, not `warn`: a banned account hammering the app would
			// otherwise produce hundreds of warns/minute and bury legitimate
			// warnings. The 403 is expected behaviour, not an anomaly. If the
			// rate matters operationally, wire a counter at a higher layer.
			log.info('banned user blocked', {
				requestId,
				userId: event.locals.user.id,
				metadata: { path: event.url.pathname },
			});
			response = new Response('Account suspended', { status: 403 });
		} else {
			response = await resolve(event, {
				transformPageChunk: ({ html }) => injectPreHydrationScript(html, PRE_HYDRATION_SCRIPT),
			});
		}
	}

	try {
		response.headers.set(REQUEST_ID_HEADER, requestId);
	} catch {
		// Response headers may be frozen on certain response types; ignore.
	}

	applySecurityHeaders(response);

	const ms = Math.round(performance.now() - start);
	// `authenticated` positively records the anonymous case so a "broken auth
	// path" (call site forgot to thread userId) is distinguishable from
	// "request was deliberately anonymous" in JSON logs.
	log.info(`${event.request.method} ${event.url.pathname} ${response.status}`, {
		requestId,
		userId: event.locals.user?.id ?? null,
		metadata: { ms, authenticated: event.locals.user != null },
	});

	return response;
};

/**
 * Composed handle: legacy redirects run first (so renamed paths never
 * hit auth/session lookup) and the main app handle runs second.
 */
export const handle: Handle = sequence(handleLegacyRedirects, handleAppRequest);
