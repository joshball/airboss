import { helpRegistry, type MdNode, parseMarkdown } from '@ab/help';
import { error } from '@sveltejs/kit';
import '$lib/help/register';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const page = helpRegistry.getById(params.id);
	if (!page) {
		error(404, `Help page not found: ${params.id}`);
	}
	const sectionNodes: Record<string, MdNode[]> = {};
	for (const section of page.sections) {
		sectionNodes[section.id] = await parseMarkdown(section.body);
	}
	return { page, sectionNodes };
};
