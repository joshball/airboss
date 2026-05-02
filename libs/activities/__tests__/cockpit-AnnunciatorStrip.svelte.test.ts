/**
 * AnnunciatorStrip DOM contract -- five lamps render as `<span class="lamp">`,
 * each toggling the `on` class when its predicate fires. The strip is a
 * status region (role=status) so screen readers announce changes.
 */

import type { DisplayState } from '@ab/bc-sim';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AnnunciatorStrip from '../src/cockpit-panel/AnnunciatorStrip.svelte';

afterEach(() => {
	cleanup();
});

function makeDisplay(overrides: Partial<DisplayState> = {}): DisplayState {
	return {
		indicatedAirspeed: 0,
		altitudeMsl: 0,
		verticalSpeed: 0,
		pitchIndicated: 0,
		rollIndicated: 0,
		headingIndicated: 0,
		yawRateIndicated: 0,
		slipBall: 0,
		alpha: 0,
		stallWarning: false,
		stalled: false,
		engineRpm: 800,
		flapsDegrees: 0,
		electricBusVolts: 28,
		onGround: true,
		t: 0,
		oilPressurePsi: 60,
		oilTempCelsius: 95,
		fuelLeftGallons: 26,
		fuelRightGallons: 26,
		ammeterAmps: 3,
		vacuumInHg: 5,
		...overrides,
	};
}

describe('AnnunciatorStrip', () => {
	it('renders nothing when display is null (returns no lamps)', () => {
		const { container } = render(AnnunciatorStrip, { display: null });
		const lamps = container.querySelectorAll('.lamp');
		// All five lamp elements still mount, but none should be `on`.
		expect(lamps.length).toBe(5);
		for (const lamp of lamps) {
			expect(lamp.classList.contains('on')).toBe(false);
		}
	});

	it('renders the status region with role=status and a label', () => {
		const { container } = render(AnnunciatorStrip, { display: makeDisplay() });
		const strip = container.querySelector('[role="status"]');
		expect(strip).not.toBeNull();
		expect(strip?.getAttribute('aria-label')).toMatch(/annunciator/i);
	});

	it('all-clear: lamps render but none are `on`', () => {
		const { container } = render(AnnunciatorStrip, { display: makeDisplay() });
		const onLamps = container.querySelectorAll('.lamp.on');
		expect(onLamps.length).toBe(0);
	});

	it('low fuel lights the LOW FUEL lamp', () => {
		const { container } = render(AnnunciatorStrip, {
			display: makeDisplay({ fuelLeftGallons: 0.5, fuelRightGallons: 26 }),
		});
		const lamps = Array.from(container.querySelectorAll('.lamp'));
		const lowFuel = lamps.find((l) => (l.textContent ?? '').includes('LOW FUEL'));
		expect(lowFuel?.classList.contains('on')).toBe(true);
	});

	it('low voltage lights the LOW VOLTS lamp', () => {
		const { container } = render(AnnunciatorStrip, {
			display: makeDisplay({ electricBusVolts: 10 }),
		});
		const lamps = Array.from(container.querySelectorAll('.lamp'));
		const lowVolts = lamps.find((l) => (l.textContent ?? '').includes('LOW VOLTS'));
		expect(lowVolts?.classList.contains('on')).toBe(true);
	});

	it('renders all five expected lamp labels in order', () => {
		const { container } = render(AnnunciatorStrip, { display: makeDisplay() });
		const labels = Array.from(container.querySelectorAll('.lamp')).map((l) => l.textContent?.trim());
		expect(labels).toEqual(['LOW VOLTS', 'LOW FUEL', 'OIL PRESS', 'OIL TEMP', 'VAC LOW']);
	});
});
