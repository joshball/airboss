/**
 * Course YAML schema tests (course-tree-arbitrary-depth WP Phase A).
 *
 * Covers test-plan.md T2.x: the recursive YAML schema accepts the 2-level
 * regression shape, the 3-level shape, and 4-level nested-lesson shape;
 * rejects illegal shapes at every depth (lesson with no children, unknown
 * keys, depth > COURSE_TREE_MAX_DEPTH).
 *
 * Pure Zod; no DB. The DB-CHECK invariants are exercised by the
 * companion `__tests__/course-step-check.test.ts` suite.
 */

import { COURSE_STEP_LEVELS, COURSE_TREE_MAX_DEPTH } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { courseSectionMaxDepth, courseSectionSchema } from './course-yaml-schemas';

// Two existing real knowledge-node ids; used so the fixture shape matches
// what the seed pipeline will validate end-to-end. The schema layer
// doesn't FK-check these.
const NODE_A = 'wx-chart-type-surface-analysis';
const NODE_B = 'wx-airmasses-and-fronts';

describe('courseSectionSchema -- 2-level regression', () => {
	it('accepts a section with flat leaf steps (no level field on steps)', () => {
		const parsed = courseSectionSchema.parse({
			code: 's1',
			ordinal: 1,
			title: 'Flat section',
			body_md: 'intro',
			steps: [
				{ code: 's1.1', ordinal: 1, title: 'First', knowledge_node_id: NODE_A },
				{ code: 's1.2', ordinal: 2, title: 'Second', knowledge_node_id: NODE_B },
			],
		});
		expect(parsed.code).toBe('s1');
		expect(parsed.steps).toHaveLength(2);
		// Default-empty body_md fills in (Zod default).
		expect(parsed.steps[0].body_md).toBe('');
		// Implicit step level: undefined on the parsed shape (the seed
		// validator treats absence as level='step').
		expect(parsed.steps[0].level).toBeUndefined();
	});

	it('accepts a section with explicit level: step on a leaf', () => {
		const parsed = courseSectionSchema.parse({
			code: 's1',
			ordinal: 1,
			title: 'Flat section',
			steps: [
				{
					code: 's1.1',
					ordinal: 1,
					level: COURSE_STEP_LEVELS.STEP,
					title: 'Explicit-step',
					knowledge_node_id: NODE_A,
				},
			],
		});
		expect(parsed.steps[0].level).toBe(COURSE_STEP_LEVELS.STEP);
	});
});

describe('courseSectionSchema -- 3-level shape', () => {
	const threeLevelFixture = {
		code: 's1',
		ordinal: 1,
		title: 'Three-level',
		body_md: 'section intro',
		steps: [
			{
				code: 's1.1',
				ordinal: 1,
				level: COURSE_STEP_LEVELS.LESSON,
				title: 'Scenario lesson',
				body_md: 'lesson intro',
				steps: [
					{ code: 's1.1.1', ordinal: 1, title: 'Reading', knowledge_node_id: NODE_A },
					{ code: 's1.1.2', ordinal: 2, title: 'Pattern', knowledge_node_id: NODE_B },
				],
			},
		],
	};

	it('parses cleanly', () => {
		const parsed = courseSectionSchema.parse(threeLevelFixture);
		expect(parsed.steps).toHaveLength(1);
		const lesson = parsed.steps[0];
		// Narrow the discriminated union via the `level` field.
		if (lesson.level !== COURSE_STEP_LEVELS.LESSON) {
			throw new Error('expected level=lesson at parsed.steps[0]');
		}
		expect(lesson.steps).toHaveLength(2);
		expect(lesson.steps[0].code).toBe('s1.1.1');
	});

	it('preserves leaf knowledge_node_id at depth 3', () => {
		const parsed = courseSectionSchema.parse(threeLevelFixture);
		const lesson = parsed.steps[0];
		if (lesson.level !== COURSE_STEP_LEVELS.LESSON) {
			throw new Error('expected level=lesson at parsed.steps[0]');
		}
		expect(lesson.steps[0].knowledge_node_id).toBe(NODE_A);
		expect(lesson.steps[1].knowledge_node_id).toBe(NODE_B);
	});

	it('reports depth = 3', () => {
		const parsed = courseSectionSchema.parse(threeLevelFixture);
		expect(courseSectionMaxDepth(parsed)).toBe(3);
	});
});

