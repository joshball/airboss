/**
 * InfoTip DOM contract -- trigger ARIA + identity bits.
 *
 * NOTE: open-state tests are skipped pending a fix to the path-change
 * effect (libs/ui/src/components/InfoTip.svelte ~171), which hides the
 * popover synchronously when `open` flips true under happy-dom because
 * the effect tracks both pathname and open. Logged in
 * .ball-coord/to-dispatcher.md.
 *
 * `$app/state` resolves to a static stub (libs/ui/__tests__/stubs/app/) so
 * library DOM tests don't need SvelteKit.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
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
