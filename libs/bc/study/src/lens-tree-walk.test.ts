/**
 * Unit coverage for `lens-tree-walk` -- pure helpers used by the course
 * step reader (course-tree-arbitrary-depth WP, Phase D).
 *
 * Two algorithms under test:
 *
 *  - `flattenLeavesDepthFirst`: depth-first document-order leaf list.
 *  - `computePrevNextLeaves`: prev / next leaf for both leaf and
 *    non-leaf current rows, with the first-leaf-descendant semantic on
 *    interior rows.
 */

import { describe, expect, it } from 'vitest';
import { computePrevNextLeaves, flattenLeavesDepthFirst, type PrevNextRow } from './lens-tree-walk';
import type { LensLeaf, LensTreeNode } from './lenses';

function leaf(id: string, title: string): LensLeaf {
	return {
		id,
		knowledgeNodeId: `kn-${id}`,
		title,
		requiredBloom: null,
		mastery: {
			mastered: false,
			covered: false,
			requiredKinds: [],
			byEvidenceKind: {},
			missingKinds: [],
		},
	};
}

function emptyRollup(): LensTreeNode['rollup'] {
	return {
		totalLeaves: 0,
		coveredLeaves: 0,
		masteredLeaves: 0,
		masteryFraction: 0,
		coverageFraction: 0,
		byEvidenceKind: {},
	};
}

describe('flattenLeavesDepthFirst', () => {
	it('returns leaves in document order (direct leaves before interior children)', () => {
		const l1 = leaf('a', 'leaf a');
		const l2 = leaf('b', 'leaf b');
		const l3 = leaf('c', 'leaf c');
		// Section S has a direct leaf `a` plus a lesson L1 with leaves b, c.
		const tree: LensTreeNode[] = [
			{
				id: 'S',
				level: 'section',
				title: 'S',
				rollup: emptyRollup(),
				children: [
					{
						id: 'L1',
						level: 'lesson',
						title: 'L1',
						rollup: emptyRollup(),
						children: [],
						leaves: [l2, l3],
					},
				],
				leaves: [l1],
			},
		];
		const flat = flattenLeavesDepthFirst(tree);
		expect(flat.map((leafRow) => leafRow.id)).toEqual(['a', 'b', 'c']);
	});

	it('handles a 2-level tree (no lesson interiors) trivially', () => {
		const l1 = leaf('a', 'a');
		const l2 = leaf('b', 'b');
		const tree: LensTreeNode[] = [
			{
				id: 'S',
				level: 'section',
				title: 'S',
				rollup: emptyRollup(),
				children: [],
				leaves: [l1, l2],
			},
		];
		expect(flattenLeavesDepthFirst(tree).map((row) => row.id)).toEqual(['a', 'b']);
	});

	it('returns empty for a tree with no leaves', () => {
		const tree: LensTreeNode[] = [{ id: 'S', level: 'section', title: 'S', rollup: emptyRollup(), children: [] }];
		expect(flattenLeavesDepthFirst(tree)).toEqual([]);
	});
});

describe('computePrevNextLeaves -- leaf current row', () => {
	const rows: PrevNextRow[] = [
		{ id: 'S', parentId: null },
		{ id: 'a', parentId: 'S' },
		{ id: 'b', parentId: 'S' },
		{ id: 'c', parentId: 'S' },
	];
	const leaves = [leaf('a', 'a'), leaf('b', 'b'), leaf('c', 'c')];

	it('returns the adjacent leaves for an interior leaf', () => {
		const result = computePrevNextLeaves('b', rows, leaves);
		expect(result.prev).toEqual({ id: 'a', title: 'a' });
		expect(result.next).toEqual({ id: 'c', title: 'c' });
	});

	it('suppresses prev at the first leaf', () => {
		const result = computePrevNextLeaves('a', rows, leaves);
		expect(result.prev).toBe(null);
		expect(result.next).toEqual({ id: 'b', title: 'b' });
	});

	it('suppresses next at the last leaf', () => {
		const result = computePrevNextLeaves('c', rows, leaves);
		expect(result.prev).toEqual({ id: 'b', title: 'b' });
		expect(result.next).toBe(null);
	});
});

describe('computePrevNextLeaves -- non-leaf current row', () => {
	// Two sections, each with a lesson. Lesson L1 has leaves a, b; lesson
	// L2 has leaf c. The flat leaf list is [a, b, c]. Sitting on the
	// lesson L2 landing should put "next" at c and "prev" at b (the leaf
	// preceding the first descendant).
	const rows: PrevNextRow[] = [
		{ id: 'S1', parentId: null },
		{ id: 'L1', parentId: 'S1' },
		{ id: 'a', parentId: 'L1' },
		{ id: 'b', parentId: 'L1' },
		{ id: 'S2', parentId: null },
		{ id: 'L2', parentId: 'S2' },
		{ id: 'c', parentId: 'L2' },
	];
	const leaves = [leaf('a', 'a'), leaf('b', 'b'), leaf('c', 'c')];

	it('next on a lesson landing enters the lesson first leaf', () => {
		const result = computePrevNextLeaves('L1', rows, leaves);
		expect(result.next).toEqual({ id: 'a', title: 'a' });
	});

	it('prev on a section landing points at the previous section last leaf', () => {
		const result = computePrevNextLeaves('S2', rows, leaves);
		// First descendant of S2 in document order is c. Prev is the leaf
		// before c -> b (last leaf of L1).
		expect(result.prev).toEqual({ id: 'b', title: 'b' });
		expect(result.next).toEqual({ id: 'c', title: 'c' });
	});

	it('prev on the first section landing is null', () => {
		const result = computePrevNextLeaves('S1', rows, leaves);
		expect(result.prev).toBe(null);
		expect(result.next).toEqual({ id: 'a', title: 'a' });
	});

	it('returns null pair when the subtree has no leaves', () => {
		const emptyRows: PrevNextRow[] = [
			{ id: 'S', parentId: null },
			{ id: 'L', parentId: 'S' },
		];
		const result = computePrevNextLeaves('L', emptyRows, []);
		expect(result.prev).toBe(null);
		expect(result.next).toBe(null);
	});
});

describe('computePrevNextLeaves -- edge cases', () => {
	it('returns null pair when leaves is empty', () => {
		const rows: PrevNextRow[] = [{ id: 'S', parentId: null }];
		const result = computePrevNextLeaves('S', rows, []);
		expect(result.prev).toBe(null);
		expect(result.next).toBe(null);
	});

	it('returns null pair when current id is unknown', () => {
		const rows: PrevNextRow[] = [
			{ id: 'S', parentId: null },
			{ id: 'a', parentId: 'S' },
		];
		const leaves = [leaf('a', 'a')];
		const result = computePrevNextLeaves('does-not-exist', rows, leaves);
		expect(result.prev).toBe(null);
		expect(result.next).toBe(null);
	});
});
