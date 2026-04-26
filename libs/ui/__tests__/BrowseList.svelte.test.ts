/**
 * BrowseList DOM contract -- group headings, list ariaLabel, item delegation.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BrowseListHarness from './harnesses/BrowseListHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('BrowseList', () => {
	it('renders one list per group with the group key as testid suffix', () => {
		const groups = [
			{ key: 'g1', label: 'Group 1', items: [{ id: 'a', name: 'A' }] },
			{ key: 'g2', label: 'Group 2', items: [{ id: 'b', name: 'B' }] },
		];
		render(BrowseListHarness, { groups });
		expect(screen.getByTestId('browselist-list-g1')).toBeTruthy();
		expect(screen.getByTestId('browselist-list-g2')).toBeTruthy();
	});

	it('renders group heading + count when label is set', () => {
		const groups = [{ key: 'g1', label: 'Domain', items: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }];
		render(BrowseListHarness, { groups });
		expect(screen.getByTestId('browselist-group-heading-g1').textContent).toContain('Domain');
		expect(screen.getByTestId('browselist-group-count-g1').textContent).toBe('2');
	});

	it('omits group heading when label is empty', () => {
		const groups = [{ key: 'flat', label: '', items: [{ id: 'a', name: 'A' }] }];
		render(BrowseListHarness, { groups });
		expect(screen.queryByTestId('browselist-group-heading-flat')).toBeNull();
	});

	it('renders one item per data row via the item snippet', () => {
		const groups = [{ key: 'g1', label: '', items: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }] }];
		render(BrowseListHarness, { groups });
		expect(screen.getByTestId('harness-item-a').textContent).toBe('Alpha');
		expect(screen.getByTestId('harness-item-b').textContent).toBe('Bravo');
	});
});
