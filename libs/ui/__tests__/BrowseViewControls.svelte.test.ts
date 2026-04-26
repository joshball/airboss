/**
 * BrowseViewControls DOM contract -- two selects, callbacks fire with typed values.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BrowseViewControls from '../src/components/BrowseViewControls.svelte';

const groupByOptions = [
	{ value: 'domain', label: 'Domain' },
	{ value: 'status', label: 'Status' },
];
const pageSizeOptions = [
	{ value: 25, label: '25' },
	{ value: 50, label: '50' },
];

afterEach(() => {
	cleanup();
});

describe('BrowseViewControls', () => {
	it('renders both select controls with the current values', () => {
		render(BrowseViewControls, {
			groupBy: 'domain',
			groupByOptions,
			onGroupBy: vi.fn(),
			pageSize: 25,
			pageSizeOptions,
			onPageSize: vi.fn(),
		});
		expect((screen.getByTestId('browseviewcontrols-groupby') as HTMLSelectElement).value).toBe('domain');
		expect((screen.getByTestId('browseviewcontrols-pagesize') as HTMLSelectElement).value).toBe('25');
	});

	it('changing groupBy fires onGroupBy with the new value', async () => {
		const onGroupBy = vi.fn<(v: string) => void>();
		const user = userEvent.setup();
		render(BrowseViewControls, {
			groupBy: 'domain',
			groupByOptions,
			onGroupBy,
			pageSize: 25,
			pageSizeOptions,
			onPageSize: vi.fn(),
		});
		await user.selectOptions(screen.getByTestId('browseviewcontrols-groupby'), 'status');
		expect(onGroupBy).toHaveBeenCalledWith('status');
	});

	it('changing pageSize fires onPageSize with a coerced number', async () => {
		const onPageSize = vi.fn<(v: number) => void>();
		const user = userEvent.setup();
		render(BrowseViewControls, {
			groupBy: 'domain',
			groupByOptions,
			onGroupBy: vi.fn(),
			pageSize: 25,
			pageSizeOptions,
			onPageSize,
		});
		await user.selectOptions(screen.getByTestId('browseviewcontrols-pagesize'), '50');
		expect(onPageSize).toHaveBeenCalledWith(50);
	});
});
