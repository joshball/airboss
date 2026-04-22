import { helpRegistry } from '@ab/help';
import { error } from '@sveltejs/kit';
import '$lib/help/register';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const page = helpRegistry.getById(params.id);
	if (!page) {
		error(404, `Help page not found: ${params.id}`);
	}
	return { page };
};
