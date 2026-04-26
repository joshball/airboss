/**
 * BrowseListItem DOM contract -- link href, id, optional snippet regions.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BrowseListItemHarness from './harnesses/BrowseListItemHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('BrowseListItem', () => {
	it('renders the title and a link with the correct href', () => {
		render(BrowseListItemHarness, { href: '/cards/abc', titleText: 'Hello' });
		expect(screen.getByTestId('browselistitem-title').textContent?.trim()).toBe('Hello');
		expect(screen.getByTestId('browselistitem-link').getAttribute('href')).toBe('/cards/abc');
	});

	it('passes id through to the <li>', () => {
		render(BrowseListItemHarness, { href: '/x', id: 'card-abc' });
		expect(screen.getByTestId('browselistitem-root').id).toBe('card-abc');
	});

	it('justCreated=true reflects state=just-created and adds class', () => {
		render(BrowseListItemHarness, { href: '/x', justCreated: true });
		const root = screen.getByTestId('browselistitem-root');
		expect(root.getAttribute('data-state')).toBe('just-created');
		expect(root.classList.contains('just-created')).toBe(true);
	});

	it('omits meta/stats/extra/trailing when no snippet provided', () => {
		render(BrowseListItemHarness, { href: '/x' });
		expect(screen.queryByTestId('browselistitem-meta')).toBeNull();
		expect(screen.queryByTestId('browselistitem-stats')).toBeNull();
		expect(screen.queryByTestId('browselistitem-extra')).toBeNull();
		expect(screen.queryByTestId('browselistitem-trailing')).toBeNull();
	});

	it('renders all snippet regions when provided', () => {
		render(BrowseListItemHarness, {
			href: '/x',
			withMeta: true,
			withStats: true,
			withExtra: true,
			withTrailing: true,
		});
		expect(screen.getByTestId('browselistitem-meta')).toBeTruthy();
		expect(screen.getByTestId('browselistitem-stats')).toBeTruthy();
		expect(screen.getByTestId('browselistitem-extra')).toBeTruthy();
		expect(screen.getByTestId('browselistitem-trailing')).toBeTruthy();
	});
});
