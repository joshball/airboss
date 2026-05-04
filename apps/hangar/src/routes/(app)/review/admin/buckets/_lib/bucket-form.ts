/**
 * Shared parser for the bucket admin form. Both `/admin/buckets/new` and
 * `/admin/buckets/[bucketId]/edit` accept the same inputs:
 *
 * - `name`         (required, unique per board enforced server-side)
 * - `kindId`       (required, one of REVIEW_KIND_VALUES)
 * - `sortOrder`    (required integer)
 * - structured filter inputs:
 *     - `filterKind`           (optional kind narrow within the predicate)
 *     - `filterFmStatuses`     (zero or more `unread|reading|done`)
 *     - `filterReviewStatuses` (zero or more `pending|done`)
 *     - `filterNoPassing`      (`'on'` -> true)
 * - `advancedJson` (optional raw jsonb override; overrides the structured
 *   inputs when present, validated through `validateBucketFilterCriteria`).
 *
 * Returns either a parsed `{ name, kindId, sortOrder, filterCriteria }`
 * payload or a `FormErrors` record so the route can `fail(400, ...)`
 * without re-deriving the field map.
 */

import type { BucketFilterCriteria } from '@ab/bc-hangar';
import {
	FRONTMATTER_REVIEW_STATUS_VALUES,
	FRONTMATTER_STATUS_VALUES,
	REVIEW_KIND_VALUES,
	type ReviewKind,
} from '@ab/constants';

export interface BucketFormValues {
	readonly name: string;
	readonly kindId: string;
	readonly sortOrderRaw: string;
	readonly filterKind: string;
	readonly filterFmStatuses: readonly string[];
	readonly filterReviewStatuses: readonly string[];
	readonly filterNoPassing: boolean;
	readonly advancedJson: string;
}

export interface BucketFormParsed {
	readonly name: string;
	readonly kindId: ReviewKind;
	readonly sortOrder: number;
	readonly filterCriteria: BucketFilterCriteria;
	readonly values: BucketFormValues;
}

export interface BucketFormErrors {
	readonly errors: Record<string, string>;
	readonly values: BucketFormValues;
}

export function readBucketForm(fd: FormData): BucketFormValues {
	const fmStatuses = fd.getAll('filterFmStatuses').map((v) => String(v));
	const reviewStatuses = fd.getAll('filterReviewStatuses').map((v) => String(v));
	return {
		name: String(fd.get('name') ?? '').trim(),
		kindId: String(fd.get('kindId') ?? ''),
		sortOrderRaw: String(fd.get('sortOrder') ?? '0'),
		filterKind: String(fd.get('filterKind') ?? ''),
		filterFmStatuses: fmStatuses,
		filterReviewStatuses: reviewStatuses,
		filterNoPassing: fd.get('filterNoPassing') === 'on',
		advancedJson: String(fd.get('advancedJson') ?? '').trim(),
	};
}

export function parseBucketForm(values: BucketFormValues): BucketFormParsed | BucketFormErrors {
	const errors: Record<string, string> = {};
	if (values.name === '') errors.name = 'Name is required.';
	if (values.name.length > 200) errors.name = 'Name must be 200 characters or fewer.';
	if (!(REVIEW_KIND_VALUES as readonly string[]).includes(values.kindId)) {
		errors.kindId = 'Pick a kind.';
	}
	const sortOrder = Number.parseInt(values.sortOrderRaw, 10);
	if (!Number.isFinite(sortOrder) || sortOrder < 0) {
		errors.sortOrder = 'Sort order must be a non-negative integer.';
	}

	let filterCriteria: BucketFilterCriteria = {};
	if (values.advancedJson !== '') {
		try {
			const parsed = JSON.parse(values.advancedJson);
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				errors.advancedJson = 'Advanced JSON must be a JSON object.';
			} else {
				filterCriteria = parsed as BucketFilterCriteria;
			}
		} catch (err) {
			errors.advancedJson = err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON.';
		}
	} else {
		const draft: { -readonly [K in keyof BucketFilterCriteria]: BucketFilterCriteria[K] } = {};
		if (values.filterKind !== '') {
			if (!(REVIEW_KIND_VALUES as readonly string[]).includes(values.filterKind)) {
				errors.filterKind = 'Filter kind is not a known review kind.';
			} else {
				draft.kind = values.filterKind;
			}
		}
		if (values.filterFmStatuses.length > 0) {
			const fs = values.filterFmStatuses.filter((v): v is 'unread' | 'reading' | 'done' =>
				(FRONTMATTER_STATUS_VALUES as readonly string[]).includes(v),
			);
			if (fs.length !== values.filterFmStatuses.length) {
				errors.filterFmStatuses = 'One or more frontmatter status values are invalid.';
			}
			draft.frontmatterStatus = fs;
		}
		if (values.filterReviewStatuses.length > 0) {
			const rs = values.filterReviewStatuses.filter((v): v is 'pending' | 'done' =>
				(FRONTMATTER_REVIEW_STATUS_VALUES as readonly string[]).includes(v),
			);
			if (rs.length !== values.filterReviewStatuses.length) {
				errors.filterReviewStatuses = 'One or more review status values are invalid.';
			}
			draft.reviewStatus = rs;
		}
		if (values.filterNoPassing) {
			draft.noPassingSession = true;
		}
		filterCriteria = draft;
	}

	if (Object.keys(errors).length > 0) {
		return { errors, values };
	}

	if (!(REVIEW_KIND_VALUES as readonly string[]).includes(values.kindId)) {
		// Type narrowing safety -- already validated above; this is the
		// "narrow for the return" branch.
		return { errors: { kindId: 'Pick a kind.' }, values };
	}
	return {
		name: values.name,
		kindId: values.kindId as ReviewKind,
		sortOrder,
		filterCriteria,
		values,
	};
}
