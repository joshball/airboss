/**
 * `/review/admin/buckets` -- list buckets on the singleton review board.
 *
 * Read-only summary: name, kind, filter criteria summary, item count,
 * sort order. Edit/Delete affordances live on the per-bucket edit page.
 *
 * Auth: admin-only via `requireRole(ROLES.ADMIN)`. Item counts run via
 * `countItemsByCriteria` (SQL `COUNT(*)` per bucket) rather than the
 * in-memory `filterItemsByCriteria` over `listItems`, because the latter
 * silently truncates at `REVIEW_LIST_HARD_CAP` and an admin reasoning
 * about a predicate needs the real count.
 */

import { requireRole } from '@ab/auth';
import { countItemsByCriteria, getOrCreateBoard, listBuckets } from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);
	const board = await getOrCreateBoard();
	const buckets = await listBuckets(board.id);
	// Per-bucket SQL `COUNT(*)` -- 6-12 round-trips on this admin-only page is
	// fine; what matters is that the count is not capped at REVIEW_LIST_HARD_CAP.
	const counts = await Promise.all(buckets.map((b) => countItemsByCriteria(board.id, b.filterCriteria)));
	const bucketsWithCounts = buckets.map((b, i) => ({
		id: b.id,
		name: b.name,
		kindId: b.kindId,
		sortOrder: b.sortOrder,
		filterCriteria: b.filterCriteria,
		itemCount: counts[i] ?? 0,
	}));
	return { buckets: bucketsWithCounts };
};
