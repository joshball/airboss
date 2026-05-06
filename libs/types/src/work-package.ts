/**
 * Work-package frontmatter Zod schema. ADR 025.
 *
 * Single source of truth for the validation rules enforced by:
 *   - `scripts/lint/wp-frontmatter.ts` (lint, runs in `bun run check`)
 *   - `scripts/lib/wp-loader.ts` (read-only loader for the CLI + future hangar view)
 *   - `scripts/wp.ts` (read-only CLI dispatcher)
 *
 * The vocabulary itself (categories, statuses, products) lives in
 * `@ab/constants` (`libs/constants/src/work-package.ts`); this file is the
 * Zod-shaped wrapper.
 */

import {
	WP_AGENT_REVIEW_STATUSES,
	WP_CATEGORIES,
	WP_HUMAN_REVIEW_STATUSES,
	WP_OWNERS,
	WP_PRODUCTS,
	WP_STATUSES,
} from '@ab/constants';
import { z } from 'zod';

/** YYYY-MM-DD pattern for `created` and `shipped_date`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z.string().regex(ISO_DATE, 'must be ISO date YYYY-MM-DD');

/** WP id pattern: lowercase kebab-case. Must match the parent directory name. */
const wpIdString = z
	.string()
	.min(1)
	.regex(/^[a-z0-9][a-z0-9-]*$/, 'must be kebab-case (lowercase letters, digits, hyphens)');

/** Frontmatter schema, parsed from `docs/work-packages/<slug>/spec.md`.
 *
 * The loader writes the directory-derived id back into the parsed object
 * before passing it to the schema, so authors do not have to repeat the slug.
 * Lint compares the directory name to `id` and fails on mismatch. */
export const workPackageFrontmatterSchema = z
	.object({
		id: wpIdString,
		title: z.string().min(1, 'title is required'),
		product: z.enum(WP_PRODUCTS),
		category: z.enum(WP_CATEGORIES),
		status: z.enum(WP_STATUSES),
		agent_review_status: z.enum(WP_AGENT_REVIEW_STATUSES),
		human_review_status: z.enum(WP_HUMAN_REVIEW_STATUSES),
		created: dateString,
		shipped_date: dateString.nullable().optional(),
		shipped_prs: z.array(z.number().int().positive()).optional().default([]),
		depends_on: z.array(wpIdString).optional().default([]),
		unblocks: z.array(wpIdString).optional().default([]),
		owner: z.enum(WP_OWNERS).optional(),
		tags: z.array(z.string().min(1)).optional().default([]),
	})
	.superRefine((value, ctx) => {
		// status: shipped REQUIRES human_review_status: signed-off and a shipped_date.
		if (value.status === 'shipped') {
			if (value.human_review_status !== 'signed-off') {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'status=shipped requires human_review_status=signed-off (user-only gate)',
					path: ['status'],
				});
			}
			if (value.shipped_date === undefined || value.shipped_date === null) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'status=shipped requires shipped_date',
					path: ['shipped_date'],
				});
			}
		}
	});

export type WorkPackageFrontmatter = z.infer<typeof workPackageFrontmatterSchema>;

/** A WP as returned by the loader. The `validation_errors` field carries any
 * Zod issues so the caller (CLI, hangar view) can display malformed WPs
 * instead of crashing. `frontmatter` is `null` when parsing failed entirely
 * (e.g. no fence, unparseable YAML). */
export interface WorkPackage {
	/** Slug (matches directory name under `docs/work-packages/`). */
	id: string;
	/** Absolute path to `spec.md`. */
	specPath: string;
	/** Parsed frontmatter when valid; `null` on parse failure. */
	frontmatter: WorkPackageFrontmatter | null;
	/** Raw frontmatter object before schema validation, for diagnostic reporting. */
	rawFrontmatter: Record<string, unknown> | null;
	/** Human-readable validation errors. Empty array on a clean WP. */
	validation_errors: WorkPackageValidationError[];
}

export interface WorkPackageValidationError {
	field: string;
	message: string;
}
