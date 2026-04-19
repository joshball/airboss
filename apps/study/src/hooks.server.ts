import { ROUTES, type Role } from '@ab/constants';
import { createErrorHandler, createLogger } from '@ab/utils';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

const log = createLogger('study');
const errorHandler = createErrorHandler({ logger: log });

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const requestId = event.request.headers.get('x-request-id') ?? crypto.randomUUID();
	return errorHandler({ error, status, message, requestId, userId: event.locals.user?.id });
};

export const handle: Handle = async ({ event, resolve }) => {
	const start = performance.now();

	if (event.url.pathname.startsWith(ROUTES.API_AUTH)) {
		const response = auth.handler(event.request);
		return response;
	}

	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

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

	// Block banned users from accessing anything except auth routes
	if (event.locals.user?.banned) {
		log.warn('banned user blocked', { userId: event.locals.user.id, path: event.url.pathname });
		return new Response('Account suspended', { status: 403 });
	}

	const response = await resolve(event);
	const ms = Math.round(performance.now() - start);

	log.info(`${event.request.method} ${event.url.pathname} ${response.status}`, {
		ms,
		userId: event.locals.user?.id ?? null,
	});

	return response;
};
