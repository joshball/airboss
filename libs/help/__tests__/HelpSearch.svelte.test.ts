/**
 * HelpSearch DOM contract -- trigger button + global key listeners (Cmd+K, /).
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import HelpSearch from '../src/ui/HelpSearch.svelte';

afterEach(() => {
	cleanup();
});

describe('HelpSearch', () => {
	it('renders a button with aria-label "Open search"', () => {
		render(HelpSearch);
		const trigger = screen.getByTestId('helpsearch-trigger');
		expect(trigger.tagName).toBe('BUTTON');
		expect(trigger.getAttribute('aria-label')).toBe('Open search');
	});

	it('clicking trigger flips data-state to open', async () => {
		render(HelpSearch);
		const trigger = screen.getByTestId('helpsearch-trigger') as HTMLButtonElement;
		expect(trigger.getAttribute('data-state')).toBe('closed');
		trigger.click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(trigger.getAttribute('data-state')).toBe('open');
	});

	it('Cmd+K opens the palette', async () => {
		render(HelpSearch);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.getByTestId('helpsearch-trigger').getAttribute('data-state')).toBe('open');
	});
});
