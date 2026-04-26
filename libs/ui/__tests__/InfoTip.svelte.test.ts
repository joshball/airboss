/**
 * InfoTip DOM contract -- trigger ARIA + open/close behavior.
 *
 * `$app/state` resolves to a static stub (libs/ui/__tests__/stubs/app/) so
 * library DOM tests don't need SvelteKit.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import InfoTip from '../src/components/InfoTip.svelte';

afterEach(() => {
	cleanup();
});

describe('InfoTip -- closed (default)', () => {
	it('renders the trigger as a <button> with aria-haspopup=dialog and aria-expanded=false', () => {
		render(InfoTip, { term: 'Slice', definition: 'A bucket of work.' });
		const trigger = screen.getByTestId('infotip-trigger');
		expect(trigger.tagName).toBe('BUTTON');
		expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('aria-label defaults to "Learn more about <term>"', () => {
		render(InfoTip, { term: 'Slice', definition: 'A bucket.' });
		expect(screen.getByTestId('infotip-trigger').getAttribute('aria-label')).toBe('Learn more about Slice');
	});

	it('honors a custom label override', () => {
		render(InfoTip, { term: 'Slice', definition: 'A bucket.', label: 'Help on slice' });
		expect(screen.getByTestId('infotip-trigger').getAttribute('aria-label')).toBe('Help on slice');
	});

	it('does not render the popover when closed', () => {
		render(InfoTip, { term: 'X', definition: 'Y' });
		expect(screen.queryByTestId('infotip-popover')).toBeNull();
	});

	it('aria-controls on the trigger points at a stable popover id derived from the term', () => {
		render(InfoTip, { term: 'Slice', definition: 'A bucket.' });
		expect(screen.getByTestId('infotip-trigger').getAttribute('aria-controls')).toBe('infotip-slice');
	});
});

describe('InfoTip -- open behavior', () => {
	it('opens the popover on trigger click and stays open (regression: pathname-effect self-close)', async () => {
		const user = userEvent.setup();
		render(InfoTip, { term: 'Slice', definition: 'A bucket of work.' });
		await user.click(screen.getByTestId('infotip-trigger'));
		expect(screen.getByTestId('infotip-popover')).toBeTruthy();
		expect(screen.getByTestId('infotip-trigger').getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByTestId('infotip-root').getAttribute('data-state')).toBe('open');
	});

	it('renders term, definition, and Learn more link inside the popover', async () => {
		const user = userEvent.setup();
		render(InfoTip, { term: 'Slice', definition: 'A bucket of work.', helpId: 'slicing' });
		await user.click(screen.getByTestId('infotip-trigger'));
		expect(screen.getByTestId('infotip-title').textContent).toBe('Slice');
		expect(screen.getByTestId('infotip-body').textContent).toBe('A bucket of work.');
		expect(screen.getByTestId('infotip-learnmore').getAttribute('href')).toBe('/help/slicing');
	});

	it('omits the Learn more link when helpId is not provided', async () => {
		const user = userEvent.setup();
		render(InfoTip, { term: 'X', definition: 'Y' });
		await user.click(screen.getByTestId('infotip-trigger'));
		expect(screen.queryByTestId('infotip-learnmore')).toBeNull();
	});

	it('clicking a pinned trigger again closes the popover', async () => {
		const user = userEvent.setup();
		render(InfoTip, { term: 'Slice', definition: 'A bucket.' });
		const trigger = screen.getByTestId('infotip-trigger');
		await user.click(trigger);
		expect(screen.getByTestId('infotip-popover')).toBeTruthy();
		await user.click(trigger);
		expect(screen.queryByTestId('infotip-popover')).toBeNull();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});
});
