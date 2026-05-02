/**
 * VSI DOM contract -- pointer position depends on fpm; aria-label reports
 * the value. Real VSIs sweep CCW across the top for climb and CW under
 * the bottom for descent; the test pins the linear mapping to angle.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Vsi from '../src/cockpit-panel/Vsi.svelte';

afterEach(() => {
	cleanup();
});

describe('cockpit Vsi', () => {
	it('renders an svg with role="img"', () => {
		const { container } = render(Vsi, { fpm: 0 });
		expect(container.querySelector('svg')?.getAttribute('role')).toBe('img');
	});

	it('clamps |fpm| > 2000 at the rail', () => {
		// Verifies the pointer angle stays at the +2000 rail when input
		// is well past the scale; we read the pointer's rotated `<g>`.
		// Component formula: 270 + (clamped/2000) * 180 -> 5000 clamps to 2000
		// -> 270 + 180 = 450 (which renders at the 3 o'clock position via
		// the top of the dial; 450 mod 360 = 90 visually).
		const { container } = render(Vsi, { fpm: 5000 });
		const g = container.querySelector<SVGGElement>('g[transform*="rotate"]');
		const m = (g?.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)/);
		const angle = m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
		expect(angle).toBeCloseTo(450, 5);
	});

	it('aligns the pointer at 270 deg when fpm = 0', () => {
		const { container } = render(Vsi, { fpm: 0 });
		const g = container.querySelector<SVGGElement>('g[transform*="rotate"]');
		const m = (g?.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)/);
		const angle = m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
		expect(angle).toBeCloseTo(270, 5);
	});

	it('treats non-finite fpm as 0', () => {
		const { container } = render(Vsi, { fpm: Number.NaN });
		const g = container.querySelector<SVGGElement>('g[transform*="rotate"]');
		const m = (g?.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)/);
		const angle = m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
		expect(angle).toBeCloseTo(270, 5);
	});
});
