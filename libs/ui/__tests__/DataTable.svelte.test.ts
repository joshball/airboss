/**
 * DataTable DOM contract -- header rendering, sortable columns, empty state,
 * row delegation. Sort logic itself is unit-tested elsewhere; this file pins
 * the DOM wiring (aria-sort, click handlers, empty fallback).
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataTableColumn, SortState } from '../src/components/DataTable.svelte';
import DataTableHarness from './harnesses/DataTableHarness.svelte';

interface Row {
	id: string;
	name: string;
	rank: number;
}

const rows: Row[] = [
	{ id: 'a', name: 'Alpha', rank: 2 },
	{ id: 'b', name: 'Bravo', rank: 1 },
];

const columns: DataTableColumn<Row>[] = [
	{ id: 'name', header: 'Name', sortBy: (r) => r.name },
	{ id: 'rank', header: 'Rank', sortBy: (r) => r.rank },
	{ id: 'static', header: 'Static' },
];

afterEach(() => {
	cleanup();
});

describe('DataTable -- rendering', () => {
	it('renders header cells for each column', () => {
		render(DataTableHarness, { rows, columns });
		expect(screen.getByTestId('datatable-header-name')).toBeTruthy();
		expect(screen.getByTestId('datatable-header-rank')).toBeTruthy();
		expect(screen.getByTestId('datatable-header-static')).toBeTruthy();
	});

	it('renders one row per data row via the row snippet', () => {
		render(DataTableHarness, { rows, columns });
		expect(screen.getByTestId('harness-row-a')).toBeTruthy();
		expect(screen.getByTestId('harness-row-b')).toBeTruthy();
	});

	it('renders sort buttons only for sortable columns', () => {
		render(DataTableHarness, { rows, columns });
		expect(screen.getByTestId('datatable-sort-name')).toBeTruthy();
		expect(screen.getByTestId('datatable-sort-rank')).toBeTruthy();
		expect(screen.queryByTestId('datatable-sort-static')).toBeNull();
	});
});

describe('DataTable -- sorting', () => {
	it('clicking a sortable header fires onSortChange with the column id', async () => {
		const onSortChange = vi.fn<(s: SortState) => void>();
		const user = userEvent.setup();
		render(DataTableHarness, { rows, columns, onSortChange });
		await user.click(screen.getByTestId('datatable-sort-name'));
		expect(onSortChange).toHaveBeenCalledTimes(1);
		expect(onSortChange.mock.calls[0][0].columnId).toBe('name');
	});

	it('aria-sort reflects the active column + direction', async () => {
		const user = userEvent.setup();
		render(DataTableHarness, { rows, columns });
		expect(screen.getByTestId('datatable-header-name').getAttribute('aria-sort')).toBe('none');
		await user.click(screen.getByTestId('datatable-sort-name'));
		expect(screen.getByTestId('datatable-header-name').getAttribute('aria-sort')).toBe('ascending');
		await user.click(screen.getByTestId('datatable-sort-name'));
		expect(screen.getByTestId('datatable-header-name').getAttribute('aria-sort')).toBe('descending');
	});
});

describe('DataTable -- empty state', () => {
	it('renders a fallback empty row when there are no rows', () => {
		render(DataTableHarness, { rows: [], columns });
		expect(screen.getByTestId('datatable-empty')).toBeTruthy();
		expect(screen.getByTestId('datatable-root').getAttribute('data-state')).toBe('empty');
	});
});
