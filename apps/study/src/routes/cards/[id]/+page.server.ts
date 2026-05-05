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
 *   - Citations are composed here from the bc-study citations API; the policy
 *     of "external links only on the public page" lives in
 *     `composePublicCardCitations`.
 *
 * Tags `study:public-card` so anonymous-traffic 5xx are distinguishable from
 * authenticated-flow failures when greppping logs (the rest of the (app)
 * tree threads `study:<area>` namespaces).
 */

import { composePublicCardCitations, getCitationsOf, getPublicCard, resolveCitationTargets } from '@ab/bc-study/server';
import { CITATION_SOURCE_TYPES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const log = createLogger('study:public-card');

export const load: PageServerLoad = async (event) => {
	const { params, locals } = event;
	try {
		const baseCard = await getPublicCard(params.id);
		if (!baseCard) error(404, { message: 'Card not found' });

		const citationRows = await getCitationsOf(CITATION_SOURCE_TYPES.CARD, baseCard.id);
		const enriched = await resolveCitationTargets(citationRows);
		const citations = composePublicCardCitations(enriched);

		return {
			card: { ...baseCard, citations },
		};
	} catch (err) {
		// 404 (`error(...)`) is a HttpError and should re-throw untouched so
		// the SvelteKit error boundary renders "Card not found." Real failures
		// (DB outage, citation resolver throwing) get a tagged log line so on-
		// call can find the failure under `study:public-card`.
		if (err && typeof err === 'object' && 'status' in err) throw err;
		log.error(
			'load public card failed',
			{ requestId: locals.requestId, metadata: { cardId: params.id } },
			err instanceof Error ? err : undefined,
		);
		throw err;
	}
};
