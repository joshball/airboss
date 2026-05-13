// @browser-globals: server-only -- never imported by client .svelte
/**
 * Canonical YAML emission for course manifest + section files
 * (course-reader-and-editor WP, Phase 6).
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
 *   - step (inline):  `code`, `ordinal`, `title`, `body_md`,
 *                     `knowledge_node_id`
 *
 * Multi-line strings (description, body_md) emit as literal block scalars
 * (`|`) to preserve formatting + comments-in-prose. Empty strings collapse
 * to `''` so an absent description still round-trips cleanly.
 *
 * Future: when authored YAML grows real comments, swap to
 * `yaml.parseDocument` + per-field setter pattern (option 3 in design.md).
 * Today the project doesn't have authored comments; option 1 (canonical
 * stringify) is the simplest correct emission.
 */

import { COURSE_STEP_LEVELS } from '@ab/constants';
import type { CourseManifest, CourseSection, CourseStep, CourseTreeNode } from '@ab/bc-study';
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
	steps: StepEmitInput[];
}

export interface StepEmitInput {
	code: string;
	ordinal: number;
	title: string;
	body_md: string;
	knowledge_node_id: string;
}

/**
 * Emit a section YAML file (under `sections/<file>.yaml`). Steps are
 * inline; each step's keys land in the stable order. `body_md` fields use
 * literal block scalar.
 */
export function emitSection(input: SectionEmitInput): string {
	const ordered: Record<string, unknown> = {
		code: input.code,
		ordinal: input.ordinal,
		title: input.title,
		body_md: input.body_md,
		steps: input.steps.map((step) => ({
			code: step.code,
			ordinal: step.ordinal,
			title: step.title,
			body_md: step.body_md,
			knowledge_node_id: step.knowledge_node_id,
		})),
	};
	return stringify(ordered, {
		lineWidth: 0,
		blockQuote: 'literal',
	});
}

/**
 * Convert a parsed `CourseSection` (from the Zod schema) back to the
 * emit input shape. Useful when an editor save reads the existing file,
 * applies a delta, and re-emits.
 *
 * Hangar's editor today only authors 2-level (section -> step) content.
 * The course YAML schema accepts arbitrary depth (lessons between section
 * and step) as of the course-tree-arbitrary-depth WP; nested-lesson
 * authoring through this editor lands in a follow-up phase. If a section
 * file already contains a lesson (read off disk), the editor refuses to
 * re-emit until lesson-aware emission ships -- throwing here is the
 * loudest place to surface that boundary.
 */
export function sectionToEmitInput(section: CourseSection): SectionEmitInput {
	const stepNodes: CourseStep[] = [];
	for (const node of section.steps) {
		if (node.level === COURSE_STEP_LEVELS.LESSON) {
			throw new Error(
				`Hangar YAML emit does not yet support lesson nodes (section '${section.code}', lesson '${node.code}'). Edit the YAML file directly until the editor's nested-lesson support lands.`,
			);
		}
		stepNodes.push(node);
	}
	return {
		code: section.code,
		ordinal: section.ordinal,
		title: section.title,
		body_md: section.body_md,
		steps: stepNodes.map(stepToEmitInput),
	};
}

export function stepToEmitInput(step: CourseStep | CourseTreeNode): StepEmitInput {
	if (step.level === COURSE_STEP_LEVELS.LESSON) {
		throw new Error(
			`Hangar YAML emit does not yet support lesson nodes (lesson '${step.code}'). Edit the YAML file directly until the editor's nested-lesson support lands.`,
		);
	}
	return {
		code: step.code,
		ordinal: step.ordinal,
		title: step.title,
		// Zod normalises `body_md` to `''` on optional input; the type widening
		// to CourseTreeNode brings the optional back, so coalesce to '' here.
		body_md: step.body_md ?? '',
		// The Zod schema types `knowledge_node_id` as optional, but the seed
		// validator rejects steps without it. Save actions must enforce that
		// before calling here; we cast away the optionality once the field is
		// confirmed present.
		knowledge_node_id: step.knowledge_node_id ?? '',
	};
}
