/**
 * `/ingest-review` layout gate. Inherits the `(app)` group's role check
 * (AUTHOR / OPERATOR / ADMIN) and computes the cache root once for the
 * detail page's PDF link rendering.
 *
 * Per dual-gate auth: every form action that writes calls
 * `requireRole(...)` itself; this layout only authenticates GETs.
 */

import { requireRole } from '@ab/auth';
import { ROLES, resolveCacheRoot } from '@ab/constants';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	return {
		cacheRoot: resolveCacheRoot({ ensureExists: false }),
	};
};
