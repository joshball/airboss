<script lang="ts">
/**
 * Two-tank fuel gauge. Vertical bars side by side with L / R labels,
 * "F" at top (full) and "E" at bottom (empty), and a digital
 * gallons-remaining readout under each tank. Yellow band at the
 * "low fuel" threshold.
 */

interface Props {
	leftGallons: number;
	rightGallons: number;
	capacity: number;
	/** Tanks below this gallons trigger the yellow band. */
	lowFuelThreshold?: number;
}

let { leftGallons, rightGallons, capacity, lowFuelThreshold }: Props = $props();

const safeLeft = $derived(Number.isFinite(leftGallons) ? Math.max(0, leftGallons) : 0);
const safeRight = $derived(Number.isFinite(rightGallons) ? Math.max(0, rightGallons) : 0);

function fillPct(gallons: number): number {
	if (capacity <= 0) return 0;
	return Math.max(0, Math.min(100, (gallons / capacity) * 100));
}

const leftFill = $derived(fillPct(safeLeft));
const rightFill = $derived(fillPct(safeRight));
const lowPct = $derived(lowFuelThreshold === undefined ? 0 : fillPct(lowFuelThreshold));
</script>

<div class="fuel-gauge" aria-label={`Fuel left ${safeLeft.toFixed(1)} gallons, right ${safeRight.toFixed(1)} gallons`}>
	<div class="tank">
		<div class="bar">
			{#if lowPct > 0}
				<div class="low-band" style:height={`${lowPct}%`}></div>
			{/if}
			<div class="fill" style:height={`${leftFill}%`}></div>
		</div>
		<div class="caption">L {safeLeft.toFixed(1)}</div>
	</div>
	<div class="tank">
		<div class="bar">
			{#if lowPct > 0}
				<div class="low-band" style:height={`${lowPct}%`}></div>
			{/if}
			<div class="fill" style:height={`${rightFill}%`}></div>
		</div>
		<div class="caption">R {safeRight.toFixed(1)}</div>
	</div>
	<div class="label">FUEL GAL</div>
</div>

<style>
	.fuel-gauge {
		width: 120px;
		height: 120px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr auto;
		gap: 4px 8px;
		padding: 4px;
		border: 1px solid var(--ink-3, #555);
		border-radius: 4px;
		background: var(--surface-2, #1a1a22);
	}
	.tank {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.bar {
		position: relative;
		flex: 1;
		width: 24px;
		background: var(--surface-1, #0e0e14);
		border: 1px solid var(--ink-3, #555);
		overflow: hidden;
	}
	.low-band {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(250, 204, 21, 0.18);
	}
	.fill {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: #4ade80;
	}
	.caption {
		font-family: monospace;
		font-size: 11px;
		color: var(--ink-1, #f5f5f5);
	}
	.label {
		grid-column: 1 / -1;
		text-align: center;
		font-family: monospace;
		font-size: 11px;
		color: var(--ink-2, #aaa);
		text-transform: uppercase;
	}
</style>
