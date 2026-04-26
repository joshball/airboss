<script lang="ts">
/**
 * Control input host. Pure prop-driven component: reads keyboard events,
 * resolves them through the shared `control-handler` / `control-ramp`
 * helpers, and emits commanded input patches via callback props.
 *
 * Loose-coupling contract (see ADR 015):
 * - No worker host, no scenario lookup, no audio cue dispatch, no gauge
 *   imports. Drop into any page that hosts an FDM worker; the page wires
 *   `oninput` to a `SIM_WORKER_MESSAGES.INPUT` postMessage and the
 *   component handles the rest.
 * - The component reads the current `inputs` snapshot through a prop so
 *   relative computations (trim clamp, next flap detent, ramp current
 *   axes) stay in sync with the worker's view of the world.
 * - System-level actions (pause, reset, help, mute, brake toggle, auto-
 *   coordinate) are emitted as separate callbacks so the page owns the
 *   product behaviour for each. The component never assumes a particular
 *   surface composition.
 * - Lifecycle clean: keyboard listeners attach in `onMount`, detach in
 *   `onDestroy`. The rAF ramp loop is cancelled on teardown. Window-blur
 *   releases all held ramp keys so a tab switch does not leave an axis
 *   stuck at full deflection.
 *
 * Renders nothing visible; pure behaviour host.
 */

import type { FdmInputs } from '@ab/bc-sim';
import { onDestroy, onMount } from 'svelte';
import { browser } from '$app/environment';
import { type RampAction, resolveKey, resolveRampAction, type SpecialAction } from '$lib/control-handler';
import { tickRamp } from '$lib/control-ramp';

interface Props {
	/**
	 * Current commanded inputs as of the latest worker SNAPSHOT. The
	 * component reads relative quantities off this (trim, flaps, axis
	 * positions for the ramp) so it stays consistent with the worker.
	 */
	inputs: FdmInputs;
	/**
	 * Master enable. When false the component ignores keyboard events and
	 * stops the ramp loop. Used by the cockpit's "Keyboard controls active"
	 * toggle so screen-reader users can disable Shift/Ctrl chords.
	 */
	enabled?: boolean;
	/** Emit a partial input patch to send to the worker. */
	oninput: (patch: Partial<FdmInputs>) => void;
	/** Emit a system-level action (pause / reset / help / mute / brake). */
	onspecial?: (action: SpecialAction) => void;
	/** Emit an auto-coordinate toggle request. */
	ontoggleAutoCoordinate?: () => void;
	/**
	 * Emit a "first user gesture" notification on the first keydown that
	 * resolves to an action. Pages can use this to unlock WebAudio sources.
	 */
	onfirstgesture?: () => void;
	/**
	 * Optional intercept hook called before the component dispatches a
	 * keydown. Returning true tells the component to skip its own handling
	 * (the page already consumed the event -- e.g. a modal overlay caught
	 * Escape, a confirm dialog caught Y). Returning false (default) lets
	 * the component process the event normally.
	 */
	intercept?: (event: KeyboardEvent) => boolean;
}

let { inputs, enabled = true, oninput, onspecial, ontoggleAutoCoordinate, onfirstgesture, intercept }: Props = $props();

const pressedActions = new Set<RampAction>();
let rampFrame: number | null = null;
let lastRampTs = 0;

function fireFirstGesture(): void {
	onfirstgesture?.();
}

function onKeyDown(event: KeyboardEvent): void {
	if (!enabled) return;
	if (intercept?.(event)) return;

	const rampAction = resolveRampAction(event);
	if (rampAction !== null) {
		event.preventDefault();
		fireFirstGesture();
		pressedActions.add(rampAction);
		return;
	}

	// Block OS-level autorepeat from spamming tap-based actions (trim, flaps).
	if (event.repeat) return;

	const resolution = resolveKey(event, inputs);
	if (!resolution) return;
	event.preventDefault();
	fireFirstGesture();

	if (resolution.patch) {
		oninput(resolution.patch);
	}
	if (resolution.toggleAutoCoordinate) {
		ontoggleAutoCoordinate?.();
	}
	if (resolution.special) {
		onspecial?.(resolution.special);
	}
}

function onKeyUp(event: KeyboardEvent): void {
	const rampAction = resolveRampAction(event);
	if (rampAction === null) return;
	pressedActions.delete(rampAction);
	event.preventDefault();
}

function releaseAllRampKeys(): void {
	pressedActions.clear();
}

function tickInputs(ts: number): void {
	if (lastRampTs === 0) lastRampTs = ts;
	const dt = Math.min(0.1, (ts - lastRampTs) / 1000);
	lastRampTs = ts;

	const next = tickRamp(
		{
			elevator: inputs.elevator,
			aileron: inputs.aileron,
			rudder: inputs.rudder,
			throttle: inputs.throttle,
		},
		pressedActions,
		dt,
	);

	const patch: Partial<FdmInputs> = {};
	let changed = false;
	if (next.elevator !== inputs.elevator) {
		patch.elevator = next.elevator;
		changed = true;
	}
	if (next.aileron !== inputs.aileron) {
		patch.aileron = next.aileron;
		changed = true;
	}
	if (next.rudder !== inputs.rudder) {
		patch.rudder = next.rudder;
		changed = true;
	}
	if (next.throttle !== inputs.throttle) {
		patch.throttle = next.throttle;
		changed = true;
	}

	if (changed) {
		oninput(patch);
	}

	rampFrame = requestAnimationFrame(tickInputs);
}

onMount(() => {
	if (!browser) return;
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	window.addEventListener('blur', releaseAllRampKeys);

	lastRampTs = 0;
	rampFrame = requestAnimationFrame(tickInputs);
});

onDestroy(() => {
	if (!browser) return;
	window.removeEventListener('keydown', onKeyDown);
	window.removeEventListener('keyup', onKeyUp);
	window.removeEventListener('blur', releaseAllRampKeys);
	if (rampFrame !== null) cancelAnimationFrame(rampFrame);
	rampFrame = null;
	pressedActions.clear();
});
</script>
