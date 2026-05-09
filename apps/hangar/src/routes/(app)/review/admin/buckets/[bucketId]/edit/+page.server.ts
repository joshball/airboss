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

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { requireRole } from '@ab/auth';
import {
	countItemsByCriteria,
	deleteBucket,
	filterItemsByCriteria,
	getBucket,
	getOrCreateBoard,
	listBuckets,
	listItems,
	listItemsWithPassingSession,
	updateBucket,
} from '@ab/bc-hangar/server';
import { AUDIT_TARGETS, ROLES, ROUTES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import { parseBucketForm, readBucketForm } from '../../_lib/bucket-form';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:review:admin:buckets:edit');

/** Bucket-id prefix per `@ab/utils` `generateHangarReviewBucketId`. */
const BUCKET_ID_PREFIX = 'rbkt_';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);
	const { bucketId } = event.params;
	if (!bucketId.startsWith(BUCKET_ID_PREFIX)) throw error(404, 'Bucket not found');
	const board = await getOrCreateBoard();
	const bucket = await getBucket(bucketId, board.id);
	if (!bucket) throw error(404, 'Bucket not found');
	const fc = bucket.filterCriteria;
	// Item-impact preview for the delete-confirm banner. The data is loaded
	// here once so the page renders the count without a per-click round-trip.
	const [allBuckets, items, passingItemIds, itemCount] = await Promise.all([
		listBuckets(board.id),
		listItems(board.id),
		listItemsWithPassingSession(board.id),
		countItemsByCriteria(board.id, fc),
	]);
	// Items that match this bucket but no other live bucket on the board --
	// "if I delete this bucket, N of its items will have no surface."
	const otherBuckets = allBuckets.filter((b) => b.id !== bucket.id);
	const matchedHere = filterItemsByCriteria(items, fc, passingItemIds);
	let itemsWithoutOtherBucket = 0;
	for (const item of matchedHere) {
		const matchedElsewhere = otherBuckets.some((other) => {
			const inOther = filterItemsByCriteria([item], other.filterCriteria, passingItemIds);
			return inOther.length > 0;
		});
		if (!matchedElsewhere) itemsWithoutOtherBucket += 1;
	}
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
		impact: {
			itemCount,
			itemsWithoutOtherBucket,
		},
	};
};

export const actions: Actions = {
	update: async (event) => {
		const user = requireRole(event, ROLES.ADMIN);
		const { bucketId } = event.params;
		if (!bucketId.startsWith(BUCKET_ID_PREFIX)) throw error(404, 'Bucket not found');
		const fd = await event.request.formData();
		const values = readBucketForm(fd);
		const parsed = parseBucketForm(values);
		if ('errors' in parsed) {
			return fail(400, { update: 'invalid' as const, errors: parsed.errors, values: parsed.values });
		}
		try {
			await db.transaction(async (tx) => {
				const before = await getBucket(bucketId, undefined, tx);
				const after = await updateBucket(
					bucketId,
					{
						name: parsed.name,
						kindId: parsed.kindId,
						filterCriteria: parsed.filterCriteria,
						sortOrder: parsed.sortOrder,
					},
					tx,
				);
				await auditWrite(
					{
						actorId: user.id,
						op: AUDIT_OPS.UPDATE,
						targetType: AUDIT_TARGETS.HANGAR_REVIEW_BUCKET,
						targetId: after.id,
						before,
						after,
					},
					tx,
				);
			});
			log.info('updateBucket succeeded', { metadata: { bucketId, actorId: user.id } });
		} catch (err) {
			const errors: Record<string, string> = {};
			if (err instanceof RangeError) {
				errors.advancedJson = err.message;
			} else if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
				errors.name = 'A bucket with that name already exists on this board.';
			} else {
				errors._form = 'Bucket update failed. Check the server logs for details.';
			}
			log.error('updateBucket failed', undefined, err instanceof Error ? err : new Error(String(err)));
			return fail(500, { update: 'error' as const, errors, values });
		}
		// Mirror the create flow: redirect to the buckets list on success so
		// the user sees the predicate change reflected in the item-count
		// column. The list page is the IA "where to verify."
		throw redirect(303, ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS);
	},

	delete: async (event) => {
		const user = requireRole(event, ROLES.ADMIN);
		const { bucketId } = event.params;
		if (!bucketId.startsWith(BUCKET_ID_PREFIX)) throw error(404, 'Bucket not found');
		try {
			await db.transaction(async (tx) => {
				const before = await getBucket(bucketId, undefined, tx);
				await deleteBucket(bucketId, tx);
				await auditWrite(
					{
						actorId: user.id,
						op: AUDIT_OPS.DELETE,
						targetType: AUDIT_TARGETS.HANGAR_REVIEW_BUCKET,
						targetId: bucketId,
						before,
					},
					tx,
				);
			});
			log.info('deleteBucket succeeded', { metadata: { bucketId, actorId: user.id } });
		} catch (err) {
			log.error('deleteBucket failed', undefined, err instanceof Error ? err : new Error(String(err)));
			return fail(500, { delete: 'Bucket delete failed. Check the server logs for details.' });
		}
		throw redirect(303, ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS);
	},
};
