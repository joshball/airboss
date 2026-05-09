// Canonical YAML emission for course manifests + sections (course-reader-and-editor WP, Phase 6).
//
// Save flows in the hangar editor read the on-disk YAML, apply the form
// deltas, then re-emit the file. The emit helpers below force a stable
// key order (matching the existing `course/courses/_fixtures/seed-smoke/`
// fixtures) and a literal block-scalar style for the multi-line
// `body_md` / `description` fields so diffs against authored fixtures
// stay clean.
//
// Comment preservation is deferred -- the existing fixtures don't carry
// authored comments and the design doc picks `stringify` over the
// heavier `parseDocument` path until that need shows up.

import type { CourseManifest, CourseSection, CourseStep } from '@ab/bc-study';
import { stringify } from 'yaml';

/**
 * Stable manifest field ordering. Matches the seed-smoke fixture
 * (`slug, kind, title, status, description`) so a save against an
 * unchanged manifest emits the same bytes the fixture ships.
 */
function orderedManifest(manifest: CourseManifest): Record<string, unknown> {
	return {
		slug: manifest.slug,
		kind: manifest.kind,
		title: manifest.title,
		status: manifest.status,
		description: manifest.description,
	};
}

/**
 * Stable step field ordering. Matches the seed-smoke fixture
 * (`code, ordinal, title, body_md, knowledge_node_id`).
 */
function orderedStep(step: CourseStep): Record<string, unknown> {
	const out: Record<string, unknown> = {
		code: step.code,
		ordinal: step.ordinal,
		title: step.title,
		body_md: step.body_md,
	};
	if (typeof step.knowledge_node_id === 'string' && step.knowledge_node_id.length > 0) {
		out.knowledge_node_id = step.knowledge_node_id;
	}
	return out;
}

/**
 * Stable section field ordering. Matches the seed-smoke fixture
 * (`code, ordinal, title, body_md, steps`).
 */
function orderedSection(section: CourseSection): Record<string, unknown> {
	return {
		code: section.code,
		ordinal: section.ordinal,
		title: section.title,
		body_md: section.body_md,
		steps: section.steps.map(orderedStep),
	};
}

const STRINGIFY_OPTS = {
	// Preserve newlines + indentation in body_md / description without
	// quoted-scalar escapes. `lineWidth: 0` disables soft-wrap for long
	// authored prose.
	lineWidth: 0,
	// Multi-line strings emit as block-literal `|` (matches the seed-smoke
	// fixture's `body_md: |` / `description: |` style); single-line
	// strings stay PLAIN. Without this, the lib quotes single-line
	// strings when they contain colons or other indicator chars.
	blockQuote: 'literal',
} as const;

/**
 * Emit a course manifest as canonical YAML. The output is byte-stable
 * across re-emits of the same input (round-trip safe through `parse`).
 */
export function emitManifest(manifest: CourseManifest): string {
	return stringify(orderedManifest(manifest), STRINGIFY_OPTS);
}

/**
 * Emit a course section (with its inline steps) as canonical YAML.
 */
export function emitSection(section: CourseSection): string {
	return stringify(orderedSection(section), STRINGIFY_OPTS);
}
