/**
 * Shared layout loader for `/acs/[doc]/*` (WP-FLIGHTBAG-READER-UX Phase 4).
 *
 * Hoists the ACS reference + sourceLinks so the landing and per-task
 * pages share the page-header chrome. ACS rail stays per-page for now
 * (the area/task hierarchy uses `acs-toc` which differs from the
 * reading-order shape the other doc-types share).
 */

import { getReferenceByDocument } from '@ab/bc-study/server';
import { externalUrlForReference, type ReferenceKind } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../lib/source-links';
import type { LayoutServerLoad } from './$types';

const SLUG_SHAPE = /^[a-z0-9-]+$/i;

export const load: LayoutServerLoad = async (event) => {
	const { params } = event;
	if (!SLUG_SHAPE.test(params.doc)) throw error(404, 'Invalid ACS doc slug.');

	const ref = await getReferenceByDocument(params.doc).catch(() => null);
	if (!ref) throw error(404, `ACS ${params.doc} not seeded.`);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		acs: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			externalUrl: externalUrlForReference(ref.kind as ReferenceKind, ref.documentSlug, ref.edition, ref.url),
		},
		sourceLinks,
		isAuthenticated: event.locals.user !== null,
	};
};
