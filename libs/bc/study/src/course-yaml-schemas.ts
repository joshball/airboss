/**
 * Zod schemas for the course YAML authoring pipeline.
 *
 * Recursive tree shape (course-tree-arbitrary-depth WP): a course
 * `manifest.yaml` plus one `sections/<file>.yaml` per section. Every
 * section holds a `steps[]` of {@link CourseTreeNode} -- a discriminated
 * union over `level: 'step'` (leaf) and `level: 'lesson'` (interior).
 * `level` is optional and defaults to `'step'` so 2-level content
 * authored before this WP continues to parse without edits.
 *
 *   - {@link courseManifestSchema}: `manifest.yaml` for a course
 *     (`slug`, `kind`, `title`, optional `status`, optional `description`).
 *   - {@link courseSectionSchema}: top-level shape of a section file under
 *     `course/courses/<slug>/sections/<file>.yaml`. Holds the section
 *     metadata (`code`, `ordinal`, `title`, optional `body_md`) and the
 *     inline list of child tree nodes (steps and/or lessons).
 *   - {@link courseStepSchema}: a leaf inside a section / lesson.
 *     Steps SHOULD carry `knowledge_node_id`; sections / lessons SHOULD
 *     NOT. The field is typed as optional here so the seed handler in
 *     `scripts/db/seed-courses.ts` can fire the spec's verbatim rejection
 *     messages (`step '...' must carry knowledge_node_id` /
 *     `lesson '...' must not carry knowledge_node_id`) instead of Zod's
 *     generic "Required" / "Unrecognized key" wording. The seed handler
 *     owns the semantic; the schema only owns the shape.
 *   - {@link courseLessonSchema}: an interior node between a section and
 *     its leaves. Carries its own `steps[]` of nested tree nodes.
 *   - {@link courseTreeNodeSchema}: the recursive node union. Defined via
 *     `z.lazy()` so the recursion (a lesson's `steps[]` itself contains
 *     tree nodes) type-checks without forward-reference errors.
 *
 * All schemas are `.strict()` -- unknown YAML keys reject early so
 * authoring typos surface as a Zod error before any DB write.
 *
 * The friendlier rejections that the seed validator also fires
 * (duplicate ordinals, missing `knowledge_node_id` references, the
 * reserved `personal` kind, the lesson-carries-node / step-omits-node
 * pair, max-depth, every-non-leaf-has-children, etc.) live in
 * `scripts/db/seed-courses.ts`. The schemas here only enforce the YAML
 * shape; the seed pipeline handles cross-row consistency and the
 * `knowledge_node_id` placement rule.
 *
 * Browser-safe: this file is pure Zod + constants. No `node:*` imports,
 * no `@ab/db/connection` reach. Re-exported as types from the runtime
 * barrel (`@ab/bc-study`) so loaders / form actions can validate course
 * YAML uploaded through a future authoring surface without dragging the
 * postgres driver into the client bundle.
 */

