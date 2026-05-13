// @browser-globals: server-only -- never imported by client .svelte
/**
 * Canonical YAML emission for course manifest + section files
 * (course-reader-and-editor WP, Phase 6; course-tree-arbitrary-depth
 * WP, Phase D).
 *
 * Per design.md "Hangar editor: YAML emission via a small canonical-write
 * helper": every save action re-emits the entire YAML file in canonical
 * form. Keys land in stable order matching the existing fixtures
 * (`course/courses/_fixtures/seed-smoke/`) so diffs read clean against
 * authored content.
 *
 * Stable key order:
 *   - manifest.yaml: `slug`, `kind`, `title`, `status`, `description`
 *   - section.yaml:   `code`, `ordinal`, `title`, `body_md`, `steps`
 *   - step (inline):  `code`, `ordinal`, [`level`], `title`, `body_md`,
 *                     `knowledge_node_id`
 *   - lesson (inline): `code`, `ordinal`, `level`, `title`, `body_md`,
 *                     `steps`
 *
 * Multi-line strings (description, body_md) emit as literal block scalars
 * (`|`) to preserve formatting + comments-in-prose. Empty strings collapse
 * to `''` so an absent description still round-trips cleanly.
 *
 * Lesson rows (course-tree-arbitrary-depth WP) round-trip unchanged: the
 * editor's UI is leaf-only (lessons render as a read-only banner per
 * +page.svelte), but the save path now routes lessons through the emitter
 * so an edit to a leaf inside a section with nested lessons does not
 * destroy the lesson structure. A future hangar phase ships the nested
 * editor; until then the YAML file is the unit of nested authoring.
 */

import type { CourseManifest, CourseSection, CourseTreeNode } from '@ab/bc-study';
import { COURSE_STEP_LEVELS } from '@ab/constants';
import { stringify } from 'yaml';

export interface ManifestEmitInput {
	slug: string;
	kind: CourseManifest['kind'];
	title: string;
	status: CourseManifest['status'];
	description: string;
}

/**
 * Emit a `manifest.yaml` for one course directory. Keys land in the stable
 * order; description uses literal block scalar when non-empty.
 */
export function emitManifest(input: ManifestEmitInput): string {
	// Stable key order via an ordered object literal (V8 preserves
	// insertion order for string keys; `yaml.stringify` walks the object's
	// own-key order).
	const ordered: Record<string, unknown> = {
		slug: input.slug,
		kind: input.kind,
		title: input.title,
		status: input.status,
		description: input.description,
	};
	return stringify(ordered, {
		lineWidth: 0, // disable line wrapping; preserve author intent
		blockQuote: 'literal', // multi-line strings -> `|`
	});
}

export interface SectionEmitInput {
	code: string;
	ordinal: number;
	title: string;
	body_md: string;
	/**
	 * Mixed list of step (leaf) and lesson (interior) entries. Each entry
	 * is serialised via {@link treeNodeToEmitObject} so lesson interiors
	 * round-trip with their nested children unchanged.
	 */
	steps: TreeNodeEmit[];
}

export interface StepEmitInput {
	code: string;
	ordinal: number;
	level?: typeof COURSE_STEP_LEVELS.STEP;
	title: string;
	body_md: string;
	knowledge_node_id: string;
}

export interface LessonEmitInput {
	code: string;
	ordinal: number;
	level: typeof COURSE_STEP_LEVELS.LESSON;
	title: string;
	body_md: string;
	steps: TreeNodeEmit[];
}

export type TreeNodeEmit = StepEmitInput | LessonEmitInput;

/**
 * Emit a section YAML file (under `sections/<file>.yaml`). Steps are
 * inline; each entry's keys land in the stable order. `body_md` fields
 * use literal block scalar. Lesson interiors recurse via
 * {@link treeNodeToEmitObject} so the full N-deep tree round-trips.
 */
export function emitSection(input: SectionEmitInput): string {
	const ordered: Record<string, unknown> = {
		code: input.code,
		ordinal: input.ordinal,
		title: input.title,
		body_md: input.body_md,
		steps: input.steps.map(treeNodeToEmitObject),
	};
	return stringify(ordered, {
		lineWidth: 0,
		blockQuote: 'literal',
	});
}

/**
 * Render one tree-node entry (step OR lesson) as a stable-key-order
 * plain object suitable for `yaml.stringify`. Lessons recurse over their
 * own `steps[]`; steps emit the leaf shape with `knowledge_node_id`. The
 * `level` key is omitted on steps (the default in YAML) to keep the
 * 2-level output byte-identical to pre-WP files.
 */
function treeNodeToEmitObject(node: TreeNodeEmit): Record<string, unknown> {
	if (node.level === COURSE_STEP_LEVELS.LESSON) {
		return {
			code: node.code,
			ordinal: node.ordinal,
			level: node.level,
			title: node.title,
			body_md: node.body_md,
			steps: node.steps.map(treeNodeToEmitObject),
		};
	}
	return {
		code: node.code,
		ordinal: node.ordinal,
		title: node.title,
		body_md: node.body_md,
		knowledge_node_id: node.knowledge_node_id,
	};
}

/**
 * Convert a parsed `CourseSection` (from the Zod schema) back to the
 * emit input shape. Recurses over lesson interiors so a section that
 * already contains nested lessons on disk round-trips through the
 * editor's save path without losing structure.
 *
 * Hangar's editor UI today authors at the leaf-step level only (lesson
 * authoring is in the OUT-OF-SCOPE.md "Hangar editor UI" follow-up).
 * Leaf-level edits route through the existing form actions; the
 * surrounding lesson interiors flow through this function unchanged.
 */
export function sectionToEmitInput(section: CourseSection): SectionEmitInput {
	return {
		code: section.code,
		ordinal: section.ordinal,
		title: section.title,
		body_md: section.body_md,
		steps: section.steps.map(treeNodeFromParsed),
	};
}

/**
 * Convert a parsed tree-node (step or lesson) into the emit shape.
 * Recurses on lesson children. Defensively coalesces optional fields to
 * the DB defaults (empty `body_md`, empty `knowledge_node_id` on steps;
 * the seed validator enforces required fields before any write).
 */
function treeNodeFromParsed(node: CourseTreeNode): TreeNodeEmit {
	if (node.level === COURSE_STEP_LEVELS.LESSON) {
		return {
			code: node.code,
			ordinal: node.ordinal,
			level: COURSE_STEP_LEVELS.LESSON,
			title: node.title,
			body_md: node.body_md ?? '',
			steps: node.steps.map(treeNodeFromParsed),
		};
	}
	return {
		code: node.code,
		ordinal: node.ordinal,
		title: node.title,
		body_md: node.body_md ?? '',
		knowledge_node_id: node.knowledge_node_id ?? '',
	};
}

/**
 * Convert a single step (from a form payload or in-memory edit) into the
 * emit-step shape. Leaves are the only kind the hangar UI authors today;
 * lessons round-trip via {@link treeNodeFromParsed} above.
 */
export function stepToEmitInput(step: {
	code: string;
	ordinal: number;
	title: string;
	body_md?: string;
	knowledge_node_id?: string;
}): StepEmitInput {
	return {
		code: step.code,
		ordinal: step.ordinal,
		title: step.title,
		body_md: step.body_md ?? '',
		knowledge_node_id: step.knowledge_node_id ?? '',
	};
}
