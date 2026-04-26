/**
 * FilterChips DOM contract -- chip per filter, clear-all link, hidden when empty.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FilterChips from '../src/components/FilterChips.svelte';

afterEach(() => {
	cleanup();
});

describe('FilterChips', () => {
	it('renders nothing when chip list is empty', () => {
		const { container } = render(FilterChips, { chips: [], clearHref: '/x' });
		expect(container.querySelector('[data-testid="filterchips-root"]')).toBeNull();
	});

	it('renders one chip per filter with the right href and aria-label', () => {
		const chips = [
			{ key: 'domain', label: 'Domain', value: 'Emergency', removeHref: '/cards?status=active' },
			{ key: 'status', label: 'Status', value: 'Active', removeHref: '/cards?domain=emergency' },
		];
		render(FilterChips, { chips, clearHref: '/cards' });
		const d = screen.getByTestId('filterchips-chip-domain');
		expect(d.getAttribute('href')).toBe('/cards?status=active');
		expect(d.getAttribute('aria-label')).toBe('Remove Domain filter');
		expect(screen.getByTestId('filterchips-chip-status').getAttribute('href')).toBe('/cards?domain=emergency');
	});

	it('renders heading + clear link with the configured copy + href', () => {
		const chips = [{ key: 'k', label: 'L', value: 'V', removeHref: '/x' }];
		render(FilterChips, { chips, clearHref: '/cards', heading: 'Active:', clearLabel: 'Clear' });
		expect(screen.getByTestId('filterchips-heading').textContent).toBe('Active:');
		const clear = screen.getByTestId('filterchips-clear');
		expect(clear.getAttribute('href')).toBe('/cards');
		expect(clear.textContent?.trim()).toBe('Clear');
	});
});
