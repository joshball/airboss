/**
 * `/review/items/[itemId]` -- per-item dispatcher. Looks up the item,
 * redirects to the kind-specific review view (`/review/[kind]/[itemId]`).
 *
 * Phase 4 ships the redirect; the per-kind landing pages (`/review/wp_spec`,
 * `/review/wp_test_plan`, etc.) land in subsequent phases. Until then, a
 * direct hit on a kind that hasn't shipped its page yet 404s -- the
 * dispatcher itself stays correct.
 */

import { requireRole } from '@ab/auth';
import { getItem } from '@ab/bc-hangar/server';
import { ROLES, ROUTES } from '@ab/constants';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const item = await getItem(event.params.itemId);
	if (!item || item.deletedAt !== null) throw error(404, 'Item not found');
	throw redirect(303, ROUTES.HANGAR_REVIEW_KIND(item.kindId, item.id));
};
