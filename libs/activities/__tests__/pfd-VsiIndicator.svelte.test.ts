/**
 * PFD VsiIndicator DOM contract -- aria-label reports VS in fpm; the
 * pointer y-position depends on `verticalSpeedFpm`; the floating numeric
 * readout appears only when |VS| crosses the dead zone (100 fpm).
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import VsiIndicator from '../src/pfd/VsiIndicator.svelte';

afterEach(() => {
	cleanup();
});

describe('PFD VsiIndicator', () => {
	it('renders an svg with role="img" and a fpm-bearing aria-label', () => {
		const { container } = render(VsiIndicator, { verticalSpeedFpm: 500 });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')?.toLowerCase()).toContain('vertical speed');
		expect(svg?.getAttribute('aria-label')).toContain('500');
	});

	it('hides the floating readout in the dead zone (|VS| < 100 fpm)', () => {
		const { container } = render(VsiIndicator, { verticalSpeedFpm: 50 });
		// The readout shares class .readout-text -- when hidden the {#if} omits it.
		const readouts = container.querySelectorAll('text.readout-text');
		expect(readouts.length).toBe(0);
	});

	it('shows the floating readout when |VS| >= 100 fpm', () => {
		const { container } = render(VsiIndicator, { verticalSpeedFpm: 250 });
		const readouts = container.querySelectorAll('text.readout-text');
		expect(readouts.length).toBe(1);
		expect(readouts[0]?.textContent?.trim()).toBe('250');
	});

	it('clamps readout text to the +/- 2000 rail when input exceeds the range', () => {
		const { container } = render(VsiIndicator, { verticalSpeedFpm: 5000 });
		const readouts = container.querySelectorAll('text.readout-text');
		expect(readouts[0]?.textContent?.trim()).toBe('2000');
	});

	it('treats non-finite VS as 0 (no readout, no NaN attributes)', () => {
		const { container } = render(VsiIndicator, { verticalSpeedFpm: Number.NaN });
		expect(container.querySelectorAll('text.readout-text').length).toBe(0);
		expect(container.innerHTML).not.toMatch(/NaN/);
	});
});
