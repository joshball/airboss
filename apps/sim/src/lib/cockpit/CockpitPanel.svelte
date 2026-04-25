<script lang="ts">
/**
 * Cockpit instrument panel. Pure prop-driven component: takes the
 * worker's `truth` + `display` snapshots (already structured-clone-safe
 * primitives) and renders the readout bar + six-pack + engine row +
 * annunciator strip.
 *
 * Loose-coupling contract (see ADR 015):
 * - No worker host, no scenario lookup, no audio cue dispatch, no
 *   keyboard input. Drop into any page that produces `truth` + `display`
 *   off the SNAPSHOT message and it renders.
 * - The cockpit page (`/[scenarioId]/+page.svelte`) owns the worker +
 *   controls + audio; it composes this component for the gauge stack.
 * - The dual page (`/[scenarioId]/dual/+page.svelte`) and the upcoming
 *   windowed page (`/[scenarioId]/window/+page.svelte`) drop this
 *   alongside `Horizon3D` to compose the full surface.
 */

import type { DisplayState, FdmTruthState } from '@ab/bc-sim';
import { SIM_FEET_PER_METER, SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';
import Altimeter from '$lib/instruments/Altimeter.svelte';
import Asi from '$lib/instruments/Asi.svelte';
import AttitudeIndicator from '$lib/instruments/AttitudeIndicator.svelte';
import EngineCluster from '$lib/instruments/cluster/EngineCluster.svelte';
import HeadingIndicator from '$lib/instruments/HeadingIndicator.svelte';
import Tachometer from '$lib/instruments/Tachometer.svelte';
import TurnCoordinator from '$lib/instruments/TurnCoordinator.svelte';
import Vsi from '$lib/instruments/Vsi.svelte';
import AnnunciatorStrip from '$lib/panels/AnnunciatorStrip.svelte';

interface Props {
	/** Truth state for AGL + alpha + scenario time readouts. Null before first snapshot. */
	truth: FdmTruthState | null;
	/** Fault-aware display state for every gauge. Null before first snapshot. */
	display: DisplayState | null;
}

let { truth, display }: Props = $props();

// Instruments read from `display` -- the fault-aware view. When no faults
// are active display equals truth field-for-field. AGL is the one out-of-
// truth-only quantity (no fault lies about ground elevation today).
const kias = $derived(display ? display.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND : 0);
const altitudeFeet = $derived(display ? display.altitudeMsl * SIM_FEET_PER_METER : 0);
const altitudeAglFeet = $derived(truth ? (truth.altitude - truth.groundElevation) * SIM_FEET_PER_METER : 0);
const vsiFpm = $derived(display ? display.verticalSpeed * SIM_FEET_PER_METER * 60 : 0);
const pitchRad = $derived(display ? display.pitchIndicated : 0);
const rollRad = $derived(display ? display.rollIndicated : 0);
const headingDeg = $derived(display ? (display.headingIndicated * 180) / Math.PI : 0);
const yawRateDegPerSec = $derived(display ? (display.yawRateIndicated * 180) / Math.PI : 0);
const slipBallValue = $derived(display?.slipBall ?? 0);
const rpm = $derived(display?.engineRpm ?? 0);
const stalled = $derived(display?.stalled ?? false);
const alphaDeg = $derived(truth ? (truth.alpha * 180) / Math.PI : 0);
const tSeconds = $derived(truth?.t ?? 0);
</script>

<section class="cockpit-panel">
	<!-- Readout bar sits above the six-pack: Time over ASI, Alpha / AOA
		 over the attitude indicator, AGL over the altimeter. -->
	<div class="readouts">
		<div class="readout">
			<span class="label">Time</span>
			<span class="value">{tSeconds.toFixed(1)}s</span>
		</div>
		<div class="readout" class:warning={stalled}>
			<span class="label">Alpha / AOA</span>
			<span class="value">{alphaDeg.toFixed(1)}°</span>
		</div>
		<div class="readout">
			<span class="label">AGL</span>
			<span class="value">{altitudeAglFeet.toFixed(0)} ft</span>
		</div>
	</div>
	<div class="row">
		<Asi {kias} />
		<AttitudeIndicator pitchRadians={pitchRad} rollRadians={rollRad} />
		<Altimeter {altitudeFeet} />
	</div>
	<div class="row">
		<TurnCoordinator {yawRateDegPerSec} slipBall={slipBallValue} />
		<HeadingIndicator {headingDeg} />
		<Vsi fpm={vsiFpm} />
	</div>
	<div class="engine-row">
		<Tachometer {rpm} />
		<EngineCluster {display} />
	</div>
	<AnnunciatorStrip {display} />
</section>

<style>
	.cockpit-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.row {
		display: grid;
		grid-template-columns: repeat(3, 200px);
		gap: var(--space-sm);
		justify-content: center;
	}
	.engine-row {
		display: flex;
		justify-content: center;
		gap: var(--space-sm);
	}
	/* Readout bar sits above the six-pack. Width matches the three top-row
	   instruments (3 * 200px + 2 gaps) so Time / Alpha+AOA / AGL line up
	   directly above the ASI / AI / Altimeter column. */
	.readouts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-sm);
		width: calc(200px * 3 + var(--space-sm) * 2);
		margin: 0 auto;
	}
	.readout {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-sm) var(--space-sm);
		background: var(--surface-panel);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-default);
	}
	.readout.warning {
		border-color: var(--sim-arc-red);
		background: var(--sim-readout-warning-bg);
	}
	.readout .label {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}
	.readout .value {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-base);
	}
</style>
