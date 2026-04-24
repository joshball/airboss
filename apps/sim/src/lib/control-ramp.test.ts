import { SIM_CONTROL_RAMP, SIM_KEYBINDING_ACTIONS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { RampAction } from './control-handler';
import { type RampAxes, tickRamp } from './control-ramp';

const ZERO: RampAxes = { elevator: 0, aileron: 0, rudder: 0, throttle: 0 };

function pressed(...actions: RampAction[]): Set<RampAction> {
	return new Set(actions);
}

describe('tickRamp', () => {
	it('holds steady with no inputs and no deflection', () => {
		const next = tickRamp(ZERO, pressed(), 0.016);
		expect(next).toEqual(ZERO);
	});

	it('ramps elevator toward +1 while ELEVATOR_UP is held', () => {
		const next = tickRamp(ZERO, pressed(SIM_KEYBINDING_ACTIONS.ELEVATOR_UP), 0.1);
		// 0.1 s * (1/0.3 s⁻¹) = 0.333...
		expect(next.elevator).toBeCloseTo(0.1 * SIM_CONTROL_RAMP.PRIMARY_DEFLECT_PER_SEC, 5);
		expect(next.aileron).toBe(0);
	});

	it('reaches full deflection in ~0.3 s under continuous press', () => {
		let state = ZERO;
		const steps = 30;
		for (let i = 0; i < steps; i++) {
			state = tickRamp(state, pressed(SIM_KEYBINDING_ACTIONS.ELEVATOR_UP), 0.01);
		}
		expect(state.elevator).toBeCloseTo(1, 5);
	});

	it('clamps to +1 and does not overshoot', () => {
		const next = tickRamp({ ...ZERO, elevator: 0.95 }, pressed(SIM_KEYBINDING_ACTIONS.ELEVATOR_UP), 1);
		expect(next.elevator).toBe(1);
	});

	it('returns elevator to 0 on release at CENTER rate', () => {
		const next = tickRamp({ ...ZERO, elevator: 1 }, pressed(), 0.05);
		// 0.05 s * (1/0.2 s⁻¹) = 0.25 toward 0 -> 0.75
		expect(next.elevator).toBeCloseTo(1 - 0.05 * SIM_CONTROL_RAMP.PRIMARY_CENTER_PER_SEC, 5);
	});

	it('centers within ~0.2 s after release', () => {
		let state: RampAxes = { ...ZERO, elevator: 1 };
		for (let i = 0; i < 40; i++) {
			state = tickRamp(state, pressed(), 0.005);
		}
		expect(state.elevator).toBe(0);
	});

	it('opposing keys net out to center target (deflect rate)', () => {
		const next = tickRamp(
			{ ...ZERO, aileron: 0.5 },
			pressed(SIM_KEYBINDING_ACTIONS.AILERON_LEFT, SIM_KEYBINDING_ACTIONS.AILERON_RIGHT),
			0.1,
		);
		// Target 0, rate = deflect (not centering, because keys are held).
		expect(next.aileron).toBeCloseTo(0.5 - 0.1 * SIM_CONTROL_RAMP.PRIMARY_DEFLECT_PER_SEC, 5);
	});

	it('throttle ramps up while THROTTLE_UP is held', () => {
		const next = tickRamp(ZERO, pressed(SIM_KEYBINDING_ACTIONS.THROTTLE_UP), 1);
		expect(next.throttle).toBeCloseTo(SIM_CONTROL_RAMP.THROTTLE_PER_SEC, 5);
	});

	it('throttle ramps down while THROTTLE_DOWN is held', () => {
		const next = tickRamp({ ...ZERO, throttle: 0.8 }, pressed(SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN), 0.5);
		expect(next.throttle).toBeCloseTo(0.8 - 0.5 * SIM_CONTROL_RAMP.THROTTLE_PER_SEC, 5);
	});

	it('throttle holds position when no throttle key is pressed', () => {
		const next = tickRamp({ ...ZERO, throttle: 0.6 }, pressed(), 0.5);
		expect(next.throttle).toBe(0.6);
	});

	it('throttle clamps to [0, 1]', () => {
		const high = tickRamp({ ...ZERO, throttle: 0.99 }, pressed(SIM_KEYBINDING_ACTIONS.THROTTLE_UP), 10);
		expect(high.throttle).toBe(1);
		const low = tickRamp({ ...ZERO, throttle: 0.01 }, pressed(SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN), 10);
		expect(low.throttle).toBe(0);
	});

	it('throttle opposing keys hold position', () => {
		const next = tickRamp(
			{ ...ZERO, throttle: 0.5 },
			pressed(SIM_KEYBINDING_ACTIONS.THROTTLE_UP, SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN),
			1,
		);
		expect(next.throttle).toBe(0.5);
	});

	it('negative dt is treated as 0 (no motion)', () => {
		const next = tickRamp({ ...ZERO, elevator: 0.5 }, pressed(SIM_KEYBINDING_ACTIONS.ELEVATOR_UP), -0.1);
		expect(next.elevator).toBe(0.5);
	});

	it('rudder behaves like other primary axes (centers on release)', () => {
		let state: RampAxes = { ...ZERO, rudder: -0.7 };
		for (let i = 0; i < 50; i++) {
			state = tickRamp(state, pressed(), 0.005);
		}
		expect(state.rudder).toBe(0);
	});
});
