/**
 * Keyboard-to-control-input mapping. Pure and dispatch-free.
 *
 * Two resolution paths share the same keybinding table:
 *
 * - `resolveRampAction` matches keys that drive held/spring-centered axes
 *   (elevator, aileron, rudder, throttle up/down). The caller tracks which
 *   actions are currently held and feeds them to a per-frame ramp.
 * - `resolveKey` handles discrete taps: center/snap commands, trim nudges,
 *   flaps, and system actions (pause, reset, help, mute, brake). Returning
 *   `null` here for a ramp action lets the page route it through the ramp
 *   path instead of applying a one-shot patch.
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

export type RampAction =
	| typeof SIM_KEYBINDING_ACTIONS.ELEVATOR_UP
	| typeof SIM_KEYBINDING_ACTIONS.ELEVATOR_DOWN
	| typeof SIM_KEYBINDING_ACTIONS.AILERON_LEFT
	| typeof SIM_KEYBINDING_ACTIONS.AILERON_RIGHT
	| typeof SIM_KEYBINDING_ACTIONS.RUDDER_LEFT
	| typeof SIM_KEYBINDING_ACTIONS.RUDDER_RIGHT
	| typeof SIM_KEYBINDING_ACTIONS.THROTTLE_UP
	| typeof SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN;

const RAMP_ACTIONS: ReadonlySet<SimKeybindingAction> = new Set<SimKeybindingAction>([
	SIM_KEYBINDING_ACTIONS.ELEVATOR_UP,
	SIM_KEYBINDING_ACTIONS.ELEVATOR_DOWN,
	SIM_KEYBINDING_ACTIONS.AILERON_LEFT,
	SIM_KEYBINDING_ACTIONS.AILERON_RIGHT,
	SIM_KEYBINDING_ACTIONS.RUDDER_LEFT,
	SIM_KEYBINDING_ACTIONS.RUDDER_RIGHT,
	SIM_KEYBINDING_ACTIONS.THROTTLE_UP,
	SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN,
]);

function isRampAction(action: SimKeybindingAction): action is RampAction {
	return RAMP_ACTIONS.has(action);
}

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

/**
 * Match a key event against ramp-driven actions (held primary surfaces +
 * throttle). Returns the action if matched so the caller can track pressed
 * state; returns null for taps/specials which `resolveKey` handles.
 */
export function resolveRampAction(event: KeyboardEvent): RampAction | null {
	const action = matchAction(event);
	if (action === null) return null;
	return isRampAction(action) ? action : null;
}

/**
 * Resolve a keyboard event against current input state for discrete actions.
 * Returns null for ramp-driver keys (callers route those through the ramp).
 */
export function resolveKey(event: KeyboardEvent, inputs: FdmInputs): ControlResolution | null {
	const action = matchAction(event);
	if (action === null) return null;
	if (isRampAction(action)) return null;

	const trimStep = SIM_CONTROL_INCREMENTS.TRIM;

	switch (action) {
		case SIM_KEYBINDING_ACTIONS.ELEVATOR_CENTER:
			return { patch: { elevator: 0 } };
		case SIM_KEYBINDING_ACTIONS.TRIM_DOWN:
			return { patch: { trim: clamp(inputs.trim - trimStep, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.TRIM_UP:
			return { patch: { trim: clamp(inputs.trim + trimStep, -1, 1) } };
		case SIM_KEYBINDING_ACTIONS.AILERON_CENTER:
			return { patch: { aileron: 0 } };
		case SIM_KEYBINDING_ACTIONS.RUDDER_CENTER:
			return { patch: { rudder: 0 } };
		case SIM_KEYBINDING_ACTIONS.THROTTLE_IDLE:
			return { patch: { throttle: 0 } };
		case SIM_KEYBINDING_ACTIONS.THROTTLE_FULL:
			return { patch: { throttle: 1 } };
		case SIM_KEYBINDING_ACTIONS.FLAPS_DOWN:
			return { patch: { flaps: nextFlap(inputs.flaps, 1) } };
		case SIM_KEYBINDING_ACTIONS.FLAPS_UP:
			return { patch: { flaps: nextFlap(inputs.flaps, -1) } };
		case SIM_KEYBINDING_ACTIONS.BRAKE_TOGGLE:
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
