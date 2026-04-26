/**
 * CitedByPanel DOM contract -- heading levels, empty state, linked vs missing
 * source rendering, optional context.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CitedByPanel, { type CitedByItem } from '../src/components/CitedByPanel.svelte';

afterEach(() => {
	cleanup();
});

describe('CitedByPanel -- empty', () => {
	it('renders the empty message and state=empty when no items', () => {
		render(CitedByPanel, { items: [] });
		expect(screen.getByTestId('citedbypanel-root').getAttribute('data-state')).toBe('empty');
		expect(screen.getByTestId('citedbypanel-empty').textContent).toBe('Not yet cited by other content.');
	});

	it('honors a custom emptyMessage', () => {
		render(CitedByPanel, { items: [], emptyMessage: 'Nothing cites this yet.' });
		expect(screen.getByTestId('citedbypanel-empty').textContent).toBe('Nothing cites this yet.');
	});
});

describe('CitedByPanel -- populated', () => {
	const items: CitedByItem[] = [
		{ id: '1', typeLabel: 'Card', label: 'Card front', href: '/cards/1' },
		{ id: '2', typeLabel: 'Knowledge node', label: 'Missing source', href: null },
		{ id: '3', typeLabel: 'Scenario', label: 'With context', href: '/scenarios/3', context: 'pretext for citation' },
	];

	it('renders one row per item with the right testid', () => {
		render(CitedByPanel, { items });
		for (const item of items) {
			expect(screen.getByTestId(`citedbypanel-row-${item.id}`)).toBeTruthy();
		}
	});

	it('linked sources render as <a> with the right href', () => {
		render(CitedByPanel, { items });
		const link = screen.getByTestId('citedbypanel-label-1');
		expect(link.tagName).toBe('A');
		expect(link.getAttribute('href')).toBe('/cards/1');
	});

	it('missing sources render as a non-link <span> with state=missing', () => {
		render(CitedByPanel, { items });
		const label = screen.getByTestId('citedbypanel-label-2');
		expect(label.tagName).toBe('SPAN');
		expect(screen.getByTestId('citedbypanel-row-2').getAttribute('data-state')).toBe('missing');
	});

	it('renders context line when provided', () => {
		render(CitedByPanel, { items });
		expect(screen.getByTestId('citedbypanel-context-3').textContent).toContain('pretext for citation');
	});
});

describe('CitedByPanel -- heading', () => {
	it('default heading uses h2 and includes the count', () => {
		render(CitedByPanel, { items: [{ id: '1', typeLabel: 'Card', label: 'A' }] });
		const heading = screen.getByTestId('citedbypanel-heading');
		expect(heading.tagName).toBe('H2');
		expect(heading.textContent).toContain('Cited by (1)');
	});

	it('headingLevel=3 switches to h3', () => {
		render(CitedByPanel, { items: [], headingLevel: 3 });
		expect(screen.getByTestId('citedbypanel-heading').tagName).toBe('H3');
	});
});
