/**
 * `/review/[kind]/[itemId]` -- per-kind item review surface.
 *
 * Phase 4 ships a placeholder page so the dispatcher's redirect from
 * `/review/items/[itemId]` lands somewhere meaningful instead of a 404.
 *
 * Phase 5 (`kind === 'wp_spec'`) layers the full WP-spec view + test-plan
 * walker on top via this same load function -- subsequent phases extend the
 * `kind` switch for other kinds. The placeholder route is the contract
 * surface; per-kind UIs upgrade in place rather than introducing parallel
 * routes.
 */

import { requireRole } from '@ab/auth';
import { getItem } from '@ab/bc-hangar';
import { REVIEW_KIND_LABELS, REVIEW_KIND_VALUES, type ReviewKind, ROLES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { kind, itemId } = event.params;
	if (!(REVIEW_KIND_VALUES as readonly string[]).includes(kind)) {
		throw error(404, 'Unknown review kind');
	}
	const item = await getItem(itemId);
	if (!item || item.deletedAt !== null) throw error(404, 'Item not found');
	if (item.kindId !== kind) {
		// Kind segment in the URL doesn't match the item's kind -- a stale link
		// or a bookmark from before a kind change. 404 rather than silently
		// rewriting the URL so the linker notices.
		throw error(404, 'Item is not of this kind');
	}
	return {
		kind: kind as ReviewKind,
		kindLabel: REVIEW_KIND_LABELS[kind as ReviewKind],
		item,
	};
};
