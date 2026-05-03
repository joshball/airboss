import { isParseError, parseAcLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Advisory Circular reader -- placeholder. Follow-on WP wires the `ac`
 * resolver to surface the whole-doc body (until per-section AC promotion
 * lands, this is the leaf reader for AC).
 */
export const load: PageServerLoad = ({ params }) => {
	const rawUri = `airboss-ref:ac/${params.doc}/${params.rev}`;

	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) {
		throw error(404, `Malformed AC reference: ${parsed.message}`);
	}

	const locator = parseAcLocator(parsed.locator);
	if (locator.kind === 'error') {
		throw error(404, `Malformed AC locator: ${locator.message}`);
	}

	return {
		uri: rawUri,
		title: `AC ${params.doc}${params.rev.toUpperCase()}`,
		body: '',
	};
};
