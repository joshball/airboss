/**
 * Bug-tracker frontmatter Zod schema. Phase 6 of `tracking-system-overhaul`.
 *
 * Single source of truth for the validation rules enforced by:
 *   - `scripts/lint/bugs.ts`               (lint, runs in `bun run check`)
 *   - `scripts/lib/bug-loader.ts`          (read-only loader for the CLI + future hangar view)
 *   - `scripts/bug.ts`                     (read-only + mutation CLI dispatcher)
 *
 * The vocabulary itself (severities, statuses, products) lives in
 * `@ab/constants` (`libs/constants/src/bug.ts`); this file is the
 * Zod-shaped wrapper. Mirrors the WP frontmatter pattern from ADR 025.
 *
 * `product` reuses `WP_PRODUCTS` so the WP and bug surfaces filter on the
 * same surface vocabulary -- a bug filed against the study app shows up
 * under the same `--product study` filter as the WPs that target it.
 */

import { BUG_SEVERITIES, BUG_STATUSES, WP_PRODUCTS } from '@ab/constants';
import { z } from 'zod';

/** YYYY-MM-DD pattern for `discovered_date`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z.string().regex(ISO_DATE, 'must be ISO date YYYY-MM-DD');

/** Bug id pattern: lowercase kebab-case, must start with `bug-`. */
const bugIdString = z
	.string()
	.min(1)
	.regex(/^bug-[a-z0-9][a-z0-9-]*$/, 'must be kebab-case starting with `bug-` (e.g. bug-ac-url-helper-drift)');

/** WP id pattern reused for `fix_wp` references. */
const wpIdString = z
	.string()
	.min(1)
	.regex(/^[a-z0-9][a-z0-9-]*$/, 'must be kebab-case (lowercase letters, digits, hyphens)');

/** Frontmatter schema, parsed from `docs/bugs/<slug>.md`.
 *
 * The loader writes the file-derived id back into the parsed object before
 * passing it to the schema, so authors do not have to repeat the slug.
 * Lint compares the filename to `id` and fails on mismatch. */
export const bugFrontmatterSchema = z.object({
	id: bugIdString,
	title: z.string().min(1, 'title is required'),
	product: z.enum(WP_PRODUCTS),
	severity: z.enum(BUG_SEVERITIES),
	status: z.enum(BUG_STATUSES),
	discovered_pr: z.number().int().positive().nullable().optional().default(null),
	discovered_date: dateString,
	fix_pr: z.number().int().positive().nullable().optional().default(null),
	fix_wp: wpIdString.nullable().optional().default(null),
	repro: z.string().optional(),
	tags: z.array(z.string().min(1)).optional().default([]),
});

export type BugFrontmatter = z.infer<typeof bugFrontmatterSchema>;

/** A bug as returned by the loader. The `validation_errors` field carries any
 * Zod issues so the caller (CLI, hangar view) can display malformed bugs
 * instead of crashing. `frontmatter` is `null` when parsing failed entirely
 * (e.g. no fence, unparseable YAML). */
export interface Bug {
	/** Slug (matches filename under `docs/bugs/`, sans `.md`). */
	id: string;
	/** Absolute path to the bug markdown file. */
	bugPath: string;
	/** Parsed frontmatter when valid; `null` on parse failure. */
	frontmatter: BugFrontmatter | null;
	/** Raw frontmatter object before schema validation, for diagnostic reporting. */
	rawFrontmatter: Record<string, unknown> | null;
	/** Human-readable validation errors. Empty array on a clean bug. */
	validation_errors: BugValidationError[];
}

export interface BugValidationError {
	field: string;
	message: string;
}
