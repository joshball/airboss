<script lang="ts">
/**
 * Weather panel -- shows the scenario-configured wind vector plus headwind
 * and crosswind components resolved onto the aircraft's current heading.
 */

import type { ScenarioWind } from '@ab/bc-sim';
import { SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';

let {
	wind,
	aircraftHeadingDeg = 0,
}: {
	wind: ScenarioWind;
	aircraftHeadingDeg?: number;
} = $props();

const windSpeedKt = $derived(Number.isFinite(wind.speedKnots) ? wind.speedKnots : 0);

/**
 * Wind vector is "FROM" direction. Headwind component is positive when the
 * wind blows toward the aircraft's nose; crosswind is positive from the
 * right of the aircraft.
 */
const componentsKt = $derived.by(() => {
	const relAngleDeg = ((wind.directionDegrees - aircraftHeadingDeg + 540) % 360) - 180;
	const relRad = (relAngleDeg * Math.PI) / 180;
	const hw = windSpeedKt * Math.cos(relRad);
	const xw = windSpeedKt * Math.sin(relRad);
	return { hw, xw };
});

function fmt(v: number): string {
	const rounded = Math.round(v);
	return rounded === 0 ? '0' : rounded > 0 ? `${rounded}` : `${rounded}`;
}

void SIM_KNOTS_PER_METER_PER_SECOND; // keeps the import wired if scenarios ever ship mps
</script>

<section class="wx" aria-label="Wind panel">
	<h3>Weather</h3>
	<dl>
		<dt>WIND</dt>
		<dd>{wind.directionDegrees.toFixed(0).padStart(3, '0')} / {windSpeedKt.toFixed(0)} kt</dd>
		<dt>HDWND</dt>
		<dd>{fmt(componentsKt.hw)} kt</dd>
		<dt>XWND</dt>
		<dd>{fmt(Math.abs(componentsKt.xw))} kt {componentsKt.xw >= 0 ? 'R' : 'L'}</dd>
	</dl>
</section>

<style>
	.wx {
		padding: 0.6rem 0.8rem;
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 6px;
		color: #f5f5f5;
	}

	h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.85rem;
		color: #bbb;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.75rem;
		margin: 0;
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
	}

	dt {
		color: #888;
	}

	dd {
		margin: 0;
	}
</style>
