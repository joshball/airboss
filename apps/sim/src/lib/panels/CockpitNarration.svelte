<script lang="ts">
/**
 * Off-screen a11y narration. Updates an aria-live="polite" region
 * once per second with the cockpit's most important state. Screen
 * readers announce changes; sighted users see nothing.
 *
 * Coverage prioritises the values a pilot would call out on a
 * cross-check: airspeed, altitude, heading, vertical speed, attitude,
 * RPM, then any active annunciators.
 *
 * Single-line summary intentionally -- a long live-region update
 * stutters screen-reader output. The message rebuilds from current
 * display state so the reader always speaks the latest snapshot.
 */

import { annunciatorState, C172_CONFIG, type DisplayState } from '@ab/bc-sim';
import { SIM_FEET_PER_METER, SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';
import { onDestroy, onMount } from 'svelte';

interface Props {
	display: DisplayState | null;
	/** How often to refresh the live region (ms). 1 Hz by default. */
	intervalMs?: number;
}

let { display, intervalMs = 1000 }: Props = $props();

let message = $state('');
let timer: ReturnType<typeof setInterval> | null = null;

function rebuild(): void {
	if (display === null) {
		message = '';
		return;
	}
	const kias = (display.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND).toFixed(0);
	const altFt = (display.altitudeMsl * SIM_FEET_PER_METER).toFixed(0);
	const hdgDeg = (((display.headingIndicated * 180) / Math.PI + 360) % 360).toFixed(0);
	const vsiFpm = (display.verticalSpeed * SIM_FEET_PER_METER * 60).toFixed(0);
	const pitchDeg = ((display.pitchIndicated * 180) / Math.PI).toFixed(0);
	const rollDeg = ((display.rollIndicated * 180) / Math.PI).toFixed(0);
	const rpm = display.engineRpm.toFixed(0);
	const annunciators = annunciatorState(display, C172_CONFIG);
	const active = [
		annunciators.lowVoltage ? 'low voltage' : '',
		annunciators.lowFuel ? 'low fuel' : '',
		annunciators.oilPress ? 'oil pressure' : '',
		annunciators.oilTemp ? 'oil temperature' : '',
		annunciators.vacuumLow ? 'vacuum low' : '',
		display.stallWarning && !display.stalled ? 'stall warning' : '',
		display.stalled ? 'stalled' : '',
	].filter(Boolean);
	const annPhrase = active.length === 0 ? '' : `; annunciators: ${active.join(', ')}`;
	message = `Airspeed ${kias} knots, altitude ${altFt} feet, heading ${hdgDeg} degrees, climb ${vsiFpm} feet per minute, pitch ${pitchDeg} degrees, roll ${rollDeg} degrees, ${rpm} RPM${annPhrase}.`;
}

onMount(() => {
	rebuild();
	timer = setInterval(rebuild, intervalMs);
});

onDestroy(() => {
	if (timer !== null) {
		clearInterval(timer);
		timer = null;
	}
});
</script>

<!-- visually-hidden live region; screen readers announce changes -->
<div class="sr-only" aria-live="polite" aria-atomic="true">{message}</div>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
