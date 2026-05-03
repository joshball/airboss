import type { PageServerLoad } from './$types';

/**
 * Handbook landing -- placeholder. Surfaces the URI shape so the page can
 * render a header without yet calling into the resolver. The follow-on
 * migration WP wires this load function to the real `@ab/sources`
 * `handbooks` resolver and resolves the manifest's chapter list.
 */
export const load: PageServerLoad = ({ params }) => {
	const uri = `airboss-ref:handbooks/${params.slug}/${params.edition}`;
	return {
		uri,
		title: `${params.slug.toUpperCase()} -- ${params.edition}`,
		body: '',
	};
};
