/**
 * Reader-nav helper -- compute prev / next / up links for a `reference_section`
 * row given the flat section tree for its parent reference.
 *
 * The flightbag's flightbag/handbook/AIM/AC/CFR readers all share the same
 * "book-like" navigation pattern: every leaf page has prev / up / next links
 * at the bottom; an empty-body section also surfaces them inline. Computing
 * the trio here keeps the route loaders lean -- each calls
 * `listAllSectionsForReference` and passes the result through `computeSiblingNav`.
 *
 * Reading order follows a depth-first walk of the tree, ordered by `ordinal`
 * within each parent. For handbooks: chapter -> chapter's sections -> next
 * chapter -> next chapter's sections. From the last section of chapter N,
 * "Next" wraps to the first section of chapter N+1; from the first section
 * of chapter N, "Prev" wraps to the last leaf of chapter N-1 (or to the
 * chapter preamble of N when the prior chapter has no sections).
 */

import type { ReferenceSectionRow } from '@ab/bc-study/server';

export interface NavLink {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly href: string;
}

export interface SiblingNav {
	readonly prev: NavLink | null;
	readonly next: NavLink | null;
	readonly up: NavLink | null;
}

/**
 * Caller-supplied function: given a section row, return the route URL for
 * the reader page. `null` when the row has no reader page (e.g. a CFR
 * subpart container that doesn't have its own URL). Rows that return `null`
 * are skipped in the prev/next walk so the user is never sent to a route
 * that 404s.
 */
export type SectionHrefFn = (row: ReferenceSectionRow) => string | null;

/**
 * Walk the flat section tree and produce prev / next / up for one target.
 *
 * Tree input: every section row for the reference, in any order. The
 * function builds an in-memory parent map so callers don't have to
 * pre-sort.
 *
 * Reading order: depth-first by `ordinal`. The "up" link points at the
 * parent row when one exists.
 */
export function computeSiblingNav(
	allSections: ReadonlyArray<ReferenceSectionRow>,
	targetId: string,
	hrefFor: SectionHrefFn,
): SiblingNav {
	const byId = new Map<string, ReferenceSectionRow>();
	const childrenByParent = new Map<string | null, ReferenceSectionRow[]>();
	for (const row of allSections) {
		byId.set(row.id, row);
		const key = row.parentId;
		const list = childrenByParent.get(key) ?? [];
		list.push(row);
		childrenByParent.set(key, list);
	}
	for (const list of childrenByParent.values()) {
		list.sort((a, b) => a.ordinal - b.ordinal);
	}

	// Reading-order traversal: top-level rows first (parentId === null),
	// then each row's children, recursively. The flat result is the read
	// order used to derive prev/next.
	const readingOrder: ReferenceSectionRow[] = [];
	const visit = (parentId: string | null): void => {
		const kids = childrenByParent.get(parentId) ?? [];
		for (const kid of kids) {
			readingOrder.push(kid);
			visit(kid.id);
		}
	};
	visit(null);

	const targetIdx = readingOrder.findIndex((r) => r.id === targetId);
	if (targetIdx < 0) return { prev: null, next: null, up: null };

	const findUsable = (start: number, step: -1 | 1): NavLink | null => {
		for (let i = start; i >= 0 && i < readingOrder.length; i += step) {
			const row = readingOrder[i];
			if (row === undefined) continue;
			const href = hrefFor(row);
			if (href === null) continue;
			return { id: row.id, code: row.code, title: row.title, href };
		}
		return null;
	};

	const prev = findUsable(targetIdx - 1, -1);
	const next = findUsable(targetIdx + 1, 1);

	const target = readingOrder[targetIdx];
	let up: NavLink | null = null;
	if (target?.parentId !== null && target?.parentId !== undefined) {
		const parent = byId.get(target.parentId);
		if (parent) {
			const href = hrefFor(parent);
			if (href !== null) {
				up = { id: parent.id, code: parent.code, title: parent.title, href };
			}
		}
	}

	return { prev, next, up };
}
