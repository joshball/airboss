/**
 * FilterCard DOM contract -- form GET, role=search, apply + reset actions.
 */

import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FilterCardHarness from './harnesses/FilterCardHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('FilterCard', () => {
	it('renders a <form> with role=search and method=GET', () => {
		render(FilterCardHarness, { resetHref: '/x' });
		const root = screen.getByTestId('filtercard-root') as HTMLFormElement;
		expect(root.tagName).toBe('FORM');
		expect(root.method.toUpperCase()).toBe('GET');
		expect(root.getAttribute('role')).toBe('search');
	});

	it('renders the controls grid + actions row', () => {
		render(FilterCardHarness, { resetHref: '/x' });
		expect(screen.getByTestId('filtercard-grid')).toBeTruthy();
		expect(screen.getByTestId('filtercard-actions')).toBeTruthy();
	});

	it('apply button is type=submit', () => {
		render(FilterCardHarness, { resetHref: '/x', applyLabel: 'Apply' });
		const actions = screen.getByTestId('filtercard-actions');
		const buttons = within(actions as unknown as HTMLElement).getAllByRole('button');
		const apply = buttons.find((b) => b.textContent?.trim() === 'Apply');
		expect(apply?.getAttribute('type')).toBe('submit');
	});

	it('reset link points at resetHref', () => {
		render(FilterCardHarness, { resetHref: '/cards', resetLabel: 'Reset' });
		const actions = screen.getByTestId('filtercard-actions');
		const link = (actions as unknown as HTMLElement).querySelector('a');
		expect(link?.getAttribute('href')).toBe('/cards');
	});

	it('renders hidden snippet content when provided', () => {
		render(FilterCardHarness, { resetHref: '/x', withHidden: true });
		expect(screen.getByTestId('harness-hidden-page')).toBeTruthy();
	});
});
