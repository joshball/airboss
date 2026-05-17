/**
 * Unit tests for the recursive course-tree validator in
 * `libs/bc/study/src/seed-courses-validator.ts`. Phase B
 * (course-tree-arbitrary-depth WP) replaced the 2-level partition with a
 * depth-first walk; these cases cover every rejection introduced by the
 * generalisation plus the pre-existing rejections that still fire from the
 * new walker.
 *
 * The validator is pure: no DB, no filesystem reads, no async. We synthesise
 * `CourseManifest` + `ParsedSection[]` literals and call `validateCourseTree`
 * directly. The `validateKnowledgeNodeRefs` pass is covered by the seed
 * pipeline's end-to-end re-seed against `weather-comprehensive` and the
 * 3-level fixture; those land in the seed-smoke playwright suite.
 */

import { CourseSeedError, type CourseManifest, type CourseSection, type CourseTreeNode, type ParsedSection, validateCourseTree } from '@ab/bc-study';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Synthetic-tree builders -- keep tests readable
// ---------------------------------------------------------------------------

function manifest(slug = 'test-course'): CourseManifest {
	return {
		slug,
		kind: 'instructor',
		title: 'Test Course',
		status: 'active',
		description: '',
	};
}

function section(opts: {
	code: string;
	ordinal: number;
	title?: string;
	bodyMd?: string;
	steps?: ReadonlyArray<CourseTreeNode>;
}): ParsedSection {
	const s: CourseSection = {
		code: opts.code,
		ordinal: opts.ordinal,
		title: opts.title ?? `Section ${opts.code}`,
		body_md: opts.bodyMd ?? '',
		steps: opts.steps ?? [],
	};
	return { filename: `${opts.code}.yaml`, section: s };
}

function leaf(opts: { code: string; ordinal: number; title?: string; knowledgeNodeId?: string }): CourseTreeNode {
	return {
		code: opts.code,
		ordinal: opts.ordinal,
		title: opts.title ?? `Step ${opts.code}`,
		body_md: '',
		knowledge_node_id: opts.knowledgeNodeId ?? `kn-${opts.code}`,
	};
}

function lesson(opts: {
	code: string;
	ordinal: number;
	title?: string;
	steps: ReadonlyArray<CourseTreeNode>;
}): CourseTreeNode {
	return {
		code: opts.code,
		ordinal: opts.ordinal,
		level: 'lesson',
		title: opts.title ?? `Lesson ${opts.code}`,
		body_md: '',
		steps: opts.steps,
	};
}

// ---------------------------------------------------------------------------
// Acceptance cases
// ---------------------------------------------------------------------------

