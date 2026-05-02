/**
 * TurnCoordinator DOM contract -- aircraft symbol rotates with yaw rate;
 * standard-rate (3 deg/s) maps to a 20-deg visual rotation; ball position
 * follows `slipBall` clamped to the +/- 1 rail.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TurnCoordinator from '../src/cockpit-panel/TurnCoordinator.svelte';

afterEach(() => {
	cleanup();
});

function symbolRotation(container: HTMLElement): number {
	// First rotated `<g>` is the aircraft symbol.
	const g = container.querySelector<SVGGElement>('g[transform*="rotate"]');
	if (!g) return Number.NaN;
	const m = (g.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)/);
	return m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
}

function ballCx(container: HTMLElement): number {
	const ball = container.querySelector<SVGCircleElement>('circle.ball');
	return Number.parseFloat(ball?.getAttribute('cx') ?? 'NaN');
}

describe('cockpit TurnCoordinator', () => {
	it('renders an svg', () => {
		const { container } = render(TurnCoordinator, { yawRateDegPerSec: 0, slipBall: 0 });
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('zero yaw -> zero symbol rotation', () => {
		const { container } = render(TurnCoordinator, { yawRateDegPerSec: 0, slipBall: 0 });
		expect(symbolRotation(container)).toBeCloseTo(0, 5);
	});

	it('standard rate (3 deg/s) -> 20-deg visual rotation', () => {
		const { container } = render(TurnCoordinator, { yawRateDegPerSec: 3, slipBall: 0 });
		expect(symbolRotation(container)).toBeCloseTo(20, 5);
	});

	it('clamps very high yaw rates to MAX_VISUAL_DEG (40)', () => {
		const { container } = render(TurnCoordinator, { yawRateDegPerSec: 30, slipBall: 0 });
		expect(symbolRotation(container)).toBeCloseTo(40, 5);
	});

	it('clamps very negative yaw rates to -40', () => {
		const { container } = render(TurnCoordinator, { yawRateDegPerSec: -30, slipBall: 0 });
		expect(symbolRotation(container)).toBeCloseTo(-40, 5);
	});

	it('ball cx tracks slipBall (zero slip -> centered)', () => {
		const { container } = render(TurnCoordinator, { yawRateDegPerSec: 0, slipBall: 0 });
		expect(ballCx(container)).toBeCloseTo(100, 5);
	});

	it('ball cx clamps |slipBall| > 1 to the rail', () => {
		const { container } = render(TurnCoordinator, { yawRateDegPerSec: 0, slipBall: 5 });
		// Per BALL_TRAVEL_PX = 22, max cx = 100 + 22 = 122.
		expect(ballCx(container)).toBeCloseTo(122, 5);
	});

	it('treats non-finite yaw / slip as zero (no NaN in DOM)', () => {
		const { container } = render(TurnCoordinator, {
			yawRateDegPerSec: Number.NaN,
			slipBall: Number.POSITIVE_INFINITY,
		});
		expect(container.innerHTML).not.toMatch(/NaN/);
	});
});
