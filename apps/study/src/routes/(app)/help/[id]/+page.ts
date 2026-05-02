import { helpRegistry, type MdNode, parseMarkdown } from '@ab/help';
import { error } from '@sveltejs/kit';
import '$lib/help/register';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	// `loadById` resolves the body via the lazy loader registered by
	// `register.ts`. The page bundle therefore code-splits on the
	// per-id dynamic import in `pages-index.ts`.
	const page = await helpRegistry.loadById(params.id);
	if (!page) {
		error(404, `Help page not found: ${params.id}`);
	}
	// Parse + highlight every section in parallel; serial awaits would make
	// detail-page latency the sum of per-section work instead of the max.
	const entries = await Promise.all(
		page.sections.map(async (section): Promise<[string, MdNode[]]> => [section.id, await parseMarkdown(section.body)]),
	);
	const sectionNodes: Record<string, MdNode[]> = Object.fromEntries(entries);
	return { page, sectionNodes };
};
