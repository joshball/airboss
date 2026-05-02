/**
 * PFD AttitudeIndicator DOM contract -- aria-label reports both pitch and
 * roll; the rotating world group has `rotate({-rollDeg} ...)` and a
 * `translate(0 {pitchDeg * 2.4})`; the bank pointer rotates by `rollDeg`.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PfdAttitudeIndicator from '../src/pfd/AttitudeIndicator.svelte';

afterEach(() => {
	cleanup();
});

describe('PFD AttitudeIndicator', () => {
	it('renders an svg with role="img" and a pitch + bank aria-label', () => {
		const { container } = render(PfdAttitudeIndicator, { pitchDeg: 5, rollDeg: -10 });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')).toMatch(/pitch/i);
		expect(svg?.getAttribute('aria-label')).toMatch(/bank/i);
	});

	it('rotates the horizon world by -rollDeg (right bank rotates world CCW)', () => {
		const { container } = render(PfdAttitudeIndicator, { pitchDeg: 0, rollDeg: 30 });
		// First g[transform*=rotate]: the inner world group inside the clip path.
		const groups = Array.from(container.querySelectorAll<SVGGElement>('g[transform*="rotate"]'));
		const worldGroup = groups[0];
		const m = (worldGroup?.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)/);
		const angle = m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
		expect(angle).toBeCloseTo(-30, 5);
	});

	it('translates the horizon group by pitchDeg * 2.4 px/deg', () => {
		const { container } = render(PfdAttitudeIndicator, { pitchDeg: 10, rollDeg: 0 });
		const groups = Array.from(container.querySelectorAll<SVGGElement>('g[transform*="translate"]'));
		// Last group with a translate is the inner world group (after rotate).
		const worldGroup = groups[groups.length - 1];
		const m = (worldGroup?.getAttribute('transform') ?? '').match(/translate\(0\s+([-\d.]+)\)/);
		const dy = m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
		expect(dy).toBeCloseTo(24, 5);
	});

	it('non-finite pitch / roll never inject NaN into transforms', () => {
		const { container } = render(PfdAttitudeIndicator, {
			pitchDeg: Number.NaN,
			rollDeg: Number.POSITIVE_INFINITY,
		});
		expect(container.innerHTML).not.toMatch(/NaN/);
		expect(container.innerHTML).not.toMatch(/Infinity/);
	});
});
