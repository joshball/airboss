/**
 * ASI (airspeed indicator) DOM contract -- needle rotates linearly between
 * MIN_KIAS and MAX_KIAS, clamped at the rails. The arc bands are derived
 * from the C172 V-speed config; their existence is enough for the DOM
 * contract test (the band-position math is covered by `airspeed-arcs.test.ts`).
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Asi from '../src/cockpit-panel/Asi.svelte';

afterEach(() => {
	cleanup();
});

function needleRotation(container: HTMLElement): number {
	// The needle is the only `<line>` inside a rotated group.
	const groups = Array.from(container.querySelectorAll<SVGGElement>('g[transform*="rotate"]'));
	const lastWithLine = [...groups].reverse().find((g) => g.querySelector('line'));
	if (!lastWithLine) return Number.NaN;
	const m = (lastWithLine.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)/);
	return m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
}

describe('cockpit Asi', () => {
	it('renders an svg with role="img"', () => {
		const { container } = render(Asi, { kias: 80 });
		expect(container.querySelector('svg')?.getAttribute('role')).toBe('img');
	});

	it('clamps below 40 KIAS to the floor (MIN_ANGLE_DEG)', () => {
		const { container } = render(Asi, { kias: 0 });
		expect(needleRotation(container)).toBeCloseTo(-150, 5);
	});

	it('clamps above 180 KIAS to the ceiling (MAX_ANGLE_DEG)', () => {
		const { container } = render(Asi, { kias: 250 });
		expect(needleRotation(container)).toBeCloseTo(150, 5);
	});

	it('mid-range maps linearly (110 KIAS -> 0 deg)', () => {
		const { container } = render(Asi, { kias: 110 });
		expect(needleRotation(container)).toBeCloseTo(0, 5);
	});

	it('renders the three V-speed arc bands plus a redline element', () => {
		const { container } = render(Asi, { kias: 80 });
		expect(container.querySelector('.arc-white')).not.toBeNull();
		expect(container.querySelector('.arc-green')).not.toBeNull();
		expect(container.querySelector('.arc-yellow')).not.toBeNull();
		expect(container.querySelector('.redline')).not.toBeNull();
	});
});
