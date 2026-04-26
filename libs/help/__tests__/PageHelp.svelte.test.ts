/**
 * PageHelp DOM contract -- trigger only renders when pageId is registered;
 * otherwise nothing.
 *
 * The Drawer that opens on click depends on a heavier render flow + content
 * loading; that's covered by app-level integration tests. Here we pin the
 * "trigger appears only for known pages" behavior, which protects against
 * regression to silent-broken help links.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { helpRegistry } from '../src/registry';
import PageHelp from '../src/ui/PageHelp.svelte';

beforeAll(() => {
	helpRegistry.registerPages('test-app', [
		{
			id: 'test-page',
			title: 'Test Page',
			summary: 'Test summary.',
			sections: [{ id: 'overview', title: 'Overview', body: 'Plain body.' }],
			externalRefs: [],
			surfaces: [],
			kinds: [],
			sources: [],
			rules: [],
			relatedConcepts: [],
			documents: undefined,
		},
	]);
});

afterEach(() => {
	cleanup();
});

describe('PageHelp -- unknown id', () => {
	it('renders nothing when the page id is not registered', () => {
		const { container } = render(PageHelp, { pageId: 'definitely-not-real' });
		expect(container.querySelector('[data-testid="pagehelp-trigger"]')).toBeNull();
	});
});

describe('PageHelp -- registered id', () => {
	it('renders the trigger button with aria-haspopup=dialog', () => {
		render(PageHelp, { pageId: 'test-page' });
		const trigger = screen.getByTestId('pagehelp-trigger');
		expect(trigger.tagName).toBe('BUTTON');
		expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('respects variant=icon (no label text)', () => {
		render(PageHelp, { pageId: 'test-page', variant: 'icon' });
		const trigger = screen.getByTestId('pagehelp-trigger');
		expect(trigger.getAttribute('data-variant')).toBe('icon');
		expect(trigger.classList.contains('icon-only')).toBe(true);
	});
});
