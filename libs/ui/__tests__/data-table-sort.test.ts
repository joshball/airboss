import { describe, expect, it } from 'vitest';
import { compareValues, flipSortState, sortRows } from '../src/lib/data-table-sort';

describe('compareValues', () => {
	it('orders numbers ascending by default', () => {
		expect(compareValues(1, 2)).toBeLessThan(0);
		expect(compareValues(3, 2)).toBeGreaterThan(0);
		expect(compareValues(2, 2)).toBe(0);
	});

	it('puts nulls last regardless of other value', () => {
		expect(compareValues(null, 1)).toBeGreaterThan(0);
		expect(compareValues(1, null)).toBeLessThan(0);
		expect(compareValues(null, null)).toBe(0);
	});

	it('compares strings case-aware via localeCompare', () => {
		expect(compareValues('apple', 'banana')).toBeLessThan(0);
		expect(compareValues('banana', 'apple')).toBeGreaterThan(0);
	});
});

describe('flipSortState', () => {
	it('defaults a new column to ascending', () => {
		const next = flipSortState({ columnId: null, direction: 'asc' }, 'name');
		expect(next).toEqual({ columnId: 'name', direction: 'asc' });
	});

	it('flips direction on the same column', () => {
		const after1 = flipSortState({ columnId: 'name', direction: 'asc' }, 'name');
		expect(after1.direction).toBe('desc');
		const after2 = flipSortState(after1, 'name');
		expect(after2.direction).toBe('asc');
	});

	it('resets to ascending when switching columns', () => {
		const state = flipSortState({ columnId: 'name', direction: 'desc' }, 'createdAt');
		expect(state).toEqual({ columnId: 'createdAt', direction: 'asc' });
	});
});

describe('sortRows', () => {
	const rows = [
		{ id: 'a', name: 'banana', n: 2 },
		{ id: 'b', name: 'apple', n: 3 },
		{ id: 'c', name: 'cherry', n: 1 },
	];

	it('returns original when sortBy is undefined', () => {
		expect(sortRows(rows, undefined, 'asc')).toBe(rows);
	});

	it('sorts ascending by accessor', () => {
		const out = sortRows(rows, (r) => r.name, 'asc');
		expect(out.map((r) => r.id)).toEqual(['b', 'a', 'c']);
	});

	it('sorts descending by accessor', () => {
		const out = sortRows(rows, (r) => r.n, 'desc');
		expect(out.map((r) => r.n)).toEqual([3, 2, 1]);
	});

	it('does not mutate the original array', () => {
		const snapshot = rows.map((r) => r.id);
		sortRows(rows, (r) => r.n, 'asc');
		expect(rows.map((r) => r.id)).toEqual(snapshot);
	});
});
