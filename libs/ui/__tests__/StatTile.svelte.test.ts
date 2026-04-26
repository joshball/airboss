/**
 * StatTile DOM contract -- linked vs unlinked, label/value/sub.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import StatTile from '../src/components/StatTile.svelte';

afterEach(() => {
	cleanup();
});

describe('StatTile -- unlinked', () => {
	it('renders label + value as a <div> when no href is provided', () => {
		render(StatTile, { label: 'Reps', value: 42 });
		const root = screen.getByTestId('stattile-root');
		expect(root.tagName).toBe('DIV');
		expect(root.getAttribute('data-linked')).toBe('false');
		expect(screen.getByTestId('stattile-label').textContent).toBe('Reps');
		expect(screen.getByTestId('stattile-value').textContent?.trim()).toBe('42');
	});
});

describe('StatTile -- linked', () => {
	it('renders an <a> with the href and data-linked=true when href is provided', () => {
		render(StatTile, { label: 'Reps', value: 42, href: '/dashboard/reps' });
		const root = screen.getByTestId('stattile-root');
		expect(root.tagName).toBe('A');
		expect(root.getAttribute('href')).toBe('/dashboard/reps');
		expect(root.getAttribute('data-linked')).toBe('true');
	});
});

describe('StatTile -- tone + sub', () => {
	it('reflects tone via data-tone and class', () => {
		render(StatTile, { label: 'X', value: 1, tone: 'success' });
		const root = screen.getByTestId('stattile-root');
		expect(root.getAttribute('data-tone')).toBe('success');
		expect(root.classList.contains('t-success')).toBe(true);
	});

	it('renders sub line when provided', () => {
		render(StatTile, { label: 'X', value: 1, sub: 'this week' });
		expect(screen.getByTestId('stattile-sub').textContent).toBe('this week');
	});

	it('omits sub line when not provided', () => {
		render(StatTile, { label: 'X', value: 1 });
		expect(screen.queryByTestId('stattile-sub')).toBeNull();
	});
});
