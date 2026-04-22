import { ROUTES, type Role } from '@ab/constants';
import { createErrorHandler, createLogger } from '@ab/utils';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { rewriteSetCookieDomain } from '$lib/server/cookies';

const log = createLogger('study');
const errorHandler = createErrorHandler({ logger: log });

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const REQUEST_ID_HEADER = 'x-request-id';

function resolveRequestId(req: Request): string {
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
	} catch {
		// Some response types (streaming/binary) have frozen headers; skip silently.
	}
}

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const requestId = event.locals.requestId ?? resolveRequestId(event.request);
	return errorHandler({ error, status, message, requestId, userId: event.locals.user?.id });
};

export const handle: Handle = async ({ event, resolve }) => {
	// No-op during SvelteKit build/prerender analysis -- auth is not initialized then.
	if (building) return resolve(event);

	const start = performance.now();
	const requestId = resolveRequestId(event.request);
	event.locals.requestId = requestId;

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
			log.warn('banned user blocked', {
				requestId,
				userId: event.locals.user.id,
				metadata: { path: event.url.pathname },
			});
			response = new Response('Account suspended', { status: 403 });
		} else {
			response = await resolve(event);
		}
	}

	try {
		response.headers.set(REQUEST_ID_HEADER, requestId);
	} catch {
		// Response headers may be frozen on certain response types; ignore.
	}

	applySecurityHeaders(response);

	const ms = Math.round(performance.now() - start);
	log.info(`${event.request.method} ${event.url.pathname} ${response.status}`, {
		requestId,
		userId: event.locals.user?.id ?? null,
		metadata: { ms },
	});

	return response;
};
