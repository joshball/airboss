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
 *   - Citations are composed here from `@ab/bc-citations`; the policy of
 *     "external links only on the public page" lives in `composePublicCardCitations`.
 */

import { getCitationsOf, resolveCitationTargets } from '@ab/bc-citations';
import { composePublicCardCitations, getPublicCard } from '@ab/bc-study';
import { CITATION_SOURCE_TYPES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	const baseCard = await getPublicCard(params.id);
	if (!baseCard) error(404, { message: 'Card not found' });

	const citationRows = await getCitationsOf(CITATION_SOURCE_TYPES.CARD, baseCard.id);
	const enriched = await resolveCitationTargets(citationRows);
	const citations = composePublicCardCitations(enriched);

	return {
		card: { ...baseCard, citations },
	};
};
