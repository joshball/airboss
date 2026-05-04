/**
 * `/acs/[doc]/area/[area]/task/[task]` -- ACS task reader.
 *
 * Validates the URI parses end-to-end. ACS task content isn't ingested into
 * `reference_section` yet, so today this page renders a soft-404 with a link
 * to the parent publication page. Once ACS task ingest lands, the loader
 * resolves the task row by `(referenceId, code)` and renders the body.
 */

import { getReferenceByDocument } from '@ab/bc-study';
import { externalUrlForReference, type ReferenceKind, ROUTES } from '@ab/constants';
import { isParseError, parseAcsLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../../../../../lib/source-links';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const rawUri = `airboss-ref:acs/${params.doc}/area-${params.area}/task-${params.task}`;
	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) throw error(404, `Malformed ACS reference: ${parsed.message}`);
	const locator = parseAcsLocator(parsed.locator);
	if (locator.kind === 'error') throw error(404, `Malformed ACS locator: ${locator.message}`);

	const ref = await getReferenceByDocument(params.doc).catch(() => null);
	if (!ref) throw error(404, `ACS ${params.doc} not found.`);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		uri: rawUri,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			acsHref: ROUTES.FLIGHTBAG_ACS(ref.documentSlug),
			externalUrl: externalUrlForReference(ref.kind as ReferenceKind, ref.documentSlug, ref.edition, ref.url),
		},
		raw: {
			doc: params.doc,
			area: params.area,
			task: params.task.toUpperCase(),
		},
	};
};
