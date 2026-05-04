/**
 * `/review/admin/buckets` -- list buckets on the singleton review board.
 *
 * Read-only summary: name, kind, filter criteria summary, item count,
 * sort order. Edit/Delete affordances live on the per-bucket edit page.
 *
 * Auth: admin-only via `requireRole(ROLES.ADMIN)`. Item counts run via the
 * existing `filterItemsByCriteria` BC primitive over the loaded item set
 * + the passing-session set so a bucket using `noPassingSession: true`
 * surfaces the correct count without a per-bucket SQL roundtrip.
 */

import { requireRole } from '@ab/auth';
import {
	filterItemsByCriteria,
	getOrCreateBoard,
	listBuckets,
	listItems,
	listItemsWithPassingSession,
} from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);
	const board = await getOrCreateBoard();
	const [buckets, items, passingItemIds] = await Promise.all([
		listBuckets(board.id),
		listItems(board.id),
		listItemsWithPassingSession(board.id),
	]);
	const bucketsWithCounts = buckets.map((b) => ({
		id: b.id,
		name: b.name,
		kindId: b.kindId,
		sortOrder: b.sortOrder,
		filterCriteria: b.filterCriteria,
		itemCount: filterItemsByCriteria(items, b.filterCriteria, passingItemIds).length,
	}));
	return { buckets: bucketsWithCounts };
};
