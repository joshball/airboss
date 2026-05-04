/**
 * `/review/admin/buckets/new` -- create a new review bucket on the
 * singleton board.
 *
 * The form delivers a structured filter editor (kind / frontmatter status /
 * review status / no-passing-session toggle) plus an advanced JSON
 * override. `validateBucketFilterCriteria` runs in `createBucket`; we
 * surface its `RangeError` as a per-form error so the user fixes the
 * predicate inline rather than seeing a 500.
 *
 * Auth: admin-only via `requireRole(ROLES.ADMIN)`.
 */

import { requireRole } from '@ab/auth';
import { createBucket, getOrCreateBoard } from '@ab/bc-hangar';
import { ROLES, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { parseBucketForm, readBucketForm } from '../_lib/bucket-form';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:review:admin:buckets:new');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const fd = await event.request.formData();
		const values = readBucketForm(fd);
		const parsed = parseBucketForm(values);
		if ('errors' in parsed) {
			return fail(400, { create: 'invalid' as const, errors: parsed.errors, values: parsed.values });
		}
		try {
			const board = await getOrCreateBoard();
			await createBucket({
				boardId: board.id,
				name: parsed.name,
				kindId: parsed.kindId,
				filterCriteria: parsed.filterCriteria,
				sortOrder: parsed.sortOrder,
			});
		} catch (err) {
			if (isRedirect(err)) throw err;
			const errors: Record<string, string> = {};
			if (err instanceof RangeError) {
				errors.advancedJson = err.message;
			} else if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
				errors.name = 'A bucket with that name already exists on this board.';
			} else {
				errors._form = err instanceof Error ? err.message : 'Bucket create failed.';
			}
			log.error('createBucket failed', undefined, err instanceof Error ? err : new Error(String(err)));
			return fail(500, { create: 'error' as const, errors, values });
		}
		throw redirect(303, ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS);
	},
};
