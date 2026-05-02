/**
 * PFD AirspeedTape DOM contract -- aria-label reports the airspeed; the
 * scrolling tape group translates by `airspeedKnots * pixelsPerKt`; the
 * arc band rectangles render even when the airspeed is well below the
 * window.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AirspeedTape from '../src/pfd/AirspeedTape.svelte';
import { arcBandsFromConfig } from '../src/pfd/airspeed-arcs';

afterEach(() => {
	cleanup();
});

// Synthetic arcs (km/s -> kt math is verified separately). The tape only
// cares that arc-band coords are finite numbers.
const arcs = arcBandsFromConfig({
	vS0: 20,
	vS1: 22,
	vFe: 35,
	vNo: 60,
	vNe: 80,
} as Parameters<typeof arcBandsFromConfig>[0]);

function tapeOffset(container: HTMLElement): number {
	// First g[transform="translate(...)"] is the scrolling tape inner group.
	const g = container.querySelector<SVGGElement>('g[transform^="translate"]');
	const m = (g?.getAttribute('transform') ?? '').match(/translate\(0\s+([-\d.]+)\)/);
	return m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
}

describe('PFD AirspeedTape', () => {
	it('renders an svg with role="img" and a knots-bearing aria-label', () => {
		const { container } = render(AirspeedTape, { airspeedKnots: 80, arcs });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')?.toLowerCase()).toContain('knots');
		expect(svg?.getAttribute('aria-label')).toContain('80');
	});

	it('translates the scrolling tape by airspeed * 3 px/kt', () => {
		const { container } = render(AirspeedTape, { airspeedKnots: 60, arcs });
		// Per the component PIXELS_PER_KT = 3, so 60 kt -> 180 px.
		expect(tapeOffset(container)).toBeCloseTo(180, 5);
	});

	it('clamps airspeeds < 0 to 0 (no negative offset)', () => {
		const { container } = render(AirspeedTape, { airspeedKnots: -50, arcs });
		expect(tapeOffset(container)).toBe(0);
	});

	it('treats non-finite airspeed as 0', () => {
		const { container } = render(AirspeedTape, { airspeedKnots: Number.NaN, arcs });
		expect(tapeOffset(container)).toBe(0);
	});

	it('shows the airspeed digit in the centerline readout', () => {
		const { container } = render(AirspeedTape, { airspeedKnots: 95, arcs });
		expect(container.textContent ?? '').toContain('95');
	});

	it('renders all four arc band shapes (white / green / yellow / redline)', () => {
		const { container } = render(AirspeedTape, { airspeedKnots: 60, arcs });
		expect(container.querySelector('.band-white')).not.toBeNull();
		expect(container.querySelector('.band-green')).not.toBeNull();
		expect(container.querySelector('.band-yellow')).not.toBeNull();
		expect(container.querySelector('.redline')).not.toBeNull();
	});
});
