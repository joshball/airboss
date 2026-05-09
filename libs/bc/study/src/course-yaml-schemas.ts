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
 *     Steps SHOULD carry `knowledge_node_id`; sections SHOULD NOT. Both
 *     fields are typed as optional here so the seed handler in
 *     `scripts/db/seed-courses.ts` can fire the spec's verbatim rejection
 *     messages (`step '...' must carry knowledge_node_id` /
 *     `section '...' must not carry knowledge_node_id`) instead of Zod's
 *     generic "Required" / "Unrecognized key" wording. The seed handler
 *     owns the semantic; the schema only owns the shape.
 *
 * All three schemas are `.strict()` -- unknown YAML keys reject early so
 * authoring typos surface as a Zod error before any DB write.
 *
 * The friendlier rejections that the seed validator also fires (duplicate
 * ordinals, missing `knowledge_node_id` references, the reserved `personal`
 * kind, the section-carries-node / step-omits-node pair, etc.) live in
 * `scripts/db/seed-courses.ts`. The schemas here only enforce the YAML
 * shape; the seed pipeline handles cross-row consistency and the
 * `knowledge_node_id` placement rule.
 *
 * Browser-safe: this file is pure Zod + constants. No `node:*` imports, no
 * `@ab/db/connection` reach. Re-exported as types from the runtime barrel
 * (`@ab/bc-study`) so loaders / form actions can validate course YAML
 * uploaded through a future authoring surface without dragging the postgres
 * driver into the client bundle.
 */

import {
	COURSE_KIND_VALUES,
	COURSE_SLUG_REGEX,
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
	type CourseKind,
	type CourseStatus,
} from '@ab/constants';
import { z } from 'zod';

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
 * One `step` entry inside a section file.
 *
 * `knowledge_node_id` is typed as optional here so a step that omits the
 * field reaches the seed handler's friendlier rejection
 * (`step '<course>.<code>' must carry knowledge_node_id`) instead of
 * Zod's generic `steps.N.knowledge_node_id: Required` message. The seed
 * handler in `scripts/db/seed-courses.ts` enforces the requirement and
 * also FK-checks the node id before any DB write.
 *
 * `body_md` defaults to `''` to match the DB column default.
 */
export const courseStepSchema = z
	.object({
		code: z.string().min(1),
		ordinal: z.number().int().nonnegative(),
		title: z.string().min(1),
		body_md: z.string().optional().default(''),
		knowledge_node_id: z.string().min(1).optional(),
	})
	.strict();

export type CourseStep = z.infer<typeof courseStepSchema>;

/**
 * Top-level shape of a section YAML file under
 * `course/courses/<slug>/sections/<file>.yaml`.
 *
 * Holds the section metadata + the inline list of child steps. Sections
 * never carry a `knowledge_node_id`, but the field is declared here as
 * optional so a malformed section that smuggles the key reaches the seed
 * handler's friendlier rejection
 * (`section '<course>.<code>' must not carry knowledge_node_id`) instead
 * of Zod's generic `Unrecognized key(s) in object: 'knowledge_node_id'`
 * message. The seed handler in `scripts/db/seed-courses.ts` enforces the
 * placement rule before any DB write.
 *
 * The `.strict()` guard is preserved so genuinely unknown keys still
 * reject early with a typo-style Zod error.
 */
export const courseSectionSchema = z
	.object({
		code: z.string().min(1),
		ordinal: z.number().int().nonnegative(),
		title: z.string().min(1),
		body_md: z.string().optional().default(''),
		knowledge_node_id: z.string().min(1).optional(),
		steps: z.array(courseStepSchema).default([]),
	})
	.strict();

export type CourseSection = z.infer<typeof courseSectionSchema>;
