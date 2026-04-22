import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * ADR 012 phase 3: `/reps/session` is retired. The preset gallery at
 * `/session/start` is the single entry point for starting a session -- the
 * gallery renders when no active plan exists, otherwise the normal session
 * preview + start controls do. All first-party callers now link
 * `ROUTES.SESSION_START` directly; this 308 catches typed URLs, bookmarks,
 * and any stale external links.
 *
 * Phase 6 deletes this route file outright. Until then the 308 lives on so
 * external links keep working through the transition.
 */
export const load: PageServerLoad = () => {
	throw redirect(308, ROUTES.SESSION_START);
};
