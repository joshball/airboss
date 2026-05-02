/**
 * Tachometer DOM contract -- needle rotates linearly between 0 and 3000
 * RPM, clamped at the rails. The numeric readout reflects the prop.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Tachometer from '../src/cockpit-panel/Tachometer.svelte';

afterEach(() => {
	cleanup();
});

function needleRotation(container: HTMLElement): number {
	const groups = Array.from(container.querySelectorAll<SVGGElement>('g[transform*="rotate"]'));
	const lastWithLine = [...groups].reverse().find((g) => g.querySelector('line'));
	if (!lastWithLine) return Number.NaN;
	const m = (lastWithLine.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)/);
	return m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
}

describe('cockpit Tachometer', () => {
	it('renders an svg', () => {
		const { container } = render(Tachometer, { rpm: 2200 });
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('clamps below 0 RPM at MIN_ANGLE (-150 deg)', () => {
		const { container } = render(Tachometer, { rpm: -500 });
		expect(needleRotation(container)).toBeCloseTo(-150, 5);
	});

	it('clamps above 3000 RPM at MAX_ANGLE (150 deg)', () => {
		const { container } = render(Tachometer, { rpm: 5000 });
		expect(needleRotation(container)).toBeCloseTo(150, 5);
	});

	it('1500 RPM is at the midpoint (0 deg)', () => {
		const { container } = render(Tachometer, { rpm: 1500 });
		expect(needleRotation(container)).toBeCloseTo(0, 5);
	});

	it('shows the RPM as digital text inside the gauge', () => {
		const { container } = render(Tachometer, { rpm: 2300 });
		expect(container.textContent ?? '').toContain('2300');
	});
});
