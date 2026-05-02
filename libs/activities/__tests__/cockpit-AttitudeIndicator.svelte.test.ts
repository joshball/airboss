/**
 * Cockpit AttitudeIndicator DOM contract -- horizon translates by pitch,
 * rolls with bank. The aria-label carries the pitch in degrees so screen
 * readers can convey the attitude.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AttitudeIndicator from '../src/cockpit-panel/AttitudeIndicator.svelte';

afterEach(() => {
	cleanup();
});

describe('cockpit AttitudeIndicator', () => {
	it('renders an svg with role="img" and a pitch-bearing aria-label', () => {
		const { container } = render(AttitudeIndicator, { pitchRadians: 0, rollRadians: 0 });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')).toMatch(/pitch/i);
	});

	it('aria-label reports the pitch in degrees (radians -> degrees conversion)', () => {
		// 0.1745 rad ~= 10.0 deg; tolerate the 0.1 precision the label uses.
		const { container } = render(AttitudeIndicator, { pitchRadians: 0.1745, rollRadians: 0 });
		const label = container.querySelector('svg')?.getAttribute('aria-label') ?? '';
		expect(label).toMatch(/10\.0/);
	});

	it('treats non-finite pitch / roll as zero (no NaN in DOM attributes)', () => {
		const { container } = render(AttitudeIndicator, {
			pitchRadians: Number.NaN,
			rollRadians: Number.POSITIVE_INFINITY,
		});
		// No NaN in any attribute string.
		const html = container.innerHTML;
		expect(html).not.toMatch(/NaN/);
		expect(html).not.toMatch(/Infinity/);
	});
});
