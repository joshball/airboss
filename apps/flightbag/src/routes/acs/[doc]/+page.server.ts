/**
 * `/acs/[doc]` -- ACS publication landing.
 *
 * Surfaces the umbrella card for the ACS publication. Per-task content
 * isn't ingested into `reference_section` yet -- when ACS ingest lands the
 * task list will appear here. Today, the page always shows the FAA testing
 * portal as the authoritative source.
 */

import { getReferenceByDocument, listAllSectionsForReference } from '@ab/bc-study/server';
import { externalUrlForReference, REFERENCE_KINDS, type ReferenceKind } from '@ab/constants';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../lib/source-links';
import type { PageServerLoad } from './$types';

const SLUG_SHAPE = /^[a-z0-9-]+$/i;

export const load: PageServerLoad = async ({ params }) => {
	if (!SLUG_SHAPE.test(params.doc)) throw error(404, 'Invalid ACS slug.');

	const ref = await getReferenceByDocument(params.doc).catch(() => null);
	if (!ref) throw error(404, `ACS ${params.doc} not found.`);
	if (ref.kind !== REFERENCE_KINDS.ACS && ref.kind !== REFERENCE_KINDS.PTS) {
		throw error(404, `${params.doc} is not an ACS publication.`);
	}

	const sections = await listAllSectionsForReference(ref.id);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		uri: `airboss-ref:acs/${ref.documentSlug}`,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			subjects: [...ref.subjects],
			externalUrl: externalUrlForReference(ref.kind as ReferenceKind, ref.documentSlug, ref.edition, ref.url),
		},
		sections: sections.map((s) => ({
			id: s.id,
			code: s.code,
			level: s.level,
			title: s.title,
		})),
	};
};
