/**
 * Pure course-tree validator for the seed pipeline. Lives in a sibling
 * file (rather than inside `seed-courses.ts`) so the unit-test suite can
 * import the validator without dragging the server-only DB barrel
 * (`@ab/bc-study/server`) into the test runtime. Browser-safe -- pure
 * synchronous checks over the parsed YAML shape; no `node:*`, no DB.
 *
 * Every check here is synchronous and operates on the parsed YAML shape
 * alone -- no DB, no filesystem, no async. The `validateKnowledgeNodeRefs`
 * pass (FK-check against `knowledgeNode`) lives next to the DB code in
 * `seed-courses.ts`.
 *
 * Phase B of the course-tree-arbitrary-depth WP introduced the recursive
 * walker. The validator descends every section depth-first, recurses into
 * each lesson, and asserts the invariants in the spec's
 * "Seed validator rejections" table at every depth:
 *
 *   - level / leaf / node-id consistency (section: no node; lesson: no
 *     node + at least one child; step: node required, no children)
 *   - course-wide unique codes (`(course_id, code)`)
 *   - per-parent unique ordinals (`(course_id, parent_id, ordinal)`)
 *   - tree depth <= `COURSE_TREE_MAX_DEPTH`
 *   - no cycles (visited-set walk; defensive against future authoring
 *     shapes -- a YAML literal can't express a cycle)
 *   - every non-leaf has at least one reachable leaf descendant
 *
 * Every rejection message matches the spec verbatim so log-greps stay
 * stable across PRs.
 */

import { COURSE_STEP_LEVELS, COURSE_TREE_MAX_DEPTH } from '@ab/constants';
import type { CourseLesson, CourseManifest, CourseSection, CourseStep, CourseTreeNode } from './course-yaml-schemas';

export class CourseSeedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CourseSeedError';
	}
}

export interface ParsedSection {
	readonly filename: string;
	readonly section: CourseSection;
}

export function isLessonNode(node: CourseTreeNode): node is CourseLesson {
	return node.level === COURSE_STEP_LEVELS.LESSON;
}

export function isStepNode(node: CourseTreeNode): node is CourseStep {
	return node.level === undefined || node.level === COURSE_STEP_LEVELS.STEP;
}

/**
 * Walk a parsed section's subtree and return true iff at least one
 * descendant is a leaf step. Used by the post-walk reachability check
 * (a non-leaf with no leaves contributes zero learning units).
 */
export function hasLeafDescendant(node: CourseTreeNode): boolean {
	if (isStepNode(node)) return true;
	if (isLessonNode(node)) {
		for (const child of node.steps) {
			if (hasLeafDescendant(child)) return true;
		}
	}
	return false;
}

/**
 * Validate the full course tree before any DB writes. See the file header
 * for the full invariant list.
 */
export function validateCourseTree(manifest: CourseManifest, sections: readonly ParsedSection[]): void {
	const courseSlug = manifest.slug;

	// Duplicate section ordinals across the whole course.
	const sectionOrdinals = new Set<number>();
	for (const { section } of sections) {
		if (sectionOrdinals.has(section.ordinal)) {
			throw new CourseSeedError(`duplicate ordinal in course '${courseSlug}' sections`);
		}
		sectionOrdinals.add(section.ordinal);
	}

	// Course-wide unique-code set populated during the depth-first walk so
	// duplicates collide regardless of nesting depth.
	const codes = new Set<string>();

	for (const { section } of sections) {
		const sectionLabel = `${courseSlug}.${section.code}`;

		// Sections never carry `knowledge_node_id`. The Zod section schema
		// declares the field as optional so a section that smuggles the
		// key past the strict parse reaches the friendlier rejection here
		// instead of Zod's generic "Unrecognized key" wording.
		if (
			'knowledge_node_id' in section &&
			(section as unknown as Record<string, unknown>).knowledge_node_id !== undefined
		) {
			throw new CourseSeedError(`section '${sectionLabel}' must not carry knowledge_node_id`);
		}

		if (codes.has(section.code)) {
			throw new CourseSeedError(`duplicate code '${section.code}' in course '${courseSlug}'`);
		}
		codes.add(section.code);

		// Walk the section's children depth-first. `visited` (ancestor codes
		// up the active stack) doubles as the cycle-check substrate even
		// though YAML literals can't express a cycle -- if a future
		// authoring shape ever does, this trips a clean rejection instead
		// of recursing to stack overflow.
		const visited = new Set<string>([section.code]);
		walkChildren(courseSlug, 'section', sectionLabel, section.steps, codes, visited, /* depth */ 2);
	}
}

