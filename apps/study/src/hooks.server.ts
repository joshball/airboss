import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Auth will be wired up here -- for now, no session
	event.locals.session = null;
	event.locals.user = null;

	return resolve(event);
};
