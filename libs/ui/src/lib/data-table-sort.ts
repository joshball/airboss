/**
 * Pure helpers used by `components/DataTable.svelte`. Lifted into `.ts` so the
 * sorting behaviour is unit-testable without a Svelte runtime.
 */

export type SortDir = 'asc' | 'desc';

export interface SortState {
	columnId: string | null;
	direction: SortDir;
}

/** Case-insensitive compare with null-tolerant ordering (nulls sort last). */
export function compareValues(a: string | number | null | undefined, b: string | number | null | undefined): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	return String(a).localeCompare(String(b));
}

/**
 * Produce the next sort state when `columnId` is clicked. New column defaults
 * to `asc`; clicking the same column flips direction.
 */
export function flipSortState(current: SortState, columnId: string): SortState {
	if (current.columnId !== columnId) {
		return { columnId, direction: 'asc' };
	}
	return { columnId, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

/**
 * Return a stable sorted copy of `rows` using `sortBy(row)` as the key. Pass
 * the original array back when `columnId` is null or no sortBy is available.
 */
export function sortRows<T>(
	rows: readonly T[],
	sortBy: ((row: T) => string | number | null | undefined) | undefined,
	direction: SortDir,
): readonly T[] {
	if (!sortBy) return rows;
	const dir = direction === 'asc' ? 1 : -1;
	return [...rows].sort((a, b) => compareValues(sortBy(a), sortBy(b)) * dir);
}
