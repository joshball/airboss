import { helpRegistry } from '@ab/help';
import '$lib/help/register';
import type { PageLoad } from './$types';

/**
 * Hangar /help index. Mirrors the study help-index loader: pulls every
 * registered help page (hangar's pages are registered via the `$lib/help/
 * register` module-eval side-effect imported at the top of this file).
 */
export const load: PageLoad = () => {
	const pages = helpRegistry.getAllPages();
	return { pages };
};
