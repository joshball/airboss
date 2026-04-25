<script lang="ts">
/**
 * Engine cluster panel. Five compact gauges plus the fuel bars.
 * Lives next to the Tachometer in the cockpit, opposite-side of the
 * panel from the six-pack -- standard C172 layout.
 *
 * Reads from DisplayState so the fault model can lie. The vacuum
 * gauge zeros under vacuum failure; the ammeter swings negative
 * under alternator failure.
 */

import { C172_CONFIG, type DisplayState } from '@ab/bc-sim';
import ClusterGauge from './ClusterGauge.svelte';
import FuelGauge from './FuelGauge.svelte';

interface Props {
	display: DisplayState | null;
}

let { display }: Props = $props();

const oilPress = $derived(display?.oilPressurePsi ?? 0);
const oilTemp = $derived(display?.oilTempCelsius ?? 0);
const ammeter = $derived(display?.ammeterAmps ?? 0);
const vacuum = $derived(display?.vacuumInHg ?? 0);
const fuelLeft = $derived(display?.fuelLeftGallons ?? 0);
const fuelRight = $derived(display?.fuelRightGallons ?? 0);

const LOW_FUEL_GALLONS = 5;
</script>

<div class="cluster">
	<ClusterGauge
		value={oilPress}
		min={0}
		max={100}
		greenLow={C172_CONFIG.oilPressureGreenLowPsi}
		greenHigh={C172_CONFIG.oilPressureGreenHighPsi}
		redline={C172_CONFIG.oilPressureMaxPsi}
		label="Oil P"
		units="psi"
		tickCount={6}
	/>
	<ClusterGauge
		value={oilTemp}
		min={0}
		max={150}
		greenLow={50}
		greenHigh={C172_CONFIG.oilTempCruiseC + 10}
		redline={C172_CONFIG.oilTempRedlineC}
		label="Oil T"
		units="°C"
		tickCount={6}
	/>
	<ClusterGauge
		value={ammeter}
		min={-30}
		max={30}
		greenLow={0}
		greenHigh={20}
		label="Amps"
		units="A"
		tickCount={5}
	/>
	<ClusterGauge
		value={vacuum}
		min={0}
		max={10}
		greenLow={4.5}
		greenHigh={5.5}
		label="Vac"
		units="inHg"
		tickCount={5}
		formatter={(v) => v.toFixed(1)}
	/>
	<FuelGauge
		leftGallons={fuelLeft}
		rightGallons={fuelRight}
		capacity={C172_CONFIG.fuelTankCapacityGallons}
		lowFuelThreshold={LOW_FUEL_GALLONS}
	/>
</div>

<style>
	.cluster {
		display: grid;
		grid-template-columns: repeat(2, 120px);
		grid-template-rows: repeat(3, 120px);
		gap: var(--space-sm);
		justify-content: center;
		align-content: center;
	}
</style>
