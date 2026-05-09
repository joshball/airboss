/**
 * `/review/buckets/[id]` -- bucket detail page. Shows the full sortable
 * item list for one bucket. The board renders the first N items inline;
 * "Show all" routes here for the long list.
 */

import { requireRole } from '@ab/auth';
import { filterItemsByCriteria, listBuckets, listItems, listItemsWithPassingSession } from '@ab/bc-hangar/server';
import { ROLES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	// Re-read from the layout's parent data via a fresh query so this page
	// is deep-linkable without depending on the layout's $derived state.
	const parentData = await event.parent();
	const board = parentData.board;
	const bucketId = event.params.id;
	const buckets = await listBuckets(board.id);
	const bucket = buckets.find((b) => b.id === bucketId);
	if (!bucket) throw error(404, 'Bucket not found');
	const [allItems, passing] = await Promise.all([listItems(board.id), listItemsWithPassingSession(board.id)]);
	const items = filterItemsByCriteria(allItems, bucket.filterCriteria, passing);
	return { bucket, items };
};
