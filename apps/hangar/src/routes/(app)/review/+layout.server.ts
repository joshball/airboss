/**
 * `/review` layout load -- get-or-create the singleton board, seed columns +
 * kinds + buckets if absent, list everything the board needs to render
 * (columns, kinds, buckets, items, passing-session item-ids).
 *
 * Auto-setup per spec.md: first visit creates a board + four default
 * columns + the seed bucket list; subsequent visits skip the seeding via
 * onConflict.
 *
 * Loader: not auto-fired here. The `/docs` empty-state already exposes
 * "Run loader"; spec gap #4's "boot hook fires on first /review load" is
 * deferred to a later phase per the plan. Phase 4 ships a manual
 * `?/runLoader` action on this route so the reviewer can refresh from the
 * board.
 */

import { requireRole } from '@ab/auth';
import {
	getOrCreateBoard,
	listBuckets,
	listColumns,
	listItems,
	listItemsWithPassingSession,
	listKinds,
	seedDefaultBuckets,
	seedReviewKinds,
} from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const board = await getOrCreateBoard();
	// Idempotent seeders -- they no-op when the rows already exist. Running
	// them on every layout request keeps the board self-healing if rows
	// were truncated externally (e.g. via a manual SQL edit).
	await seedReviewKinds();
	await seedDefaultBuckets(board.id);
	const [columns, kinds, buckets, items, passingItemIds] = await Promise.all([
		listColumns(board.id),
		listKinds(),
		listBuckets(board.id),
		listItems(board.id),
		listItemsWithPassingSession(board.id),
	]);
	return {
		board,
		columns,
		kinds,
		buckets,
		items,
		// Serialise the Set as an array for SvelteKit's load contract.
		passingItemIds: [...passingItemIds],
	};
};
