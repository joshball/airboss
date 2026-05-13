/**
 * Course-aware lens tests (course-tree-arbitrary-depth WP, Phase E).
 *
 * Pure-function tests for `aggregateCertCoverage` -- the cert-overlay
 * leaf-rollup helper that decorates every interior node with
 * `certCoverage: { covered, total, ratio }` after the overlay lens has
 * tagged each leaf with `sources.inCert`.
 *
 * Two scenarios run here:
 *
 *   1. The 3-level fixture shape (section -> lesson -> step) -- mirrors
 *      `course/courses/_fixtures/three-level-tree-fixture/`. Verifies the
 *      leaf rollup matches at every level (lesson, section, course root).
 *   2. The 2-level (weather-comprehensive-shaped) regression -- mirrors
 *      `course/courses/weather-comprehensive/`. Verifies the aggregation
 *      output for a course with no `lesson` rows is byte-identical to the
 *      trivial sum: leaves directly under sections roll up to the section,
 *      and every section rolls up to the course root.
 *
 * The helper is purely structural -- no DB read. Tests build `LensTreeNode`
 * fixtures directly so the contract stays decoupled from the lens's
 * Drizzle imports.
 */

import { describe, expect, it } from 'vitest';
import { aggregateCertCoverage } from './lens-tree-walk';
import type { LensLeaf, LensLeafMastery, LensTreeNode, MasteryRollup } from './lenses';

const SYLLABUS_ID = 'syl_test_ppl_acs';

function emptyRollup(): MasteryRollup {
	return {
		totalLeaves: 0,
		coveredLeaves: 0,
		masteredLeaves: 0,
		masteryFraction: 0,
		coverageFraction: 0,
		byEvidenceKind: {},
	};
}

function emptyMastery(): LensLeafMastery {
	return {
		mastered: false,
		covered: false,
		requiredKinds: [],
		byEvidenceKind: {},
		missingKinds: [],
	};
}

interface LeafSpec {
	id: string;
	inCert: boolean;
}

function leaf(spec: LeafSpec): LensLeaf {
	return {
		id: spec.id,
		knowledgeNodeId: `kn_${spec.id}`,
		title: `Leaf ${spec.id}`,
		requiredBloom: null,
		mastery: emptyMastery(),
		sources: { inCourse: true, inCert: spec.inCert, ...(spec.inCert ? { certCode: `PA.${spec.id}` } : {}) },
	};
}

/** Build a leaf whose `sources` is undefined -- the non-overlay lens path. */
function leafNoOverlay(id: string): LensLeaf {
	return {
		id,
		knowledgeNodeId: `kn_${id}`,
		title: `Leaf ${id}`,
		requiredBloom: null,
		mastery: emptyMastery(),
	};
}

