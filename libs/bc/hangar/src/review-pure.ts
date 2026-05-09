// Pure (no DB, no Node) helpers extracted from `./review.ts` so they can
// be re-exported from the runtime barrel without dragging the postgres
// driver into the browser bundle. `./review.ts` is server-only because it
// imports `@ab/db/connection`; these helpers do not, so they live here.

import {
	type FrontmatterReviewStatus,
	type FrontmatterStatus,
	REVIEW_BOARD_COLUMN_NAMES,
	type ReviewBoardDefaultColumn,
} from '@ab/constants';
import type { BucketFilterCriteria } from './schema';

export function getDerivedColumnName(
	frontmatterStatus: FrontmatterStatus | null,
	reviewStatus: FrontmatterReviewStatus | null,
): ReviewBoardDefaultColumn {
	if (frontmatterStatus === 'reading') return REVIEW_BOARD_COLUMN_NAMES.IN_PROGRESS;
	if (frontmatterStatus === 'done') {
		if (reviewStatus === 'done') return REVIEW_BOARD_COLUMN_NAMES.DONE;
		return REVIEW_BOARD_COLUMN_NAMES.REVIEW;
	}
	return REVIEW_BOARD_COLUMN_NAMES.BACKLOG;
}

export function resolveItemColumnId(
	item: {
		pinnedColumnId: string | null;
		frontmatterStatus: FrontmatterStatus | null;
		reviewStatus: FrontmatterReviewStatus | null;
	},
	columns: ReadonlyArray<{ id: string; name: string }>,
): string {
	if (item.pinnedColumnId !== null) return item.pinnedColumnId;
	const derived = getDerivedColumnName(item.frontmatterStatus, item.reviewStatus);
	const match = columns.find((c) => c.name === derived);
	if (match) return match.id;
	const first = columns[0];
	if (!first) throw new Error('resolveItemColumnId: board has no columns');
	return first.id;
}

export function filterItemsByCriteria<
	T extends {
		kindId: string;
		frontmatterStatus: FrontmatterStatus | null;
		reviewStatus: FrontmatterReviewStatus | null;
		id: string;
	},
>(
	items: ReadonlyArray<T>,
	criteria: BucketFilterCriteria,
	passingSessionItemIds: ReadonlySet<string> = new Set(),
): ReadonlyArray<T> {
	return items.filter((item) => {
		if (criteria.kind !== undefined && item.kindId !== criteria.kind) return false;
		if (
			criteria.frontmatterStatus !== undefined &&
			criteria.frontmatterStatus.length > 0 &&
			(item.frontmatterStatus === null || !criteria.frontmatterStatus.includes(item.frontmatterStatus))
		) {
			return false;
		}
		if (
			criteria.reviewStatus !== undefined &&
			criteria.reviewStatus.length > 0 &&
			(item.reviewStatus === null || !criteria.reviewStatus.includes(item.reviewStatus))
		) {
			return false;
		}
		if (criteria.noPassingSession === true && passingSessionItemIds.has(item.id)) return false;
		return true;
	});
}

export function validateBucketFilterCriteria(input: unknown): BucketFilterCriteria {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		throw new RangeError('filterCriteria must be a structured object');
	}
	const obj = input as Record<string, unknown>;
	const allowed = new Set(['kind', 'frontmatterStatus', 'reviewStatus', 'noPassingSession']);
	for (const k of Object.keys(obj)) {
		if (!allowed.has(k)) throw new RangeError(`filterCriteria: unknown key '${k}'`);
	}
	const out: { -readonly [K in keyof BucketFilterCriteria]: BucketFilterCriteria[K] } = {};
	if (obj.kind !== undefined) {
		if (typeof obj.kind !== 'string') throw new RangeError('filterCriteria.kind must be a string');
		out.kind = obj.kind;
	}
	if (obj.frontmatterStatus !== undefined) {
		if (!Array.isArray(obj.frontmatterStatus))
			throw new RangeError('filterCriteria.frontmatterStatus must be a string array');
		const fs: Array<'unread' | 'reading' | 'done'> = [];
		for (const v of obj.frontmatterStatus) {
			if (v !== 'unread' && v !== 'reading' && v !== 'done')
				throw new RangeError(`filterCriteria.frontmatterStatus[]: invalid '${String(v)}'`);
			fs.push(v);
		}
		out.frontmatterStatus = fs;
	}
	if (obj.reviewStatus !== undefined) {
		if (!Array.isArray(obj.reviewStatus)) throw new RangeError('filterCriteria.reviewStatus must be a string array');
		const rs: Array<'pending' | 'done'> = [];
		for (const v of obj.reviewStatus) {
			if (v !== 'pending' && v !== 'done')
				throw new RangeError(`filterCriteria.reviewStatus[]: invalid '${String(v)}'`);
			rs.push(v);
		}
		out.reviewStatus = rs;
	}
	if (obj.noPassingSession !== undefined) {
		if (typeof obj.noPassingSession !== 'boolean')
			throw new RangeError('filterCriteria.noPassingSession must be a boolean');
		out.noPassingSession = obj.noPassingSession;
	}
	return out;
}

export function everyStepPassed(
	steps: ReadonlyArray<{ stepRef: string }>,
	recorded: ReadonlyArray<{ stepRef: string; outcome: string }>,
): boolean {
	if (steps.length === 0) return false;
	const planRefs = new Set(steps.map((s) => s.stepRef));
	const passByRef = new Map<string, boolean>();
	for (const r of recorded) {
		if (!planRefs.has(r.stepRef)) continue;
		if (passByRef.get(r.stepRef) === false) continue;
		passByRef.set(r.stepRef, r.outcome === 'pass');
	}
	for (const step of steps) {
		if (passByRef.get(step.stepRef) !== true) return false;
	}
	return true;
}
