/**
 * Frame-rate-aware ramp for spring-centered primary controls and
 * hold-to-adjust throttle.
 *
 * Elevator, aileron, rudder:
 *   - A direction key held -> target = +/-1, axis ramps at PRIMARY_DEFLECT_PER_SEC
 *   - No key held         -> target = 0, axis returns at PRIMARY_CENTER_PER_SEC
 *   - Both opposing keys held -> net target = 0, ramps at deflect rate
 *
 * Throttle:
 *   - Shift held  -> throttle += THROTTLE_PER_SEC * dt
 *   - Ctrl held   -> throttle -= THROTTLE_PER_SEC * dt
 *   - Neither     -> throttle holds position (no self-centering)
 *
 * `tickRamp` is called by the cockpit every animation frame. Discrete
 * snap actions (X/C/Z to center, 0/9 for idle/full, trim, flaps) bypass
 * this path and go straight through `resolveKey`.
 */

import { SIM_CONTROL_RAMP, SIM_KEYBINDING_ACTIONS } from '@ab/constants';
import type { RampAction } from './control-handler';

export interface RampAxes {
	elevator: number;
	aileron: number;
	rudder: number;
	throttle: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

function stepToward(current: number, target: number, ratePerSec: number, dt: number): number {
	const delta = target - current;
	const maxStep = ratePerSec * dt;
	if (delta > maxStep) return current + maxStep;
	if (delta < -maxStep) return current - maxStep;
	return target;
}

interface AxisTarget {
	target: -1 | 0 | 1;
	centering: boolean;
}

function axisTarget(negative: boolean, positive: boolean): AxisTarget {
	if (negative && !positive) return { target: -1, centering: false };
	if (positive && !negative) return { target: 1, centering: false };
	return { target: 0, centering: !negative && !positive };
}

/**
 * Advance each axis one frame based on currently-held ramp actions.
 * Returns the new axis values; the page diffs against the prior frame and
 * posts a minimal patch to the worker.
 */
export function tickRamp(current: RampAxes, pressed: ReadonlySet<RampAction>, dtSeconds: number): RampAxes {
	const dt = Math.max(0, dtSeconds);

	const elev = axisTarget(
		pressed.has(SIM_KEYBINDING_ACTIONS.ELEVATOR_DOWN),
		pressed.has(SIM_KEYBINDING_ACTIONS.ELEVATOR_UP),
	);
	const ail = axisTarget(
		pressed.has(SIM_KEYBINDING_ACTIONS.AILERON_LEFT),
		pressed.has(SIM_KEYBINDING_ACTIONS.AILERON_RIGHT),
	);
	const rud = axisTarget(
		pressed.has(SIM_KEYBINDING_ACTIONS.RUDDER_LEFT),
		pressed.has(SIM_KEYBINDING_ACTIONS.RUDDER_RIGHT),
	);

	const rateFor = (t: AxisTarget): number =>
		t.centering ? SIM_CONTROL_RAMP.PRIMARY_CENTER_PER_SEC : SIM_CONTROL_RAMP.PRIMARY_DEFLECT_PER_SEC;

	const elevator = stepToward(current.elevator, elev.target, rateFor(elev), dt);
	const aileron = stepToward(current.aileron, ail.target, rateFor(ail), dt);
	const rudder = stepToward(current.rudder, rud.target, rateFor(rud), dt);

	let throttle = current.throttle;
	const up = pressed.has(SIM_KEYBINDING_ACTIONS.THROTTLE_UP);
	const down = pressed.has(SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN);
	if (up && !down) throttle = clamp(throttle + SIM_CONTROL_RAMP.THROTTLE_PER_SEC * dt, 0, 1);
	else if (down && !up) throttle = clamp(throttle - SIM_CONTROL_RAMP.THROTTLE_PER_SEC * dt, 0, 1);

	return { elevator, aileron, rudder, throttle };
}
