/**
 * FilterBar DOM contract -- panel + grid wrapper for filter inputs.
 *
 * Reflects layout strategy on `data-layout`, threads `aria-label` to the
 * wrapping `<section>`, and propagates the `columns` / `maxWidth` knobs
 * via inline custom-property style.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FilterBarHarness from './harnesses/FilterBarHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('FilterBar', () => {
	it('renders a <section> with the supplied aria-label', () => {
		render(FilterBarHarness, { ariaLabel: 'Filter sources' });
		const root = screen.getByTestId('filter-bar-root');
		expect(root.tagName).toBe('SECTION');
		expect(root.getAttribute('aria-label')).toBe('Filter sources');
	});

	it('defaults layout to grid', () => {
		render(FilterBarHarness, {});
		const root = screen.getByTestId('filter-bar-root');
		expect(root.getAttribute('data-layout')).toBe('grid');
		expect(root.classList.contains('layout-grid')).toBe(true);
	});

	it('applies layout=rows when requested', () => {
		render(FilterBarHarness, { layout: 'rows' });
		const root = screen.getByTestId('filter-bar-root');
		expect(root.getAttribute('data-layout')).toBe('rows');
		expect(root.classList.contains('layout-rows')).toBe(true);
	});

	it('threads custom columns into the inline style for grid layout', () => {
		render(FilterBarHarness, { columns: '2fr 1fr 1fr' });
		const style = screen.getByTestId('filter-bar-root').getAttribute('style') ?? '';
		expect(style).toContain('grid-template-columns: 2fr 1fr 1fr');
	});

	it('threads maxWidth into the inline style', () => {
		render(FilterBarHarness, { maxWidth: '32rem' });
		const style = screen.getByTestId('filter-bar-root').getAttribute('style') ?? '';
		expect(style).toContain('max-width: 32rem');
	});

	it('omits grid-template-columns from inline style for layout=rows', () => {
		render(FilterBarHarness, { layout: 'rows' });
		const style = screen.getByTestId('filter-bar-root').getAttribute('style') ?? '';
		expect(style).not.toContain('grid-template-columns');
	});

	it('renders children inside the panel', () => {
		render(FilterBarHarness, {});
		expect(screen.getByTestId('harness-input')).toBeInTheDocument();
	});

	describe('FilterField', () => {
		it('renders a label associated with the input via htmlFor', () => {
			render(FilterBarHarness, {});
			const root = screen.getByTestId('filter-field-root');
			const label = root.querySelector('label');
			expect(label).not.toBeNull();
			expect(label?.getAttribute('for')).toBe('harness-search');
			expect(label?.textContent ?? '').toContain('Search');
		});
	});
});
