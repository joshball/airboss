/**
 * `/docs` layout load -- builds the file tree once per request. The
 * `+layout.svelte` renders the tree on the left rail and the page content on
 * the right; child routes get the tree via `parent()` for free.
 */

import { requireRole } from '@ab/auth';
import { listDocsTree, REPO_ROOT } from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const tree = await listDocsTree(REPO_ROOT);
	return { tree };
};
