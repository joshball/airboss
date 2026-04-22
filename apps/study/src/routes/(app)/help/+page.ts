import { helpRegistry } from '@ab/help';
import '$lib/help/register';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const pages = helpRegistry.getAllPages();
	return { pages };
};