import {
	COURSE_KIND_VALUES,
	COURSE_SLUG_REGEX,
	COURSE_SLUG_REGEX_SOURCE,
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
	COURSE_STEP_LEVELS,
	COURSE_TREE_MAX_DEPTH,
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
			message: `course slug must match ${COURSE_SLUG_REGEX_SOURCE}`,
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
 * Recursive child node of a section or lesson. A union over the two
 * non-section row kinds: `step` (leaf) and `lesson` (interior).
 *
 * Discriminator: `level` (default `'step'` when omitted in YAML, so
 * pre-WP 2-level content parses unchanged). The recursion bottoms out
 * when a node carries `level: 'step'` (no further `steps[]`).
 */
export interface CourseStep {
	readonly code: string;
	readonly ordinal: number;
	readonly level?: typeof COURSE_STEP_LEVELS.STEP;
	readonly title: string;
	readonly body_md?: string;
	readonly knowledge_node_id?: string;
}

export interface CourseLesson {
	readonly code: string;
	readonly ordinal: number;
	readonly level: typeof COURSE_STEP_LEVELS.LESSON;
	readonly title: string;
	readonly body_md?: string;
	readonly steps: ReadonlyArray<CourseTreeNode>;
}

export type CourseTreeNode = CourseStep | CourseLesson;

/**
 * One leaf entry inside a section or lesson.
 *
 * `knowledge_node_id` is typed as optional here so a step that omits the
 * field reaches the seed handler's friendlier rejection
 * (`step '<course>.<code>' must carry knowledge_node_id`) instead of
 * Zod's generic `steps.N.knowledge_node_id: Required` message. The seed
 * handler in `scripts/db/seed-courses.ts` enforces the requirement and
 * also FK-checks the node id before any DB write.
 *
 * `level` is optional with literal `'step'` so omitting the field in
 * YAML (the common 2-level shape) parses cleanly and explicit
 * `level: step` (the 3-level explicit form) also parses cleanly.
 *
 * `body_md` defaults to `''` to match the DB column default.
 */
export const courseStepSchema: z.ZodType<CourseStep> = z
	.object({
		code: z.string().min(1),
		ordinal: z.number().int().nonnegative(),
		level: z.literal(COURSE_STEP_LEVELS.STEP).optional(),
		title: z.string().min(1),
		body_md: z.string().optional().default(''),
		knowledge_node_id: z.string().min(1).optional(),
	})
	.strict();

/**
 * One interior-node entry inside a section or another lesson.
 *
 * Carries its own `steps[]` array of nested tree nodes; `.min(1)` rejects
 * a lesson with zero children at the YAML layer (an unrenderable shape;
 * the seed validator also re-asserts this).
 *
 * A lesson never carries a `knowledge_node_id`: the schema does not
 * declare the field, and `.strict()` makes attempting one a Zod error.
 * The seed validator additionally rejects the row-level shape so the
 * authoring error message is friendlier than Zod's "Unrecognized key."
 */
export const courseLessonSchema: z.ZodType<CourseLesson> = z
	.object({
		code: z.string().min(1),
		ordinal: z.number().int().nonnegative(),
		level: z.literal(COURSE_STEP_LEVELS.LESSON),
		title: z.string().min(1),
		body_md: z.string().optional().default(''),
		steps: z.lazy(() => z.array(courseTreeNodeSchema).min(1)),
	})
	.strict();

/**
 * Recursive child-node union. `z.lazy()` defers schema evaluation so
 * `courseLessonSchema.steps` can reference this schema before it's
 * fully constructed. `z.union([...])` (rather than
 * `z.discriminatedUnion`) is used because the discriminator `level` is
 * optional on the step arm (defaults to `'step'` when omitted in YAML);
 * Zod's discriminated-union helper requires every arm to carry the
 * discriminator literal.
 */
export const courseTreeNodeSchema: z.ZodType<CourseTreeNode> = z.lazy(() =>
	z.union([courseLessonSchema, courseStepSchema]),
);

/**
 * Top-level shape of a section YAML file under
 * `course/courses/<slug>/sections/<file>.yaml`.
 *
 * Holds the section metadata + the inline list of child tree nodes
 * (steps and/or lessons). Sections never carry a `knowledge_node_id`;
 * the field is declared here as optional so a malformed section that
 * smuggles the key reaches the seed handler's friendlier rejection
 * (`section '<course>.<code>' must not carry knowledge_node_id`) instead
 * of Zod's generic `Unrecognized key(s) in object: 'knowledge_node_id'`
 * message.
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
		steps: z.array(courseTreeNodeSchema).default([]),
	})
	.strict();

export type CourseSection = z.infer<typeof courseSectionSchema>;

/**
 * Walk a parsed section's tree to compute its maximum depth (root section
 * = depth 1; a step directly under the section = depth 2; a step under a
 * lesson under the section = depth 3; and so on).
 *
 * The seed validator calls this to reject pathological authoring that
 * exceeds {@link COURSE_TREE_MAX_DEPTH}; exported here so the schema
 * layer's invariants stay near the schema definitions (and so unit tests
 * can exercise the cap without standing up the full seed pipeline).
 */
export function courseSectionMaxDepth(section: CourseSection): number {
	function walk(node: CourseTreeNode, depthSoFar: number): number {
		if (node.level === COURSE_STEP_LEVELS.LESSON) {
			let deepest = depthSoFar;
			for (const child of node.steps) {
				const d = walk(child, depthSoFar + 1);
				if (d > deepest) deepest = d;
			}
			return deepest;
		}
		// Step (leaf, level omitted or 'step') -- depthSoFar already counts it.
		return depthSoFar;
	}
	let deepest = 1; // The section itself.
	for (const child of section.steps) {
		const d = walk(child, 2);
		if (d > deepest) deepest = d;
	}
	return deepest;
}

/** Re-exported so callers don't have to round-trip through `@ab/constants`. */
export { COURSE_TREE_MAX_DEPTH };
