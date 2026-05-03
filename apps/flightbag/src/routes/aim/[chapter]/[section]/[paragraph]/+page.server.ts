import { isParseError, parseAimLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * AIM paragraph reader -- placeholder. Validates the URI parses, then
 * surfaces a placeholder body. Follow-on WP wires the `aim` resolver.
 */
export const load: PageServerLoad = ({ params }) => {
	const rawUri = `airboss-ref:aim/${params.chapter}-${params.section}-${params.paragraph}`;

	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) {
		throw error(404, `Malformed AIM reference: ${parsed.message}`);
	}

	const locator = parseAimLocator(parsed.locator);
	if (locator.kind === 'error') {
		throw error(404, `Malformed AIM locator: ${locator.message}`);
	}

	return {
		uri: rawUri,
		title: `AIM ${params.chapter}-${params.section}-${params.paragraph}`,
		body: '',
	};
};
