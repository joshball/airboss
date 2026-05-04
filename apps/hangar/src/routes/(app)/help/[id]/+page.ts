import { helpRegistry, type MdNode, parseMarkdown } from '@ab/help';
import { error } from '@sveltejs/kit';
import '$lib/help/register';
import type { PageLoad } from './$types';

/**
 * Hangar help-page detail. Mirrors study's `/help/[id]` loader: lazy-loads
 * the body via the registry (the body code-splits on the per-id dynamic
 * import inside `pages-index.ts`), parses each section's markdown in
 * parallel, and hands the result to `HelpLayout`.
 */
export const load: PageLoad = async ({ params }) => {
	const page = await helpRegistry.loadById(params.id);
	if (!page) {
		error(404, `Help page not found: ${params.id}`);
	}
	const entries = await Promise.all(
		page.sections.map(async (section): Promise<[string, MdNode[]]> => [section.id, await parseMarkdown(section.body)]),
	);
	const sectionNodes: Record<string, MdNode[]> = Object.fromEntries(entries);
	return { page, sectionNodes };
};
