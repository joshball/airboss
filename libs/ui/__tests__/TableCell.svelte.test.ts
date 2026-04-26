/**
 * TableCell DOM contract -- <td> with text-align style.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TableCellHarness from './harnesses/TableCellHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('TableCell', () => {
	it('renders a <td> with the children content', () => {
		render(TableCellHarness, { body: 'value' });
		const root = screen.getByTestId('tablecell-root');
		expect(root.tagName).toBe('TD');
		expect(screen.getByTestId('harness-cell-body').textContent).toBe('value');
	});

	it('reflects align on data-align and inline style', () => {
		render(TableCellHarness, { align: 'right' });
		const root = screen.getByTestId('tablecell-root') as HTMLTableCellElement;
		expect(root.getAttribute('data-align')).toBe('right');
		expect(root.style.textAlign).toBe('right');
	});
});
