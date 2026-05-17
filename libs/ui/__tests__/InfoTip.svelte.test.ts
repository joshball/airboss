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

	it('aria-controls on the trigger resolves to the popover id once open', async () => {
		const user = userEvent.setup();
		render(InfoTip, { term: 'Slice', definition: 'A bucket.' });
		const trigger = screen.getByTestId('infotip-trigger');
		const controls = trigger.getAttribute('aria-controls');
		expect(controls).toMatch(/^infotip-/);
		await user.click(trigger);
		expect(screen.getByTestId('infotip-popover').getAttribute('id')).toBe(controls);
	});

	it('two InfoTips for the same term get distinct popover ids', () => {
		// The popover id derives from a per-instance `$props.id()`, not the
		// term text, so the same term used twice on a page never collides --
		// a duplicate id would make `aria-controls` ambiguous (WCAG 4.1.1).
		render(InfoTip, { term: 'Goal', definition: 'A.' });
		render(InfoTip, { term: 'Goal', definition: 'B.' });
		const [first, second] = screen.getAllByTestId('infotip-trigger');
		expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'));
	});
});

describe('InfoTip -- open behavior', () => {
	it('opens the popover on trigger click and stays open (regression: pathname-effect self-close)', async () => {
		const user = userEvent.setup();
		render(InfoTip, { term: 'Slice', definition: 'A bucket of work.' });
		await user.click(screen.getByTestId('infotip-trigger'));
		expect(screen.getByTestId('infotip-popover')).toBeInTheDocument();
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
		expect(screen.getByTestId('infotip-popover')).toBeInTheDocument();
		await user.click(trigger);
		expect(screen.queryByTestId('infotip-popover')).toBeNull();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});
});
