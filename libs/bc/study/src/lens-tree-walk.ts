/**
 * Pure tree-walk helpers over `LensTreeNode`. Browser-safe -- only depends on
 * types from `./lenses`, no DB connection, no Drizzle imports.
 *
 * Lives outside `./lenses-course.ts` because that file value-imports
 * `./courses`, which transitively pulls in `@ab/db/connection`. Surfacing
 * these helpers from the runtime barrel `@ab/bc-study` would otherwise drag
 * the postgres driver into every browser bundle that imports a lens type.
 *
 * Per docs/work-packages/course-tree-arbitrary-depth/design.md "Prev/next
 * traversal" -- the depth-first flatten is the canonical leaf-order
 * traversal used by:
 *
 *   - prev/next navigation on the step reader
 *   - cert-overlay aggregation (Phase D / E) that wants the leaf list
 *     without a second tree walk
 */

import type { CertCoverage, LensLeaf, LensTreeNode } from './lenses';

/**
 * Flatten a `LensTreeNode[]` into the document-order list of `LensLeaf` rows
 * reachable from anywhere in the tree. Visits each node's direct leaves
 * before recursing into its interior children, which matches the natural
 * authoring order: a section / lesson with `body_md` framing, then its leaf
 * steps, then deeper lesson groupings.
 *
 * Pure helper -- exported so renderer + load functions can call it without
 * re-implementing the traversal.
 */
export function flattenLeavesDepthFirst(tree: ReadonlyArray<LensTreeNode>): LensLeaf[] {
	const out: LensLeaf[] = [];
	function walk(node: LensTreeNode): void {
		if (node.leaves !== undefined) {
			for (const leaf of node.leaves) out.push(leaf);
		}
		for (const child of node.children) walk(child);
	}
	for (const node of tree) walk(node);
	return out;
}

/**
 * Minimal row shape for prev/next computation -- only the fields the
 * algorithm reads. Decoupled from `CourseStepRow` so the helper can run
 * in unit tests without a DB connection.
 */
export interface PrevNextRow {
	id: string;
	parentId: string | null;
}

/** Per-side leaf metadata in the prev/next result. */
export interface PrevNextLeaf {
	id: string;
	title: string;
}

/** Result of `computePrevNextLeaves`. */
export interface PrevNextResult {
	prev: PrevNextLeaf | null;
	next: PrevNextLeaf | null;
}

/**
 * Compute prev / next leaf links for the row identified by `currentId`,
 * given the flat document-order leaf list and a parent map describing the
 * tree shape.
 *
 * Semantic per design.md "Prev/next traversal":
 *
 *  - Leaf row (current id appears in `leaves`): prev / next are the
 *    adjacent leaves; null at the start / end of the course.
 *  - Non-leaf row (current id does NOT appear in `leaves`): "next" is the
 *    first leaf descendant of the subtree; "prev" is the leaf preceding
 *    that first descendant in the flat list. Clicking "next" on a lesson
 *    landing therefore enters the lesson; "prev" goes to the previous
 *    sibling's last leaf.
 *
 * Returns `{ prev: null, next: null }` when the leaf list is empty, when
 * the current id is unknown to the tree, or when a non-leaf has zero leaf
 * descendants (defensive -- seed validator rejects this shape).
 */
