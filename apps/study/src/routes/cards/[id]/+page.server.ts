/**
 * Public card surface `/cards/<id>` -- card-page-and-cross-references v1.
 *
 * Lives outside the `(app)` group on purpose: `(app)/+layout.server.ts`
 * gates every child route with `requireAuth`, but this surface is public.
 * Keeping the route outside the group is the explicit unauthenticated
 * opt-out we need -- no server `requireAuth` call here, no identity probe.
 *
 * Per spec:
 *   - Active cards only (suspended + archived -> 404).
 *   - No scheduling internals leak.
 *   - Citations render when `content-citations` (Bundle C) lands; empty now.
 */

import { getPublicCard } from '@ab/bc-study';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	const card = await getPublicCard(params.id);
	if (!card) error(404, { message: 'Card not found' });

	return {
		card,
	};
};