describe('aggregateCertCoverage', () => {
	it('returns an empty tree unchanged when called with no nodes', () => {
		const result = aggregateCertCoverage([], SYLLABUS_ID);
		expect(result).toEqual([]);
	});

	describe('3-level fixture shape (section -> lesson -> step)', () => {
		// Mirrors course/courses/_fixtures/three-level-tree-fixture/.
		// One section -> one lesson -> two leaves. The first leaf is covered
		// by the cert; the second is not. Tree is built bottom-up so each
		// interior carries a non-empty rollup.
		const leaves = [leaf({ id: 's1.1.1', inCert: true }), leaf({ id: 's1.1.2', inCert: false })];

		const lessonNode: LensTreeNode = {
			id: 'cst_lesson',
			level: 'lesson',
			title: 'Scenario 1 -- Cold-front passage',
			rollup: emptyRollup(),
			children: [],
			leaves,
		};

		const sectionNode: LensTreeNode = {
			id: 'cst_section',
			level: 'section',
			title: 'Frontal Scenarios (fixture)',
			rollup: emptyRollup(),
			children: [lessonNode],
		};

		const courseRoot: LensTreeNode = {
			id: 'crs_fixture',
			level: 'course',
			title: 'Three-level fixture course',
			rollup: emptyRollup(),
			children: [sectionNode],
		};

		const [annotatedRoot] = aggregateCertCoverage([courseRoot], SYLLABUS_ID);

		it('decorates the lesson with 1 / 2 leaves covered', () => {
			expect(annotatedRoot).toBeDefined();
			const annotatedSection = annotatedRoot?.children[0];
			const annotatedLesson = annotatedSection?.children[0];
			expect(annotatedLesson?.certCoverage).toEqual({ covered: 1, total: 2, ratio: 0.5 });
		});

		it('decorates the section with the same 1 / 2 leaves (sum of its lesson)', () => {
			const annotatedSection = annotatedRoot?.children[0];
			expect(annotatedSection?.certCoverage).toEqual({ covered: 1, total: 2, ratio: 0.5 });
		});

		it('decorates the course root with the rolled-up 1 / 2', () => {
			expect(annotatedRoot?.certCoverage).toEqual({ covered: 1, total: 2, ratio: 0.5 });
		});

		it('preserves the input tree (returns a new structure)', () => {
			expect(courseRoot.certCoverage).toBeUndefined();
			expect(sectionNode.certCoverage).toBeUndefined();
			expect(lessonNode.certCoverage).toBeUndefined();
		});

		it('preserves leaves on annotated nodes without mutating them', () => {
			const annotatedSection = annotatedRoot?.children[0];
			const annotatedLesson = annotatedSection?.children[0];
			expect(annotatedLesson?.leaves).toEqual(leaves);
		});
	});

	describe('2-level (weather-comprehensive-shaped) regression', () => {
		// Mirrors course/courses/weather-comprehensive/: every section has
		// direct leaves and no lesson rows. The aggregation must produce the
		// same shape as before Phase E -- each section sums its leaves, the
		// course root sums every section. This is the byte-identical
		// regression baseline called out in the test plan.
		const sectionA: LensTreeNode = {
			id: 'cst_secA',
			level: 'section',
			title: 'Section A',
			rollup: emptyRollup(),
			children: [],
			leaves: [
				leaf({ id: 'a.1', inCert: true }),
				leaf({ id: 'a.2', inCert: true }),
				leaf({ id: 'a.3', inCert: false }),
			],
		};

		const sectionB: LensTreeNode = {
			id: 'cst_secB',
			level: 'section',
			title: 'Section B',
			rollup: emptyRollup(),
			children: [],
			leaves: [leaf({ id: 'b.1', inCert: true }), leaf({ id: 'b.2', inCert: false })],
		};

		const courseRoot: LensTreeNode = {
			id: 'crs_wx_comp',
			level: 'course',
			title: 'Weather Comprehensive',
			rollup: emptyRollup(),
			children: [sectionA, sectionB],
		};

		const [annotatedRoot] = aggregateCertCoverage([courseRoot], SYLLABUS_ID);

		it('decorates section A with 2 / 3', () => {
			const annotatedA = annotatedRoot?.children[0];
			expect(annotatedA?.certCoverage).toEqual({ covered: 2, total: 3, ratio: 2 / 3 });
		});

		it('decorates section B with 1 / 2', () => {
			const annotatedB = annotatedRoot?.children[1];
			expect(annotatedB?.certCoverage).toEqual({ covered: 1, total: 2, ratio: 0.5 });
		});

		it('decorates the course root with the rolled-up 3 / 5', () => {
			expect(annotatedRoot?.certCoverage).toEqual({ covered: 3, total: 5, ratio: 3 / 5 });
		});
	});

	describe('edge cases', () => {
		it('returns 0 / 0 for a tree with no leaves at all', () => {
			const empty: LensTreeNode = {
				id: 'cst_empty',
				level: 'section',
				title: 'Empty section',
				rollup: emptyRollup(),
				children: [],
			};
			const [annotated] = aggregateCertCoverage([empty], SYLLABUS_ID);
			expect(annotated?.certCoverage).toEqual({ covered: 0, total: 0, ratio: 0 });
		});

		it('ignores leaves with sources === undefined (non-overlay lens path)', () => {
			const section: LensTreeNode = {
				id: 'cst_noOverlay',
				level: 'section',
				title: 'No overlay section',
				rollup: emptyRollup(),
				children: [],
				leaves: [leafNoOverlay('x.1'), leafNoOverlay('x.2')],
			};
			const [annotated] = aggregateCertCoverage([section], SYLLABUS_ID);
			// Both leaves carry sources===undefined -- contribute nothing.
			expect(annotated?.certCoverage).toEqual({ covered: 0, total: 0, ratio: 0 });
		});

		it('mixes overlay-decorated and non-overlay leaves correctly', () => {
			const section: LensTreeNode = {
				id: 'cst_mixed',
				level: 'section',
				title: 'Mixed section',
				rollup: emptyRollup(),
				children: [],
				leaves: [leaf({ id: 'm.1', inCert: true }), leafNoOverlay('m.2'), leaf({ id: 'm.3', inCert: false })],
			};
			const [annotated] = aggregateCertCoverage([section], SYLLABUS_ID);
			// Only the two overlay-decorated leaves count. 1 covered / 2 total.
			expect(annotated?.certCoverage).toEqual({ covered: 1, total: 2, ratio: 0.5 });
		});

		it('handles deep nesting up to the recursion depth bound', () => {
			// Build a chain of 6 lessons each holding one leaf. Verifies the
			// rollup still works at depth well past 2 -- the schema cap is
			// COURSE_TREE_MAX_DEPTH = 10 and JS stack headroom is ample.
			let inner: LensTreeNode = {
				id: 'cst_deep_leaf_holder',
				level: 'lesson',
				title: 'Innermost lesson',
				rollup: emptyRollup(),
				children: [],
				leaves: [leaf({ id: 'd.6.1', inCert: true })],
			};
			for (let i = 5; i >= 1; i -= 1) {
				inner = {
					id: `cst_deep_${i}`,
					level: 'lesson',
					title: `Lesson depth ${i}`,
					rollup: emptyRollup(),
					children: [inner],
				};
			}
			const root: LensTreeNode = {
				id: 'crs_deep',
				level: 'course',
				title: 'Deep nesting course',
				rollup: emptyRollup(),
				children: [inner],
			};
			const [annotatedRoot] = aggregateCertCoverage([root], SYLLABUS_ID);
			expect(annotatedRoot?.certCoverage).toEqual({ covered: 1, total: 1, ratio: 1 });
		});
	});
});
