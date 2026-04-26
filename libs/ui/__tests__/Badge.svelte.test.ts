/**
 * Badge DOM contract -- tone + size reflect on data attributes and classes.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BadgeHarness from './harnesses/BadgeHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('Badge', () => {
	it('renders with the children label', () => {
		render(BadgeHarness, { label: 'New' });
		expect(screen.getByTestId('badge-root').textContent?.trim()).toBe('New');
	});

	it('default tone + size reflect as default + md', () => {
		render(BadgeHarness, { label: 'New' });
		const root = screen.getByTestId('badge-root');
		expect(root.getAttribute('data-tone')).toBe('default');
		expect(root.getAttribute('data-size')).toBe('md');
	});

	it('tone=success size=lg reflects on attributes and classes', () => {
		render(BadgeHarness, { label: 'OK', tone: 'success', size: 'lg' });
		const root = screen.getByTestId('badge-root');
		expect(root.getAttribute('data-tone')).toBe('success');
		expect(root.getAttribute('data-size')).toBe('lg');
		expect(root.classList.contains('v-success')).toBe(true);
		expect(root.classList.contains('s-lg')).toBe(true);
	});

	it('passes ariaLabel through', () => {
		render(BadgeHarness, { label: '7', ariaLabel: '7 unread' });
		expect(screen.getByTestId('badge-root').getAttribute('aria-label')).toBe('7 unread');
	});
});
