import { mapBetterAuthSession } from '@ab/auth';
import { ENV_VARS, ROUTES } from '@ab/constants';
import { recoverOrphanedRunning, startWorker, type WorkerHandle } from '@ab/hangar-jobs';
import { initRegistry } from '@ab/sources';
import {
	APPEARANCE_COOKIE,
	injectPreHydrationScript,
	parseAppearancePreference,
	readThemeFromCookies,
} from '@ab/themes';
import { PRE_HYDRATION_SCRIPT } from '@ab/themes/generated/pre-hydration';
import { createErrorHandler, createLogger } from '@ab/utils';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { rewriteSetCookieDomain } from '$lib/server/cookies';
import { hangarJobHandlers } from '$lib/server/jobs';

const log = createLogger('hangar');
const errorHandler = createErrorHandler({ logger: log });

/**
 * Hangar's in-process job worker. Boots once on server startup (not during
 * the SvelteKit `building` prerender pass), recovers any orphaned `running`
 * rows from a prior crash, then begins the poll loop. The handle is kept at
 * module scope so every request share one worker; `beforeExit` requests a
 * graceful drain so no job gets killed mid-run.
 */
let worker: WorkerHandle | null = null;

async function bootWorker(): Promise<void> {
	if (worker !== null) return;
	try {
		const recovered = await recoverOrphanedRunning();
		if (recovered > 0) {
			log.info('hangar worker recovered orphaned jobs', { metadata: { recovered } });
		}
		worker = startWorker({ handlers: hangarJobHandlers });
		log.info('hangar worker started');
	} catch (err) {
		log.error('hangar worker failed to start', undefined, err instanceof Error ? err : undefined);
	}
}

/**
 * Kick the worker boot once per module load. We intentionally do NOT await
 * this in the request path -- the worker loop runs on its own timer, and
 * `bootWorker` swallows its own errors so a transient DB hiccup during
 * startup doesn't take the app down.
 */
function workerEnabled(): boolean {
	const raw = (process.env[ENV_VARS.HANGAR_JOBS_WORKER] ?? '').toLowerCase();
	return raw !== 'off' && raw !== '0' && raw !== 'false';
}

if (!building) {
	if (workerEnabled()) {
		void bootWorker();
	} else {
		log.info('hangar worker disabled via HANGAR_JOBS_WORKER');
	}
	// Hydrate the @ab/sources registry from Postgres so the lifecycle overlay
	// + editions cache match the persisted audit trail. Non-blocking;
	// failures log but never crash bootstrap.
	void initRegistry().catch((err: unknown) =>
		log.error('initRegistry failed', undefined, err instanceof Error ? err : undefined),
	);
	process.on('beforeExit', () => {
		if (worker !== null) {
			void worker.stop();
		}
	});
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
 * emitted by SvelteKit's `kit.csp` (in `svelte.config.js`). The remaining
 * hardening headers are set here because they're static strings with no
 * framework dependency.
 */
function applySecurityHeaders(response: Response): void {
	try {
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		response.headers.set('X-Frame-Options', 'DENY');
		response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
		if (!dev) {
			response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
		}
	} catch (err) {
		// Some response types (streaming/binary) have frozen headers; skip
		// silently in prod. In dev surface the failure so a real CSP regression
		// (or a future header-set bug) doesn't hide behind the throw.
		if (dev) log.warn('security header set failed', { metadata: { err: String(err) } });
	}
}

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const requestId = event.locals.requestId ?? acceptOrGenerateRequestId(event.request);
	return errorHandler({ error, status, message, requestId, userId: event.locals.user?.id });
};

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const start = performance.now();
	const requestId = acceptOrGenerateRequestId(event.request);
	event.locals.requestId = requestId;
	event.locals.appearance = parseAppearancePreference(event.cookies.get(APPEARANCE_COOKIE));
	event.locals.theme = readThemeFromCookies(event.cookies);

	let response: Response;

	if (isAuthPath(event.url.pathname)) {
		try {
			const authResponse = await auth.handler(event.request);
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
