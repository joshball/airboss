/**
 * `/library/aircraft/[slug]` -- legacy POH/AFM detail.
 *
 * The flightbag has no per-aircraft reader yet -- POH/AFMs are
 * manufacturer-published, kept in the developer-local cache (per ADR 018),
 * and never had a deep-link surface beyond the umbrella card. Until that
 * surface lands, the legacy URL returns 410 Gone with a pointer to the
 * flightbag catalog so the user knows the surface relocated.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	throw error(
		410,
		'POH / AFM reader has not been ported into the flightbag yet. Open the flightbag catalog and pick the aircraft from the references list.',
	);
};
