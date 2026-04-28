<script lang="ts">
/**
 * PFD shell. Owns the rAF loop, the keyboard handlers, and the grid that
 * mounts the five PFD instruments.
 *
 * Layout follows the conventional G1000-style PFD: airspeed tape on the
 * left, attitude indicator filling the middle, altitude tape and VSI on
 * the right, heading strip across the bottom.
 *
 * V-speeds for the airspeed tape come from the currently selected
 * aircraft's FDM config, converted to knots in `arcBandsFromConfig`.
 *
 * Tick-state field naming note: the rAF loop exposes `bankDeg` and
 * `headingDeg`; the AttitudeIndicator and HeadingIndicator props are
 * `rollDeg` and `headingDegMag` (matching the BC `Attitude` / `NavData`
 * shape). The mapping happens at the prop boundary in this file -- we
 * don't rename the tick state to keep Wave 3's loop untouched.
 */

import { getAircraftConfig } from '@ab/bc-sim';
import type { SimAircraftId } from '@ab/constants';
import AirspeedTape from './AirspeedTape.svelte';
import AltitudeTape from './AltitudeTape.svelte';
import AttitudeIndicator from './AttitudeIndicator.svelte';
import { arcBandsFromConfig } from './airspeed-arcs';
import HeadingIndicator from './HeadingIndicator.svelte';
import PfdInputs from './PfdInputs.svelte';
import PfdKeyboardLegend from './PfdKeyboardLegend.svelte';
import { applyPfdKeyboardEvent, attachPfdTickLoop, DEFAULT_PFD_BINDINGS, PfdTickState } from './pfd-tick.svelte';
import VsiIndicator from './VsiIndicator.svelte';

let {
	selectedAircraftId,
}: {
	selectedAircraftId: SimAircraftId;
} = $props();

const tick = new PfdTickState();
const bindings = DEFAULT_PFD_BINDINGS;
let legendOpen = $state(false);

const HELP_KEY = '?';
const RESET_KEY = '0';

// Arc bands derive from the selected aircraft. When the user picks a
// different aircraft, this re-derives without remounting the tape.
const arcs = $derived(arcBandsFromConfig(getAircraftConfig(selectedAircraftId)));

$effect(() => attachPfdTickLoop(tick));

$effect(() => {
	if (typeof window === 'undefined') return;
	const onKeyDown = (event: KeyboardEvent): void => {
		// Avoid hijacking text input in form fields.
		const target = event.target as HTMLElement | null;
		if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

		if (event.key === HELP_KEY) {
			legendOpen = !legendOpen;
			event.preventDefault();
			return;
		}
		if (event.key === RESET_KEY) {
			tick.resetAll();
			event.preventDefault();
			return;
		}
		if (applyPfdKeyboardEvent(event, bindings, tick)) {
			event.preventDefault();
		}
	};
	window.addEventListener('keydown', onKeyDown);
	return () => window.removeEventListener('keydown', onKeyDown);
});

function closeLegend(): void {
	legendOpen = false;
}
</script>

<div class="pfd-frame" data-aircraft={selectedAircraftId}>
	<div class="pfd-grid" aria-label="Primary Flight Display">
		<div class="pfd-slot slot-asi">
			<AirspeedTape airspeedKnots={tick.rendered.airspeedKnots} {arcs} />
		</div>
		<div class="pfd-slot slot-attitude">
			<AttitudeIndicator pitchDeg={tick.rendered.pitchDeg} rollDeg={tick.rendered.bankDeg} />
		</div>
		<div class="pfd-slot slot-alt">
			<AltitudeTape altitudeFeet={tick.rendered.altitudeFeet} />
		</div>
		<div class="pfd-slot slot-vsi">
			<VsiIndicator verticalSpeedFpm={tick.rendered.verticalSpeedFpm} />
		</div>
		<div class="pfd-slot slot-heading">
			<HeadingIndicator headingDegMag={tick.rendered.headingDeg} />
		</div>
	</div>

	<PfdInputs {bindings} state={tick} onReset={() => tick.resetAll()} />
</div>

<PfdKeyboardLegend
	open={legendOpen}
	{bindings}
	onClose={closeLegend}
	helpKeyLabel={HELP_KEY}
	resetKeyLabel={RESET_KEY}
/>

<style>
	.pfd-frame {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		background: var(--surface-page, var(--surface-panel));
	}

	.pfd-grid {
		display: grid;
		flex: 1;
		min-height: 0;
		grid-template-columns: minmax(120px, 0.18fr) minmax(0, 1fr) minmax(120px, 0.18fr) minmax(80px, 0.1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		grid-template-areas:
			'asi attitude alt vsi'
			'heading heading heading heading';
		gap: var(--space-2xs);
		padding: var(--space-sm);
		background: var(--surface-sunken);
	}

	.pfd-slot {
		display: flex;
		align-items: stretch;
		justify-content: stretch;
		min-height: 0;
		min-width: 0;
	}

	.slot-asi {
		grid-area: asi;
	}

	.slot-attitude {
		grid-area: attitude;
		min-height: 320px;
	}

	.slot-alt {
		grid-area: alt;
	}

	.slot-vsi {
		grid-area: vsi;
	}

	.slot-heading {
		grid-area: heading;
		min-height: 64px;
	}
</style>
