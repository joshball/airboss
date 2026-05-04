/**
 * `/review/admin/buckets/[bucketId]/edit` -- edit / delete a review bucket.
 *
 * Update mirrors the create flow's parser; delete is confirm-gated client-
 * side and hard-deletes the bucket row. Items are NOT deleted -- they fall
 * through to whatever other bucket's predicate matches them, or hide until
 * a new bucket catches them. The spec calls this out explicitly.
 *
 * Auth: admin-only via `requireRole(ROLES.ADMIN)`.
 */

import { requireRole } from '@ab/auth';
import { deleteBucket, getBucket, updateBucket } from '@ab/bc-hangar';
import { ROLES, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { parseBucketForm, readBucketForm } from '../../_lib/bucket-form';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:review:admin:buckets:edit');

interface FilterCriteriaRecord {
	kind?: string;
	frontmatterStatus?: ReadonlyArray<string>;
	reviewStatus?: ReadonlyArray<string>;
	noPassingSession?: boolean;
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);
	const { bucketId } = event.params;
	const bucket = await getBucket(bucketId);
	if (!bucket) throw error(404, 'Bucket not found');
	const fc = (bucket.filterCriteria ?? {}) as FilterCriteriaRecord;
	return {
		bucket: {
			id: bucket.id,
			name: bucket.name,
			kindId: bucket.kindId,
			sortOrder: bucket.sortOrder,
			filterCriteria: bucket.filterCriteria,
			filterKind: fc.kind ?? '',
			filterFmStatuses: fc.frontmatterStatus ?? [],
			filterReviewStatuses: fc.reviewStatus ?? [],
			filterNoPassing: fc.noPassingSession === true,
		},
	};
};

export const actions: Actions = {
	update: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const { bucketId } = event.params;
		const fd = await event.request.formData();
		const values = readBucketForm(fd);
		const parsed = parseBucketForm(values);
		if ('errors' in parsed) {
			return fail(400, { update: 'invalid' as const, errors: parsed.errors, values: parsed.values });
		}
		try {
			await updateBucket(bucketId, {
				name: parsed.name,
				kindId: parsed.kindId,
				filterCriteria: parsed.filterCriteria,
				sortOrder: parsed.sortOrder,
			});
		} catch (err) {
			const errors: Record<string, string> = {};
			if (err instanceof RangeError) {
				errors.advancedJson = err.message;
			} else if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
				errors.name = 'A bucket with that name already exists on this board.';
			} else {
				errors._form = err instanceof Error ? err.message : 'Bucket update failed.';
			}
			log.error('updateBucket failed', undefined, err instanceof Error ? err : new Error(String(err)));
			return fail(500, { update: 'error' as const, errors, values });
		}
		return { update: 'ok' as const };
	},

	delete: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const { bucketId } = event.params;
		try {
			await deleteBucket(bucketId);
		} catch (err) {
			if (isRedirect(err)) throw err;
			const message = err instanceof Error ? err.message : 'Bucket delete failed.';
			log.error('deleteBucket failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(500, { delete: message });
		}
		throw redirect(303, ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS);
	},
};
