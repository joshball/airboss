/**
 * `/library/aircraft/[slug]` -- POH/AFM umbrella surface.
 *
 * POH/AFM data lives outside the public-document model -- the FAA doesn't
 * publish it, manufacturers do, and the bytes belong on the operator's
 * device, not in the platform. This page therefore renders the umbrella card
 * (title, edition, manufacturer publisher, external URL when available)
 * without an in-app reader.
 */

import { requireAuth } from '@ab/auth';
import { parseAircraftSlug } from '@ab/aviation';
import { listReferences } from '@ab/bc-study/server';
import { externalUrlForReference, REFERENCE_KINDS, type ReferenceKind } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const slug = parseAircraftSlug(event.params.slug);
	if (!slug) throw error(404, 'Aircraft not found.');

	const refs = await listReferences();
	const ref = refs.find((r) => r.kind === REFERENCE_KINDS.POH && r.documentSlug === slug);
	if (!ref) throw error(404, 'Aircraft not found.');

	const refKind = ref.kind as ReferenceKind;
	return {
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			kind: refKind,
			subjects: ref.subjects as readonly string[],
			externalUrl: externalUrlForReference(refKind, ref.documentSlug, ref.edition, ref.url),
		},
	};
};
