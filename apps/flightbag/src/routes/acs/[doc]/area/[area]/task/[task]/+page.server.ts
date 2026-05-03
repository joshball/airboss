import { isParseError, parseAcsLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * ACS task reader -- placeholder. Follow-on WP wires the `acs` resolver to
 * surface the task body + element tree (K/R/S triads).
 */
export const load: PageServerLoad = ({ params }) => {
	const rawUri = `airboss-ref:acs/${params.doc}/area-${params.area}/task-${params.task}`;

	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) {
		throw error(404, `Malformed ACS reference: ${parsed.message}`);
	}

	const locator = parseAcsLocator(parsed.locator);
	if (locator.kind === 'error') {
		throw error(404, `Malformed ACS locator: ${locator.message}`);
	}

	return {
		uri: rawUri,
		title: `ACS ${params.doc} -- Area ${params.area} / Task ${params.task.toUpperCase()}`,
		body: '',
	};
};
