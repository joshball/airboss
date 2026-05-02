/**
 * Altimeter DOM contract -- the gauge renders a labelled `<svg role="img">`,
 * the digital readout reflects the prop, and the three needles each rotate
 * by the angle the helper math demands. Pin the rotation contract so a
 * regression in the angle calculation surfaces as a test failure rather
 * than a manual visual review.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Altimeter from '../src/cockpit-panel/Altimeter.svelte';

afterEach(() => {
	cleanup();
});

function renderAltimeter(altitudeFeet: number) {
	return render(Altimeter, { altitudeFeet });
}

function transformAngles(container: HTMLElement): number[] {
	// Each needle / pointer sits inside a `<g transform="rotate(<deg> 100 100)">`.
	const groups = Array.from(container.querySelectorAll<SVGGElement>('g[transform]'));
	return groups.map((g) => {
		const t = g.getAttribute('transform') ?? '';
		const m = t.match(/rotate\(([-\d.]+)\s+/);
		return m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
	});
}

describe('Altimeter', () => {
	it('renders an svg with role="img" and a labelled aria-label', () => {
		const { container } = renderAltimeter(2500);
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')).toContain('2500');
		expect(svg?.getAttribute('aria-label')?.toLowerCase()).toContain('feet');
	});

	it('digital readout reflects the rounded altitude prop', () => {
		const { container } = renderAltimeter(3475);
		const text = container.textContent ?? '';
		expect(text).toContain('3475');
	});

	it('rotates the hundreds needle proportionally to (alt mod 1000)', () => {
		// 2500 ft -> hundreds rotation = (500 / 1000) * 360 = 180 deg
		const { container } = renderAltimeter(2500);
		const angles = transformAngles(container);
		// Three rotated groups: ten-thousands, thousands, hundreds.
		expect(angles).toHaveLength(3);
		// Hundreds (last group in render order) should be 180.
		const hundreds = angles[2];
		expect(hundreds).toBeCloseTo(180, 5);
	});

	it('thousands needle wraps within (alt mod 10_000) / 10_000', () => {
		// 12_500 ft: hundreds 180 deg, thousands (2500/10000)*360 = 90 deg.
		const { container } = renderAltimeter(12_500);
		const angles = transformAngles(container);
		expect(angles[1]).toBeCloseTo(90, 5);
		expect(angles[2]).toBeCloseTo(180, 5);
	});

	it('treats non-finite altitude as 0 (no NaN propagates into transforms)', () => {
		const { container } = render(Altimeter, { altitudeFeet: Number.NaN });
		const angles = transformAngles(container);
		for (const a of angles) {
			expect(Number.isFinite(a)).toBe(true);
			expect(a).toBe(0);
		}
	});

	it('renders 10 hundreds-scale tick labels (0..9)', () => {
		const { container } = renderAltimeter(0);
		const tickLabels = Array.from(container.querySelectorAll('text.tick-label')).map((t) => t.textContent?.trim());
		// 0..9 inclusive.
		expect(tickLabels).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
	});
});
