/**
 * Keyboard-to-control-input mapping. Pure and dispatch-free: given a key
 * event plus current `FdmInputs`, returns either a new input patch, a
 * special action token, or null (no match). Callers take the returned
 * patch and post it to the FDM worker.
 *
 * The tap-based model means every keypress yields a single discrete
 * increment. Holding a key relies on OS-level key autorepeat; each
 * repeat event fires another call through here.
 */

import type { FdmInputs } from '@ab/bc-sim';
import {
	SIM_CONTROL_INCREMENTS,
	SIM_FLAP_NOTCHES,
	SIM_KEYBINDING_ACTIONS,
	SIM_KEYBINDINGS,
	type SimFlapDegrees,
	type SimKeybindingAction,
} from '@ab/constants';

export type SpecialAction =
	| typeof SIM_KEYBINDING_ACTIONS.BRAKE_TOGGLE
	| typeof SIM_KEYBINDING_ACTIONS.PAUSE
	| typeof SIM_KEYBINDING_ACTIONS.RESET
	| typeof SIM_KEYBINDING_ACTIONS.RESET_IMMEDIATE
	| typeof SIM_KEYBINDING_ACTIONS.HELP_TOGGLE
	| typeof SIM_KEYBINDING_ACTIONS.MUTE_TOGGLE;

export interface ControlResolution {
	/** Partial input update to apply. */
	patch?: Partial<FdmInputs>;
	/** Toggle auto-coordinate (separate from patch -- engine method). */
	toggleAutoCoordinate?: boolean;
	/** System action that the caller handles (pause, reset, help, mute). */
	special?: SpecialAction;
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

function matchAction(event: KeyboardEvent): SimKeybindingAction | null {
	for (const binding of SIM_KEYBINDINGS) {
		if (!binding.keys.includes(event.key)) continue;
		if (typeof binding.shift === 'boolean' && binding.shift !== event.shiftKey) continue;
		return binding.action;
	}
	return null;
}

function nextFlap(current: SimFlapDegrees, direction: 1 | -1): SimFlapDegrees {
	const idx = SIM_FLAP_NOTCHES.indexOf(current);
	const next = clamp(idx + direction, 0, SIM_FLAP_NOTCHES.length - 1);
	return SIM_FLAP_NOTCHES[next];
}

/** Resolve a keyboard event against current input state. */
export function resolveKey(event: KeyboardEvent, inputs: FdmInputs): ControlResolution | null {
	const action = matchAction(event);
	if (action === null) return null;

	const step = SIM_CONTROL_INCREMENTS.PRIMARY;
	const trimStep = SIM_CONTROL_INCREMENTS.TRIM;

	switch (action) {
		case SIM_KEYBINDING_ACTIONS.ELEVATOR_UP:
			return { patch: { elevator: clamp(inputs.elevator + step, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.ELEVATOR_DOWN:
			return { patch: { elevator: clamp(inputs.elevator - step, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.ELEVATOR_CENTER:
			return { patch: { elevator: 0 } };
		case SIM_KEYBINDING_ACTIONS.TRIM_DOWN:
			return { patch: { trim: clamp(inputs.trim - trimStep, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.TRIM_UP:
			return { patch: { trim: clamp(inputs.trim + trimStep, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.AILERON_LEFT:
			return { patch: { aileron: clamp(inputs.aileron - step, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.AILERON_RIGHT:
			return { patch: { aileron: clamp(inputs.aileron + step, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.AILERON_CENTER:
			return { patch: { aileron: 0 } };
		case SIM_KEYBINDING_ACTIONS.RUDDER_LEFT:
			return { patch: { rudder: clamp(inputs.rudder - step, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.RUDDER_RIGHT:
			return { patch: { rudder: clamp(inputs.rudder + step, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.RUDDER_CENTER:
			return { patch: { rudder: 0 } };
		case SIM_KEYBINDING_ACTIONS.THROTTLE_UP:
			return { patch: { throttle: clamp(inputs.throttle + step, 0, 1) } };
		case SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN:
			return { patch: { throttle: clamp(inputs.throttle - step, 0, 1) } };
		case SIM_KEYBINDING_ACTIONS.THROTTLE_IDLE:
			return { patch: { throttle: 0 } };
		case SIM_KEYBINDING_ACTIONS.THROTTLE_FULL:
			return { patch: { throttle: 1 } };
		case SIM_KEYBINDING_ACTIONS.FLAPS_DOWN:
			return { patch: { flaps: nextFlap(inputs.flaps, 1) } };
		case SIM_KEYBINDING_ACTIONS.FLAPS_UP:
			return { patch: { flaps: nextFlap(inputs.flaps, -1) } };
		case SIM_KEYBINDING_ACTIONS.BRAKE_TOGGLE:
			return { special: action };
		case SIM_KEYBINDING_ACTIONS.PAUSE:
		case SIM_KEYBINDING_ACTIONS.RESET:
		case SIM_KEYBINDING_ACTIONS.RESET_IMMEDIATE:
		case SIM_KEYBINDING_ACTIONS.HELP_TOGGLE:
		case SIM_KEYBINDING_ACTIONS.MUTE_TOGGLE:
			return { special: action };
		default: {
			const _never: never = action;
			void _never;
			return null;
		}
	}
}