describe('courseSectionSchema -- 4-level shape (lesson under lesson)', () => {
	const fourLevelFixture = {
		code: 's1',
		ordinal: 1,
		title: 'Four-level',
		steps: [
			{
				code: 's1.1',
				ordinal: 1,
				level: COURSE_STEP_LEVELS.LESSON,
				title: 'Outer lesson',
				steps: [
					{
						code: 's1.1.1',
						ordinal: 1,
						level: COURSE_STEP_LEVELS.LESSON,
						title: 'Inner lesson',
						steps: [{ code: 's1.1.1.1', ordinal: 1, title: 'Deep leaf', knowledge_node_id: NODE_A }],
					},
				],
			},
		],
	};

	it('parses cleanly', () => {
		const parsed = courseSectionSchema.parse(fourLevelFixture);
		expect(courseSectionMaxDepth(parsed)).toBe(4);
	});
});

describe('courseSectionSchema -- rejections', () => {
	it('rejects a lesson with zero children (.min(1) on lesson.steps)', () => {
		expect(() =>
			courseSectionSchema.parse({
				code: 's1',
				ordinal: 1,
				title: 'Empty lesson section',
				steps: [
					{
						code: 's1.1',
						ordinal: 1,
						level: COURSE_STEP_LEVELS.LESSON,
						title: 'Empty lesson',
						steps: [],
					},
				],
			}),
		).toThrow();
	});

	it('rejects a step that carries child steps[] (strict)', () => {
		expect(() =>
			courseSectionSchema.parse({
				code: 's1',
				ordinal: 1,
				title: 'Step with kids section',
				steps: [
					{
						code: 's1.1',
						ordinal: 1,
						level: COURSE_STEP_LEVELS.STEP,
						title: 'Step with children (illegal)',
						knowledge_node_id: NODE_A,
						steps: [{ code: 's1.1.1', ordinal: 1, title: 'Should not be here', knowledge_node_id: NODE_B }],
					},
				],
			}),
		).toThrow();
	});

	it('rejects an unknown key on the section itself', () => {
		expect(() =>
			courseSectionSchema.parse({
				code: 's1',
				ordinal: 1,
				title: 'Section',
				extra_field: 'nope',
				steps: [{ code: 's1.1', ordinal: 1, title: 'Leaf', knowledge_node_id: NODE_A }],
			}),
		).toThrow();
	});

	it('rejects an unknown key inside a lesson', () => {
		expect(() =>
			courseSectionSchema.parse({
				code: 's1',
				ordinal: 1,
				title: 'Section',
				steps: [
					{
						code: 's1.1',
						ordinal: 1,
						level: COURSE_STEP_LEVELS.LESSON,
						title: 'Lesson',
						oops: 1,
						steps: [{ code: 's1.1.1', ordinal: 1, title: 'Leaf', knowledge_node_id: NODE_A }],
					},
				],
			}),
		).toThrow();
	});

	it('rejects an unknown key inside a deeply nested leaf', () => {
		expect(() =>
			courseSectionSchema.parse({
				code: 's1',
				ordinal: 1,
				title: 'Section',
				steps: [
					{
						code: 's1.1',
						ordinal: 1,
						level: COURSE_STEP_LEVELS.LESSON,
						title: 'Lesson',
						steps: [
							{
								code: 's1.1.1',
								ordinal: 1,
								title: 'Leaf',
								knowledge_node_id: NODE_A,
								unexpected_field: true,
							},
						],
					},
				],
			}),
		).toThrow();
	});

	it('rejects level=module (not in the union)', () => {
		expect(() =>
			courseSectionSchema.parse({
				code: 's1',
				ordinal: 1,
				title: 'Section',
				steps: [{ code: 's1.1', ordinal: 1, level: 'module', title: 'Unknown level', knowledge_node_id: NODE_A }],
			}),
		).toThrow();
	});
});