export function computePrevNextLeaves(
	currentId: string,
	rows: ReadonlyArray<PrevNextRow>,
	leaves: ReadonlyArray<LensLeaf>,
): PrevNextResult {
	if (leaves.length === 0) return { prev: null, next: null };

	const leafIndex = leaves.findIndex((leaf) => leaf.id === currentId);
	if (leafIndex !== -1) {
		const prev = leafIndex > 0 ? leaves[leafIndex - 1] : null;
		const next = leafIndex < leaves.length - 1 ? leaves[leafIndex + 1] : null;
		return {
			prev: prev !== null ? { id: prev.id, title: prev.title } : null,
			next: next !== null ? { id: next.id, title: next.title } : null,
		};
	}

	// Non-leaf: walk the descendants and find the first leaf reachable in
	// document order. Use a children-by-parent map for the descendant
	// expansion; the leaf list is already in document order so the first
	// leaf in `leaves` whose id is a descendant is the answer.
	const childrenByParent = new Map<string | null, string[]>();
	for (const row of rows) {
		const list = childrenByParent.get(row.parentId) ?? [];
		list.push(row.id);
		childrenByParent.set(row.parentId, list);
	}

	const descendants = new Set<string>();
	const queue: string[] = [currentId];
	for (let safety = 0; safety < rows.length && queue.length > 0; safety += 1) {
		const id = queue.shift();
		if (id === undefined) break;
		descendants.add(id);
		const kids = childrenByParent.get(id) ?? [];
		for (const kid of kids) queue.push(kid);
	}

	const firstDescendantIndex = leaves.findIndex((leaf) => descendants.has(leaf.id));
	if (firstDescendantIndex === -1) return { prev: null, next: null };

	const next = leaves[firstDescendantIndex];
	const prev = firstDescendantIndex > 0 ? leaves[firstDescendantIndex - 1] : null;
	return {
		prev: prev !== null ? { id: prev.id, title: prev.title } : null,
		next: { id: next.id, title: next.title },
	};
}

/**
 * Aggregate cert-overlay coverage up a `LensTreeNode[]` (Phase E).
 *
 * The overlay lens (`courseWithCertOverlayLens` in `./lenses-course.ts`)
 * decorates each leaf with `sources.inCert` against ONE specific syllabus.
 * Per the spec, "cert binding is leaf-only -- the renderer aggregates
 * coverage upward." This helper computes that rollup.
 *
 * Algorithm:
 *
 *   - A leaf with `sources?.inCert === true` contributes `{ covered: 1, total: 1 }`.
 *   - A leaf with `sources` set but `inCert === false` contributes `{ covered: 0, total: 1 }`.
 *   - A leaf with `sources === undefined` (the non-overlay lens path) is
 *     not counted -- the overlay was not computed for it.
 *   - Every interior node carries the sum of its descendants' contributions.
 *
 * Output is a NEW tree (immutable input) where every `LensTreeNode` carries
 * `certCoverage: { covered, total, ratio }`. `ratio` is `covered / total`
 * (0 when `total === 0`).
 *
 * `syllabusId` is accepted for identification / future per-leaf multi-cert
 * extension; the current implementation relies on the lens having already
 * projected against that syllabus and decorated leaves accordingly.
 *
 * Pure helper -- browser-safe.
 */
export function aggregateCertCoverage(
	tree: ReadonlyArray<LensTreeNode>,
	_syllabusId: string,
): LensTreeNode[] {
	function annotateLeaf(leaf: LensLeaf): { covered: number; total: number } {
		// Only leaves the overlay actually decorated count toward the rollup.
		// `sources === undefined` means the lens path (`courseLens`) ran
		// without an overlay -- not "uncovered," but "not measured."
		if (leaf.sources === undefined) return { covered: 0, total: 0 };
		return {
			covered: leaf.sources.inCert ? 1 : 0,
			total: 1,
		};
	}

	function annotate(node: LensTreeNode): LensTreeNode {
		let covered = 0;
		let total = 0;
		// Direct leaves first (document order matches the lens's
		// `flattenLeavesDepthFirst` traversal, but the sums are
		// order-independent).
		const directLeaves = node.leaves ?? [];
		for (const leaf of directLeaves) {
			const contribution = annotateLeaf(leaf);
			covered += contribution.covered;
			total += contribution.total;
		}
		// Recurse interior children; the annotated child carries its own
		// `certCoverage` so we read from it directly without re-walking.
		const annotatedChildren = node.children.map(annotate);
		for (const child of annotatedChildren) {
			covered += child.certCoverage?.covered ?? 0;
			total += child.certCoverage?.total ?? 0;
		}
		const certCoverage: CertCoverage = {
			covered,
			total,
			ratio: total === 0 ? 0 : covered / total,
		};
		return {
			...node,
			children: annotatedChildren,
			certCoverage,
		};
	}

	return tree.map(annotate);
}