/**
 * Recursive descent helper. Walks one level of children, validating
 * per-node invariants and recursing into lessons. `depth` tracks the
 * row's distance from the course root (section = 1; a direct child of a
 * section = 2; a step under a lesson under a section = 3; ...); the
 * recursion rejects if the cap is exceeded.
 */
function walkChildren(
	courseSlug: string,
	parentKind: 'section' | 'lesson',
	parentLabel: string,
	children: ReadonlyArray<CourseTreeNode>,
	codes: Set<string>,
	visited: Set<string>,
	depth: number,
): void {
	if (depth > COURSE_TREE_MAX_DEPTH) {
		throw new CourseSeedError(`course '${courseSlug}' exceeds max tree depth of ${COURSE_TREE_MAX_DEPTH}`);
	}

	const childOrdinals = new Set<number>();
	for (const node of children) {
		// Cycle check first: `visited` is the set of ancestor codes up the
		// active descent path. A code that re-appears along the same path
		// is a true cycle (regardless of whether other branches duplicate
		// it). YAML literals can't express this, so the rejection is
		// defensive against future authoring shapes that allow back-edges.
		if (visited.has(node.code)) {
			throw new CourseSeedError(`cycle in course '${courseSlug}' tree`);
		}

		if (codes.has(node.code)) {
			throw new CourseSeedError(`duplicate code '${node.code}' in course '${courseSlug}'`);
		}
		codes.add(node.code);

		if (childOrdinals.has(node.ordinal)) {
			if (parentKind === 'section') {
				throw new CourseSeedError(`duplicate ordinal in section '${parentLabel}' steps`);
			}
			throw new CourseSeedError(`duplicate ordinal in lesson '${parentLabel}' children`);
		}
		childOrdinals.add(node.ordinal);

		if (isLessonNode(node)) {
			const lessonLabel = `${courseSlug}.${node.code}`;

			// Lessons never carry `knowledge_node_id`. The Zod lesson
			// schema does not declare the field, so a smuggled value
			// already fails Zod's "Unrecognized key" guard upstream -- the
			// rejection here covers the case where a future schema change
			// adds the field as optional (mirrors the section rule).
			if ('knowledge_node_id' in node && (node as unknown as Record<string, unknown>).knowledge_node_id !== undefined) {
				throw new CourseSeedError(`lesson '${lessonLabel}' must not carry knowledge_node_id`);
			}

			if (node.steps.length === 0) {
				throw new CourseSeedError(`lesson '${lessonLabel}' must have at least one child`);
			}

			visited.add(node.code);
			walkChildren(courseSlug, 'lesson', lessonLabel, node.steps, codes, visited, depth + 1);
			visited.delete(node.code);

			// Post-walk: every non-leaf must have at least one reachable
			// leaf descendant. `hasLeafDescendant` is cheap (it stops at
			// the first leaf it finds) and runs after the recursion so
			// any deeper rejections have already fired.
			if (!hasLeafDescendant(node)) {
				throw new CourseSeedError(`lesson '${lessonLabel}' must have at least one leaf descendant`);
			}
		} else if (isStepNode(node)) {
			const stepLabel = `${courseSlug}.${node.code}`;

			if (typeof node.knowledge_node_id !== 'string' || node.knowledge_node_id.length === 0) {
				throw new CourseSeedError(`step '${stepLabel}' must carry knowledge_node_id`);
			}

			// A leaf cannot also be an interior. Zod's `courseStepSchema`
			// has no `steps` field so a strict parse already rejects;
			// kept as a defensive grep-stable rejection.
			if ('steps' in node && Array.isArray((node as unknown as Record<string, unknown>).steps)) {
				throw new CourseSeedError(`step '${stepLabel}' must not have child steps`);
			}
		} else {
			throw new CourseSeedError(`course '${courseSlug}': unknown node level under '${parentLabel}'`);
		}
	}
}