describe('courseSectionMaxDepth -- depth cap helper', () => {
	it('reports depth 2 for a flat section', () => {
		const parsed = courseSectionSchema.parse({
			code: 's1',
			ordinal: 1,
			title: 'Flat',
			steps: [{ code: 's1.1', ordinal: 1, title: 'Leaf', knowledge_node_id: NODE_A }],
		});
		expect(courseSectionMaxDepth(parsed)).toBe(2);
	});

	it('reports depth 1 for a section with no children (degenerate)', () => {
		const parsed = courseSectionSchema.parse({
			code: 's-empty',
			ordinal: 1,
			title: 'No kids',
			steps: [],
		});
		expect(courseSectionMaxDepth(parsed)).toBe(1);
	});

	it('agrees with COURSE_TREE_MAX_DEPTH boundary on a max-depth fixture', () => {
		// Build a recursive lesson-chain exactly COURSE_TREE_MAX_DEPTH deep.
		// Section is depth 1; each nested lesson adds 1; the terminal step
		// adds 1. We want max depth == COURSE_TREE_MAX_DEPTH, so we need
		// (cap - 2) lesson levels plus one terminal step under the
		// innermost lesson, all under one outer section.
		const innermostLeaf = {
			code: `s1${'.1'.repeat(COURSE_TREE_MAX_DEPTH - 1)}`,
			ordinal: 1,
			title: 'leaf',
			knowledge_node_id: NODE_A,
		};
		// Build from the inside out.
		// The terminal step sits at depth COURSE_TREE_MAX_DEPTH.
		type AnyNode = Record<string, unknown>;
		let current: AnyNode = innermostLeaf;
		for (let d = COURSE_TREE_MAX_DEPTH - 1; d >= 2; d--) {
			current = {
				code: `s1${'.1'.repeat(d - 1)}`,
				ordinal: 1,
				level: COURSE_STEP_LEVELS.LESSON,
				title: `lesson-${d}`,
				steps: [current],
			};
		}
		const parsed = courseSectionSchema.parse({
			code: 's1',
			ordinal: 1,
			title: 'Boundary',
			steps: [current],
		});
		expect(courseSectionMaxDepth(parsed)).toBe(COURSE_TREE_MAX_DEPTH);
	});

	it('detects depth > COURSE_TREE_MAX_DEPTH (seed validator will reject)', () => {
		// One level deeper than the cap. The YAML schema itself parses --
		// it has no depth knowledge; the seed validator owns the depth
		// rejection. This test pins the helper that the validator calls.
		type AnyNode = Record<string, unknown>;
		let current: AnyNode = {
			code: `s1${'.1'.repeat(COURSE_TREE_MAX_DEPTH)}`,
			ordinal: 1,
			title: 'over-deep leaf',
			knowledge_node_id: NODE_A,
		};
		for (let d = COURSE_TREE_MAX_DEPTH; d >= 2; d--) {
			current = {
				code: `s1${'.1'.repeat(d - 1)}`,
				ordinal: 1,
				level: COURSE_STEP_LEVELS.LESSON,
				title: `lesson-${d}`,
				steps: [current],
			};
		}
		const parsed = courseSectionSchema.parse({
			code: 's1',
			ordinal: 1,
			title: 'Over-deep',
			steps: [current],
		});
		expect(courseSectionMaxDepth(parsed)).toBeGreaterThan(COURSE_TREE_MAX_DEPTH);
	});
});

describe('courseSectionSchema -- shipped fixture round-trip', () => {
	it('accepts the 3-level fixture YAML shape verbatim', () => {
		// Mirrors course/courses/_fixtures/3-level-tree/sections/s1-frontal-scenarios.yaml.
		// Kept in-source so the test doesn't require disk IO and works in
		// the unit-node vitest project.
		const parsed = courseSectionSchema.parse({
			code: 's1',
			ordinal: 1,
			title: 'Frontal Scenarios (fixture)',
			body_md: 'fixture section',
			steps: [
				{
					code: 's1.1',
					ordinal: 1,
					level: COURSE_STEP_LEVELS.LESSON,
					title: 'Scenario 1 - Cold-front passage',
					body_md: 'lesson body',
					steps: [
						{
							code: 's1.1.1',
							ordinal: 1,
							title: 'Reading the surface analysis',
							knowledge_node_id: NODE_A,
						},
						{
							code: 's1.1.2',
							ordinal: 2,
							title: 'Recognising airmass character',
							knowledge_node_id: NODE_B,
						},
					],
				},
			],
		});
		expect(courseSectionMaxDepth(parsed)).toBe(3);
	});
});
