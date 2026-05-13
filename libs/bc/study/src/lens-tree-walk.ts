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

import type { LensLeaf, LensTreeNode } from './lenses';

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
