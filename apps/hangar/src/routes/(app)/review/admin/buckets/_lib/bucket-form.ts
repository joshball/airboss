/**
 * Shared parser for the bucket admin form. Both `/admin/buckets/new` and
 * `/admin/buckets/[bucketId]/edit` accept the same inputs:
 *
 * - `name`         (required, unique per board enforced server-side, charset
 *                   restricted to printable + whitespace via {@link BUCKET_NAME_DISALLOWED})
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
 * payload (with criteria already validated through
 * {@link validateBucketFilterCriteria}, so the type signature is honest) or
 * a `FormErrors` record so the route can `fail(400, ...)` without
 * re-deriving the field map.
 */

import { type BucketFilterCriteria, validateBucketFilterCriteria } from '@ab/bc-hangar';
import {
	FRONTMATTER_REVIEW_STATUS_VALUES,
	FRONTMATTER_STATUS_VALUES,
	type FrontmatterReviewStatus,
	type FrontmatterStatus,
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

/** Maximum bucket-name length (matches the DB `varchar(200)` column). */
export const BUCKET_NAME_MAX_LENGTH = 200;

/**
 * Disallowed code-point ranges in a bucket name. Defense-in-depth against
 * homoglyph / RTL-override mimicry and stray control bytes that would render
 * weirdly in nav lists, breadcrumbs, and the bucket table:
 *
 *  - U+0000..U+001F (C0 controls, including NUL / newline / tab)
 *  - U+007F         (DEL)
 *  - U+202A..U+202E (bidi-override)
 *  - U+2066..U+2069 (isolate-override)
 *
 * Whitespace inside a name is allowed; control bytes are not. Trim is
 * already applied in {@link readBucketForm}.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional reject of C0 controls / DEL / bidi-overrides in admin-supplied bucket names; see comment above.
const BUCKET_NAME_DISALLOWED = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;

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
	if (values.name === '') {
		errors.name = 'Name is required.';
	} else if (values.name.length > BUCKET_NAME_MAX_LENGTH) {
		errors.name = `Name must be ${BUCKET_NAME_MAX_LENGTH} characters or fewer.`;
	} else if (BUCKET_NAME_DISALLOWED.test(values.name)) {
		errors.name = 'Name contains disallowed characters (control bytes or bidi overrides).';
	}
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
			const parsed: unknown = JSON.parse(values.advancedJson);
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				errors.advancedJson = 'Advanced JSON must be a JSON object.';
			} else {
				// Validate at the parser boundary so the success branch's type
				// signature is honest -- `filterCriteria` is real
				// `BucketFilterCriteria`, not an unchecked cast pushed forward
				// to whichever caller happens to invoke
				// `validateBucketFilterCriteria` next.
				try {
					filterCriteria = validateBucketFilterCriteria(parsed);
				} catch (validateErr) {
					errors.advancedJson =
						validateErr instanceof RangeError ? validateErr.message : 'Advanced JSON is not a valid filter predicate.';
				}
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
			const fs = values.filterFmStatuses.filter((v): v is FrontmatterStatus =>
				(FRONTMATTER_STATUS_VALUES as readonly string[]).includes(v),
			);
			if (fs.length !== values.filterFmStatuses.length) {
				errors.filterFmStatuses = 'One or more frontmatter status values are invalid.';
			}
			draft.frontmatterStatus = fs;
		}
		if (values.filterReviewStatuses.length > 0) {
			const rs = values.filterReviewStatuses.filter((v): v is FrontmatterReviewStatus =>
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

	return {
		name: values.name,
		// Verified above via `REVIEW_KIND_VALUES` membership; cast is the
		// type-narrowing for return.
		kindId: values.kindId as ReviewKind,
		sortOrder,
		filterCriteria,
		values,
	};
}
