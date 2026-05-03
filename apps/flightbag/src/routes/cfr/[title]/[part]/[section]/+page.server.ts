import { isParseError, parseIdentifier, parseRegsLocator } from '@ab/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * CFR section reader -- placeholder. The follow-on WP wires this to the
 * `regs` resolver to surface the section body + paragraph tree.
 */
export const load: PageServerLoad = ({ params }) => {
	const rawUri = `airboss-ref:regs/cfr-${params.title}/${params.part}/${params.section}`;

	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) {
		throw error(404, `Malformed CFR reference: ${parsed.message}`);
	}

	const locator = parseRegsLocator(parsed.locator);
	if (locator.kind === 'error') {
		throw error(404, `Malformed CFR locator: ${locator.message}`);
	}

	return {
		uri: rawUri,
		title: `${params.title} CFR ${params.part}.${params.section}`,
		body: '',
	};
};
