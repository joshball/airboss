/**
 * PFD animation loop.
 *
 * Runs a rAF tick that eases the rendered values toward the targets via
 * a critically-damped low-pass filter, per channel. Targets come from
 * sliders / keyboard input; rendered values feed instrument props. The
 * loop pauses when the tab is hidden (Visibility API) and cancels its
 * rAF on teardown via the `$effect` returned by `attachPfdTickLoop`.
 *
 * Tuning lives in `DEFAULT_PFD_EASING`. Revisions are constants-only
 * commits; component code never inlines these literals.
 *
 * The low-pass shape: with time constant `tau`, the coefficient
 * `alpha = 1 - exp(-dt / tau)` produces a critically-damped follow such
 * that rendered values reach ~63% of the gap to target after `tau`
 * seconds, ~95% after 3*tau, ~99% after 5*tau. No magic numbers in the
 * easing math.
 */

import type { PfdEasingConfig, PfdInputBinding, PfdInputBindings, PfdValues } from './pfd-types';
import { PFD_INPUT_KEYS } from './pfd-types';

/**
 * Default easing tuning. Slow the airspeed and altitude tapes a touch
 * to read like the inertia of an air-data computer; keep attitude and
 * VSI snappy because pilots expect those to follow quickly.
 */
export const DEFAULT_PFD_EASING: PfdEasingConfig = {
	attitude: 0.12,
	airspeed: 0.18,
	altitude: 0.22,
	heading: 0.18,
	verticalSpeed: 0.25,
};

/**
 * Default input bindings -- one per PFD channel. Range, step, default,
 * and key step all come from the spec's Inputs table. Keyboard
 * shortcuts mirror the spec's keyboard table.
 */
export const DEFAULT_PFD_BINDINGS: PfdInputBindings = [
	{
		key: PFD_INPUT_KEYS.PITCH,
		label: 'Pitch',
		unitLabel: 'deg',
		min: -25,
		max: 25,
		step: 0.5,
		default: 0,
		decKeys: ['s', 'S'],
		incKeys: ['w', 'W'],
		keyStep: 1,
		requiresShift: false,
	},
	{
		key: PFD_INPUT_KEYS.BANK,
		label: 'Bank',
		unitLabel: 'deg',
		min: -60,
		max: 60,
		step: 1,
		default: 0,
		decKeys: ['a', 'A'],
		incKeys: ['d', 'D'],
		keyStep: 2,
		requiresShift: false,
	},
	{
		key: PFD_INPUT_KEYS.AIRSPEED,
		label: 'Airspeed',
		unitLabel: 'KIAS',
		min: 0,
		max: 200,
		step: 1,
		default: 100,
		decKeys: ['_', '-'],
		incKeys: ['+', '='],
		keyStep: 10,
		requiresShift: true,
	},
	{
		key: PFD_INPUT_KEYS.ALTITUDE,
		label: 'Altitude',
		unitLabel: 'ft',
		min: 0,
		max: 18_000,
		step: 10,
		default: 3_000,
		decKeys: [','],
		incKeys: ['.'],
		keyStep: 100,
		requiresShift: false,
	},
	{
		key: PFD_INPUT_KEYS.HEADING,
		label: 'Heading',
		unitLabel: 'deg',
		min: 0,
		max: 359,
		step: 1,
		default: 360,
		decKeys: ['q', 'Q'],
		incKeys: ['e', 'E'],
		keyStep: 10,
		requiresShift: false,
	},
	{
		key: PFD_INPUT_KEYS.VERTICAL_SPEED,
		label: 'Vertical Speed',
		unitLabel: 'fpm',
		min: -2_000,
		max: 2_000,
		step: 50,
		default: 0,
		decKeys: ['['],
		incKeys: [']'],
		keyStep: 100,
		requiresShift: false,
	},
];

/** Default starting values for both target and rendered state. */
export const DEFAULT_PFD_VALUES: PfdValues = {
	pitchDeg: 0,
	bankDeg: 0,
	airspeedKnots: 100,
	altitudeFeet: 3_000,
	headingDeg: 360,
	verticalSpeedFpm: 0,
};

/**
 * Smallest positive number used to clamp `dt`. Prevents `1 - exp(0)`
 * from collapsing the filter when two rAF callbacks arrive within the
 * same millisecond (rare but legal when the browser falls behind).
 */
const MIN_DT_SECONDS = 1 / 1000;

/** Cap a frame's `dt` to avoid blowing past the easing on a long pause. */
const MAX_DT_SECONDS = 1 / 15;

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Critically-damped low-pass step. Returns the new rendered value
 * after stepping `dt` seconds toward `target` with time constant `tau`.
 */
function lowPassStep(rendered: number, target: number, dt: number, tau: number): number {
	if (tau <= 0) return target;
	const alpha = 1 - Math.exp(-dt / tau);
	return rendered + (target - rendered) * alpha;
}

/**
 * Heading wraps at 360. Pick the shorter arc so a slider sweep from 350
 * to 10 does not unwind the long way around. Uses signed delta in
 * `[-180, +180]` then steps with the standard low-pass before wrapping
 * the result back into `[0, 360)`.
 */
function lowPassStepHeading(rendered: number, target: number, dt: number, tau: number): number {
	if (tau <= 0) return ((target % 360) + 360) % 360;
	const diff = ((((target - rendered) % 360) + 540) % 360) - 180;
	const alpha = 1 - Math.exp(-dt / tau);
	const next = rendered + diff * alpha;
	return ((next % 360) + 360) % 360;
}

