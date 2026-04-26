/**
 * TableHeaderCell DOM contract -- <th> with scope.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TableHeaderCellHarness from './harnesses/TableHeaderCellHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('TableHeaderCell', () => {
	it('renders a <th> with the children content', () => {
		render(TableHeaderCellHarness, { body: 'Title' });
		const root = screen.getByTestId('tableheadercell-root');
		expect(root.tagName).toBe('TH');
		expect(screen.getByTestId('harness-th-body').textContent).toBe('Title');
	});

	it('default scope is col', () => {
		render(TableHeaderCellHarness);
		expect(screen.getByTestId('tableheadercell-root').getAttribute('scope')).toBe('col');
	});

	it('scope=row reflects on data-scope and scope attribute', () => {
		render(TableHeaderCellHarness, { scope: 'row' });
		const root = screen.getByTestId('tableheadercell-root');
		expect(root.getAttribute('data-scope')).toBe('row');
		expect(root.getAttribute('scope')).toBe('row');
	});
});
