/**
 * Zod schemas for the course YAML authoring pipeline (course-primitive WP
 * Phase 6).
 *
 * Three schemas, mirroring the on-disk authoring shape under
 * `course/courses/<slug>/`:
 *
 *   - {@link courseManifestSchema}: `manifest.yaml` for a course
 *     (`slug`, `kind`, `title`, optional `status`, optional `description`).
 *   - {@link courseSectionSchema}: top-level shape of a section file under
 *     `course/courses/<slug>/sections/<file>.yaml`. Holds the section
 *     metadata (`code`, `ordinal`, `title`, optional `body_md`) and the
 *     inline list of child steps.
 *   - {@link courseStepSchema}: one step entry inside a section file.
 *     Steps require a `knowledge_node_id`; sections never carry one.
 *
 * All three schemas are `.strict()` -- unknown YAML keys reject early so
 * authoring typos surface as a Zod error before any DB write.
 *
 * The friendlier rejections that the seed validator also fires (duplicate
 * ordinals, missing `knowledge_node_id` references, the reserved `personal`
 * kind, etc.) live in `scripts/db/seed-courses.ts`. The schemas here only
 * enforce the YAML shape; the seed pipeline handles cross-row consistency.
 *
 * Browser-safe: this file is pure Zod + constants. No `node:*` imports, no
 * `@ab/db/connection` reach. Re-exported as types from the runtime barrel
 * (`@ab/bc-study`) so loaders / form actions can validate course YAML
 * uploaded through a future authoring surface without dragging the postgres
 * driver into the client bundle.
 */

import {
	COURSE_KIND_VALUES,
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
	type CourseKind,
	type CourseStatus,
} from '@ab/constants';
import { z } from 'zod';

// `course.slug` shape -- mirrors the DB CHECK
// (`course_slug_shape_check` in `libs/bc/study/src/schema.ts`). Keeping the
// regex literal here avoids leaking schema constants into the runtime
// barrel; the DB still has the final word at insert time.
const COURSE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

/**
 * Top-level `manifest.yaml` for a course directory.
 *
 * The `kind` field accepts every value in {@link COURSE_KIND_VALUES} at
 * the schema layer; the seed validator additionally rejects
 * `kind: personal` with the reserved-message because personal-course
 * authoring is deferred (per the course-primitive WP "Out of scope" list).
 *
 * `status` defaults to `active` to match the DB column default; `description`
 * defaults to `''` to match the DB column default.
 */
export const courseManifestSchema = z
	.object({
		slug: z.string().regex(COURSE_SLUG_REGEX, {
			message: 'course slug must match ^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$',
		}),
		kind: z.enum(COURSE_KIND_VALUES as [CourseKind, ...CourseKind[]]),
		title: z.string().min(1),
		status: z
			.enum(COURSE_STATUS_VALUES as [CourseStatus, ...CourseStatus[]])
			.optional()
			.default(COURSE_STATUSES.ACTIVE),
		description: z.string().optional().default(''),
	})
	.strict();

export type CourseManifest = z.infer<typeof courseManifestSchema>;

/**
 * One `step` entry inside a section file. Every step row carries a
 * `knowledge_node_id` (required) -- the seed enforces FK existence before
 * any DB write. `body_md` defaults to `''` to match the DB column default.
 */
export const courseStepSchema = z
	.object({
		code: z.string().min(1),
		ordinal: z.number().int().nonnegative(),
		title: z.string().min(1),
		body_md: z.string().optional().default(''),
		knowledge_node_id: z.string().min(1),
	})
	.strict();

export type CourseStep = z.infer<typeof courseStepSchema>;

/**
 * Top-level shape of a section YAML file under
 * `course/courses/<slug>/sections/<file>.yaml`.
 *
 * Holds the section metadata + the inline list of child steps. Sections
 * never carry a `knowledge_node_id` -- the seed validator rejects any
 * section that does.
 */
export const courseSectionSchema = z
	.object({
		code: z.string().min(1),
		ordinal: z.number().int().nonnegative(),
		title: z.string().min(1),
		body_md: z.string().optional().default(''),
		steps: z.array(courseStepSchema).default([]),
	})
	.strict();

export type CourseSection = z.infer<typeof courseSectionSchema>;
