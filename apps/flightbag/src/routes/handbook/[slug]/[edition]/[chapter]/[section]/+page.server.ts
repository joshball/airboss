import { isParseError, parseHandbooksLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Handbook section reader (leaf) -- placeholder. Surfaces the airboss-ref:
 * URI for the section and proves the URI parses against the locator parser
 * end-to-end. The follow-on migration WP swaps in the real resolver call to
 * read `content_md` for the section.
 */
export const load: PageServerLoad = ({ params }) => {
	const rawUri = `airboss-ref:handbooks/${params.slug}/${params.edition}/${params.chapter}/${params.section}`;

	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) {
		throw error(404, `Malformed handbook reference: ${parsed.message}`);
	}

	const locator = parseHandbooksLocator(parsed.locator);
	if (locator.kind === 'error') {
		throw error(404, `Malformed handbook locator: ${locator.message}`);
	}

	return {
		uri: rawUri,
		title: `${params.slug.toUpperCase()} ${params.edition} §${params.chapter}.${params.section}`,
		body: '',
	};
};
