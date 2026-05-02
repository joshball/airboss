/**
 * Cockpit HeadingIndicator DOM contract -- compass card rotates by -heading
 * (so the fixed lubber line at 12 o'clock points to the current heading)
 * and the aria-label reports the heading in degrees.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import HeadingIndicator from '../src/cockpit-panel/HeadingIndicator.svelte';

afterEach(() => {
	cleanup();
});

function cardRotation(container: HTMLElement): number {
	const g = container.querySelector<SVGGElement>('g[transform*="rotate"]');
	if (!g) return Number.NaN;
	const m = (g.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)/);
	return m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
}

describe('cockpit HeadingIndicator', () => {
	it('renders an svg with role="img"', () => {
		const { container } = render(HeadingIndicator, { headingDeg: 0 });
		expect(container.querySelector('svg')?.getAttribute('role')).toBe('img');
	});

	it('rotates the card opposite the heading (heading=90 -> card -90)', () => {
		const { container } = render(HeadingIndicator, { headingDeg: 90 });
		expect(cardRotation(container)).toBeCloseTo(-90, 5);
	});

	it('wraps negative headings into [0, 360) before rotating', () => {
		const { container } = render(HeadingIndicator, { headingDeg: -45 });
		// -45 wraps to 315 -> card rotation -315.
		expect(cardRotation(container)).toBeCloseTo(-315, 5);
	});

	it('treats non-finite heading as 0', () => {
		const { container } = render(HeadingIndicator, { headingDeg: Number.NaN });
		// Math result is `-0` for headingDeg=0 (negation of zero); treat as numerically zero.
		expect(cardRotation(container)).toBeCloseTo(0, 10);
	});
});
