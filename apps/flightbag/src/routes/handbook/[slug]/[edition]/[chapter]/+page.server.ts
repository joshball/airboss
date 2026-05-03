import type { PageServerLoad } from './$types';

/**
 * Handbook chapter -- placeholder. Follow-on WP wires this to the
 * `handbooks` resolver to surface the chapter intro + section list.
 */
export const load: PageServerLoad = ({ params }) => {
	const uri = `airboss-ref:handbooks/${params.slug}/${params.edition}/${params.chapter}`;
	return {
		uri,
		title: `${params.slug.toUpperCase()} ${params.edition} -- Chapter ${params.chapter}`,
		body: '',
	};
};