describe('validateCourseTree -- acceptance', () => {
	it('accepts a 2-level course (regression for pre-WP shape)', () => {
		const sections = [
			section({
				code: 's1',
				ordinal: 1,
				steps: [leaf({ code: 's1.1', ordinal: 1 }), leaf({ code: 's1.2', ordinal: 2 })],
			}),
		];
		expect(() => validateCourseTree(manifest(), sections)).not.toThrow();
	});

	it('accepts a 3-level course (section -> lesson -> step)', () => {
		const sections = [
			section({
				code: 's1',
				ordinal: 1,
				steps: [
					lesson({
						code: 's1.1',
						ordinal: 1,
						steps: [leaf({ code: 's1.1.1', ordinal: 1 }), leaf({ code: 's1.1.2', ordinal: 2 })],
					}),
				],
			}),
		];
		expect(() => validateCourseTree(manifest(), sections)).not.toThrow();
	});

	it('accepts mixed shapes (section with direct steps AND lesson children)', () => {
		const sections = [
			section({
				code: 's1',
				ordinal: 1,
				steps: [
					leaf({ code: 's1.1', ordinal: 1 }),
					lesson({
						code: 's1.2',
						ordinal: 2,
						steps: [leaf({ code: 's1.2.1', ordinal: 1 })],
					}),
				],
			}),
		];
		expect(() => validateCourseTree(manifest(), sections)).not.toThrow();
	});

	it('accepts a 4-level course (section -> lesson -> lesson -> step)', () => {
		const sections = [
			section({
				code: 's1',
				ordinal: 1,
				steps: [
					lesson({
						code: 's1.1',
						ordinal: 1,
						steps: [
							lesson({
								code: 's1.1.1',
								ordinal: 1,
								steps: [leaf({ code: 's1.1.1.1', ordinal: 1 })],
							}),
						],
					}),
				],
			}),
		];
		expect(() => validateCourseTree(manifest(), sections)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Rejection cases -- every new Phase B rejection, plus regressions
// ---------------------------------------------------------------------------

describe('validateCourseTree -- rejections', () => {
	it('rejects a lesson that smuggles knowledge_node_id', () => {
		const bad = {
			code: 's1.1',
			ordinal: 1,
			level: 'lesson',
			title: 'Bad lesson',
			body_md: '',
			knowledge_node_id: 'kn-x',
			steps: [leaf({ code: 's1.1.1', ordinal: 1 })],
		} as unknown as CourseTreeNode;
		const sections = [section({ code: 's1', ordinal: 1, steps: [bad] })];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(CourseSeedError);
		expect(() => validateCourseTree(manifest(), sections)).toThrow(
			"lesson 'test-course.s1.1' must not carry knowledge_node_id",
		);
	});

	it('rejects a step missing knowledge_node_id', () => {
		const bad = {
			code: 's1.1',
			ordinal: 1,
			title: 'Bad step',
			body_md: '',
		} as unknown as CourseTreeNode;
		const sections = [section({ code: 's1', ordinal: 1, steps: [bad] })];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(
			"step 'test-course.s1.1' must carry knowledge_node_id",
		);
	});

	it('rejects an empty lesson (steps.length === 0)', () => {
		const bad: CourseTreeNode = {
			code: 's1.1',
			ordinal: 1,
			level: 'lesson',
			title: 'Empty lesson',
			body_md: '',
			steps: [],
		};
		const sections = [section({ code: 's1', ordinal: 1, steps: [bad] })];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(
			"lesson 'test-course.s1.1' must have at least one child",
		);
	});

	it('rejects a step that smuggles a steps[] array', () => {
		const bad = {
			code: 's1.1',
			ordinal: 1,
			title: 'Hybrid leaf',
			body_md: '',
			knowledge_node_id: 'kn-x',
			steps: [leaf({ code: 's1.1.1', ordinal: 1 })],
		} as unknown as CourseTreeNode;
		const sections = [section({ code: 's1', ordinal: 1, steps: [bad] })];
		expect(() => validateCourseTree(manifest(), sections)).toThrow("step 'test-course.s1.1' must not have child steps");
	});

	it('rejects a tree that exceeds COURSE_TREE_MAX_DEPTH (10)', () => {
		// Section is depth 1. Each lesson adds one to depth. We need a step
		// (leaf) sitting at depth 11 to trigger the cap. Build 10 nested
		// lessons containing a leaf at the bottom: section(1) -> lesson(2)
		// -> ... -> lesson(10) -> leaf(11).
		let inner: CourseTreeNode = leaf({ code: 's1.l9.l1', ordinal: 1 });
		for (let i = 9; i >= 1; i -= 1) {
			inner = lesson({ code: `s1.l${i}`, ordinal: 1, steps: [inner] });
		}
		// Wrap one more lesson so the deepest leaf sits at depth 11.
		inner = lesson({ code: 's1.l0', ordinal: 1, steps: [inner] });
		const sections = [section({ code: 's1', ordinal: 1, steps: [inner] })];
		expect(() => validateCourseTree(manifest(), sections)).toThrow("course 'test-course' exceeds max tree depth of 10");
	});

	it('accepts a tree exactly at COURSE_TREE_MAX_DEPTH (10) -- boundary regression', () => {
		// Build a 10-deep tree: section(1) -> lesson(2) -> ... -> lesson(9)
		// -> leaf(10).
		let inner: CourseTreeNode = leaf({ code: 's1.l8.l1', ordinal: 1 });
		for (let i = 8; i >= 1; i -= 1) {
			inner = lesson({ code: `s1.l${i}`, ordinal: 1, steps: [inner] });
		}
		const sections = [section({ code: 's1', ordinal: 1, steps: [inner] })];
		expect(() => validateCourseTree(manifest(), sections)).not.toThrow();
	});

	it('rejects an unknown node level (defensive against schema drift)', () => {
		const weirdNode = {
			code: 's1.x',
			ordinal: 1,
			level: 'unknown',
			title: 'Mystery node',
			body_md: '',
		} as unknown as CourseTreeNode;
		const sections = [section({ code: 's1', ordinal: 1, steps: [weirdNode] })];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(/unknown node level under 'test-course.s1'/);
	});

	it('rejects a cycle via the visited-set walk (defensive)', () => {
		// YAML literals cannot express a cycle (the parser produces a tree).
		// To exercise the cycle check we hand-build a node whose nested
		// `steps` array re-references its own ancestor code by name. The
		// walker tracks code identity via the `visited` set; two nodes
		// sharing the same code along the active descent path trip the
		// cycle rejection.
		const child: CourseTreeNode = lesson({
			code: 's1.1',
			ordinal: 1,
			steps: [leaf({ code: 's1.1.1', ordinal: 1 })],
		});
		const parent: CourseTreeNode = lesson({
			code: 's1.1', // same code as descendant -- visited.has fires
			ordinal: 1,
			steps: [child],
		});
		const sections = [section({ code: 's1', ordinal: 1, steps: [parent] })];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(/cycle in course 'test-course' tree/);
	});

	it('rejects duplicate code in course-wide unique set', () => {
		const sections = [
			section({
				code: 's1',
				ordinal: 1,
				steps: [leaf({ code: 's1.dup', ordinal: 1 }), leaf({ code: 's1.dup', ordinal: 2 })],
			}),
		];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(/duplicate code 's1.dup' in course 'test-course'/);
	});

	it("rejects duplicate ordinal in a section's direct children", () => {
		const sections = [
			section({
				code: 's1',
				ordinal: 1,
				steps: [leaf({ code: 's1.a', ordinal: 1 }), leaf({ code: 's1.b', ordinal: 1 })],
			}),
		];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(
			/duplicate ordinal in section 'test-course.s1' steps/,
		);
	});

	it("rejects duplicate ordinal in a lesson's direct children", () => {
		const sections = [
			section({
				code: 's1',
				ordinal: 1,
				steps: [
					lesson({
						code: 's1.1',
						ordinal: 1,
						steps: [leaf({ code: 's1.1.a', ordinal: 1 }), leaf({ code: 's1.1.b', ordinal: 1 })],
					}),
				],
			}),
		];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(
			/duplicate ordinal in lesson 'test-course.s1.1' children/,
		);
	});

	it('rejects duplicate section ordinals across the whole course', () => {
		const sections = [
			section({ code: 's1', ordinal: 1, steps: [leaf({ code: 's1.1', ordinal: 1 })] }),
			section({ code: 's2', ordinal: 1, steps: [leaf({ code: 's2.1', ordinal: 1 })] }),
		];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(
			/duplicate ordinal in course 'test-course' sections/,
		);
	});

	it('rejects a section that smuggles knowledge_node_id', () => {
		const s: CourseSection = {
			code: 's1',
			ordinal: 1,
			title: 'S1',
			body_md: '',
			knowledge_node_id: 'kn-x',
			steps: [leaf({ code: 's1.1', ordinal: 1 })],
		};
		const sections: ParsedSection[] = [{ filename: 's1.yaml', section: s }];
		expect(() => validateCourseTree(manifest(), sections)).toThrow(
			"section 'test-course.s1' must not carry knowledge_node_id",
		);
	});
});
