/**
 * `/ac/[doc]/[rev]` -- Advisory Circular landing.
 *
 * Resolves the AC reference by `(documentSlug, edition)`. The doc slug stored
 * in the catalog is `ac-<doc>` (e.g. `ac-61-65`); the edition is the AC's
 * full title with revision (e.g. `AC 61-65J`). The URL grammar carries the
 * doc number and the trailing revision letter only, so we reconstruct the
 * stored shapes from the URL params.
 *
 * Surfaces the chapter list when the AC has section-tree ingestion (most do),
 * otherwise renders the umbrella card.
 */

import { getReferenceByDocument, listHandbookChapters, listReferences } from '@ab/bc-study';
import { externalUrlForReference, REFERENCE_KINDS, type ReferenceKind, ROUTES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const DOC_SHAPE = /^[a-z0-9.-]+$/i;
const REV_SHAPE = /^[a-z]$/i;

export const load: PageServerLoad = async ({ params }) => {
	if (!DOC_SHAPE.test(params.doc)) throw error(404, 'Invalid AC doc number.');
	if (!REV_SHAPE.test(params.rev)) throw error(404, 'Invalid AC revision letter.');

	// `document_slug` is `ac-<doc>` and `edition` carries the revision letter.
	// Find the matching row by walking the catalog rather than a strict
	// (slug, edition) match -- the edition strings vary in formatting (some
	// are `AC 61-65J`, others `AC 91.21-1D`), but the trailing letter is
	// consistent.
	const documentSlug = `ac-${params.doc.toLowerCase()}`;
	const targetRev = params.rev.toUpperCase();

	const allRefs = await listReferences({}, undefined);
	const ref = allRefs.find(
		(r) => r.kind === REFERENCE_KINDS.AC && r.documentSlug === documentSlug && r.edition.endsWith(targetRev),
	);
	if (!ref) {
		// Fall back to an exact slug match so the user sees the umbrella even
		// if revision mapping disagrees.
		const fallback = await getReferenceByDocument(documentSlug).catch(() => null);
		if (!fallback) throw error(404, `AC ${params.doc}${targetRev} not found.`);
		return {
			uri: `airboss-ref:ac/${params.doc}/${params.rev}`,
			reference: {
				id: fallback.id,
				documentSlug: fallback.documentSlug,
				edition: fallback.edition,
				title: fallback.title,
				publisher: fallback.publisher,
				externalUrl: externalUrlForReference(
					fallback.kind as ReferenceKind,
					fallback.documentSlug,
					fallback.edition,
					fallback.url,
				),
			},
			chapters: [],
		};
	}

	const chapters = await listHandbookChapters(ref.id);

	return {
		uri: `airboss-ref:ac/${params.doc}/${params.rev}`,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			externalUrl: externalUrlForReference(ref.kind as ReferenceKind, ref.documentSlug, ref.edition, ref.url),
		},
		chapters: chapters.map((c) => ({
			id: c.id,
			code: c.code,
			title: c.title,
			ordinal: c.ordinal,
			href: ROUTES.FLIGHTBAG_AC_CHAPTER(params.doc, params.rev, c.code),
		})),
	};
};