/**
 * Reactive PFD tick state. Two `$state` bags: one for targets (written
 * by inputs), one for rendered values (read by instruments). The rAF
 * loop is owned by `attachPfdTickLoop`, which expects to be called
 * inside an `$effect` inside a component so cleanup runs on navigation.
 */
export class PfdTickState {
	target = $state<PfdValues>({ ...DEFAULT_PFD_VALUES });
	rendered = $state<PfdValues>({ ...DEFAULT_PFD_VALUES });
	easing: PfdEasingConfig;

	constructor(easing: PfdEasingConfig = DEFAULT_PFD_EASING) {
		this.easing = easing;
	}

	/** Reset both target and rendered values to their defaults. */
	resetAll(): void {
		this.target = { ...DEFAULT_PFD_VALUES };
		this.rendered = { ...DEFAULT_PFD_VALUES };
	}

	/** Step the rendered values toward the targets over `dtSeconds`. */
	step(dtSeconds: number): void {
		const dt = clamp(dtSeconds, MIN_DT_SECONDS, MAX_DT_SECONDS);
		const t = this.target;
		const r = this.rendered;
		this.rendered = {
			pitchDeg: lowPassStep(r.pitchDeg, t.pitchDeg, dt, this.easing.attitude),
			bankDeg: lowPassStep(r.bankDeg, t.bankDeg, dt, this.easing.attitude),
			airspeedKnots: lowPassStep(r.airspeedKnots, t.airspeedKnots, dt, this.easing.airspeed),
			altitudeFeet: lowPassStep(r.altitudeFeet, t.altitudeFeet, dt, this.easing.altitude),
			headingDeg: lowPassStepHeading(r.headingDeg, t.headingDeg, dt, this.easing.heading),
			verticalSpeedFpm: lowPassStep(r.verticalSpeedFpm, t.verticalSpeedFpm, dt, this.easing.verticalSpeed),
		};
	}
}

/**
 * Attach the rAF loop to a `PfdTickState`. Call from inside a
 * component's `$effect`; the returned function is the `$effect`
 * cleanup -- it cancels the rAF and detaches the visibility listener.
 *
 * The loop pauses when `document.visibilityState === 'hidden'` and
 * resumes on the next visible event without skipping the easing.
 */
export function attachPfdTickLoop(state: PfdTickState): () => void {
	if (typeof window === 'undefined') {
		// SSR: no rAF available; the component runs the loop on hydration.
		return () => {};
	}

	let rafId = 0;
	let lastTimestampMs = performance.now();

	const onFrame = (timestampMs: number): void => {
		const dt = (timestampMs - lastTimestampMs) / 1000;
		lastTimestampMs = timestampMs;
		state.step(dt);
		rafId = window.requestAnimationFrame(onFrame);
	};

	const start = (): void => {
		if (rafId !== 0) return;
		lastTimestampMs = performance.now();
		rafId = window.requestAnimationFrame(onFrame);
	};

	const stop = (): void => {
		if (rafId === 0) return;
		window.cancelAnimationFrame(rafId);
		rafId = 0;
	};

	const onVisibilityChange = (): void => {
		if (document.visibilityState === 'hidden') {
			stop();
		} else {
			start();
		}
	};

	document.addEventListener('visibilitychange', onVisibilityChange);
	start();

	return () => {
		stop();
		document.removeEventListener('visibilitychange', onVisibilityChange);
	};
}

/**
 * Apply a keyboard nudge to the matching PFD target value. Returns
 * `true` if the event matched a binding (so the caller can call
 * `event.preventDefault()`); otherwise `false`.
 *
 * `bindings` is the binding table; `state` is the tick state whose
 * `target` is mutated. The function ignores key repeats by relying on
 * the OS keydown stream -- each press nudges by `keyStep`.
 */
export function applyPfdKeyboardEvent(event: KeyboardEvent, bindings: PfdInputBindings, state: PfdTickState): boolean {
	for (const binding of bindings) {
		if (event.shiftKey !== binding.requiresShift) continue;
		if (binding.decKeys.includes(event.key)) {
			updateTarget(state, binding.key, -binding.keyStep, binding);
			return true;
		}
		if (binding.incKeys.includes(event.key)) {
			updateTarget(state, binding.key, binding.keyStep, binding);
			return true;
		}
	}
	return false;
}

function updateTarget(state: PfdTickState, key: PfdInputBinding['key'], delta: number, binding: PfdInputBinding): void {
	const next = { ...state.target };
	switch (key) {
		case PFD_INPUT_KEYS.PITCH:
			next.pitchDeg = clamp(next.pitchDeg + delta, binding.min, binding.max);
			break;
		case PFD_INPUT_KEYS.BANK:
			next.bankDeg = clamp(next.bankDeg + delta, binding.min, binding.max);
			break;
		case PFD_INPUT_KEYS.AIRSPEED:
			next.airspeedKnots = clamp(next.airspeedKnots + delta, binding.min, binding.max);
			break;
		case PFD_INPUT_KEYS.ALTITUDE:
			next.altitudeFeet = clamp(next.altitudeFeet + delta, binding.min, binding.max);
			break;
		case PFD_INPUT_KEYS.HEADING: {
			const wrapped = (((next.headingDeg + delta) % 360) + 360) % 360;
			next.headingDeg = wrapped;
			break;
		}
		case PFD_INPUT_KEYS.VERTICAL_SPEED:
			next.verticalSpeedFpm = clamp(next.verticalSpeedFpm + delta, binding.min, binding.max);
			break;
	}
	state.target = next;
}

/** Re-export the binding type for ergonomic local imports. */
export type { PfdInputBinding } from './pfd-types';
