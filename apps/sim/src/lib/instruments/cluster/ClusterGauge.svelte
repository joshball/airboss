<script lang="ts">
/**
 * Compact round gauge used by the engine cluster. Same dial, same
 * tick / arc / needle pattern as the tach but at half the size and
 * with caller-supplied range, label, units, and band.
 *
 * Used by oil pressure, oil temp, ammeter, vacuum gauges. Fuel uses
 * a different shape (vertical bar) because the unit is different
 * (gallons remaining, not an instantaneous rate).
 */

interface Props {
	value: number;
	min: number;
	max: number;
	greenLow: number;
	greenHigh: number;
	/** Optional redline value. Drawn only if inside [min, max]. */
	redline?: number;
	label: string;
	units: string;
	/** Number of major tick positions across the dial. */
	tickCount?: number;
	/** Optional formatter for the digital readout below the dial. */
	formatter?: (v: number) => string;
}

let { value, min, max, greenLow, greenHigh, redline, label, units, tickCount = 5, formatter }: Props = $props();

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

function valueToAngle(v: number): number {
	const clamped = Math.max(min, Math.min(max, v));
	const t = (clamped - min) / Math.max(1e-6, max - min);
	return MIN_ANGLE + t * (MAX_ANGLE - MIN_ANGLE);
}

function arcPath(a1: number, a2: number, r: number, cx = 100, cy = 100): string {
	const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
	const x1 = cx + r * Math.cos(toRad(a1));
	const y1 = cy + r * Math.sin(toRad(a1));
	const x2 = cx + r * Math.cos(toRad(a2));
	const y2 = cy + r * Math.sin(toRad(a2));
	const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
	const sweep = a2 > a1 ? 1 : 0;
	return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

const safeValue = $derived(Number.isFinite(value) ? value : 0);
const needleAngle = $derived(valueToAngle(safeValue));
const greenArc = $derived(arcPath(valueToAngle(greenLow), valueToAngle(greenHigh), 72));
const redlineAngle = $derived(redline === undefined ? null : valueToAngle(redline));
const ticks = $derived(
	Array.from({ length: tickCount }, (_, i) => min + (i / Math.max(1, tickCount - 1)) * (max - min)),
);
const display = $derived(formatter ? formatter(safeValue) : safeValue.toFixed(0));
</script>

<div class="cluster-gauge" aria-label={`${label} ${display} ${units}`}>
	<svg viewBox="0 0 200 200" role="img">
		<circle cx="100" cy="100" r="96" class="instrument-face" stroke-width="2" />
		<path d={greenArc} class="arc-green" stroke-width="6" fill="none" />
		{#if redlineAngle !== null}
			{@const rad = ((redlineAngle - 90) * Math.PI) / 180}
			<line
				x1={100 + 60 * Math.cos(rad)}
				y1={100 + 60 * Math.sin(rad)}
				x2={100 + 82 * Math.cos(rad)}
				y2={100 + 82 * Math.sin(rad)}
				class="redline"
				stroke-width="3"
			/>
		{/if}
		{#each ticks as tick (tick)}
			{@const a = valueToAngle(tick)}
			{@const rad = ((a - 90) * Math.PI) / 180}
			<line
				x1={100 + 64 * Math.cos(rad)}
				y1={100 + 64 * Math.sin(rad)}
				x2={100 + 78 * Math.cos(rad)}
				y2={100 + 78 * Math.sin(rad)}
				class="tick"
				stroke-width="2"
			/>
		{/each}
		<g transform={`rotate(${needleAngle} 100 100)`}>
			<line x1="100" y1="100" x2="100" y2="32" class="needle" stroke-width="3" stroke-linecap="round" />
			<circle cx="100" cy="100" r="6" class="hub" />
		</g>
		<text x="100" y="148" text-anchor="middle" class="label" font-size="14">{label}</text>
		<text x="100" y="172" text-anchor="middle" class="readout" font-size="16">{display} {units}</text>
	</svg>
</div>

<style>
	.cluster-gauge {
		width: 120px;
		height: 120px;
	}
	svg {
		width: 100%;
		height: 100%;
	}
	.instrument-face {
		fill: var(--surface-2, #1a1a22);
		stroke: var(--ink-3, #555);
	}
	.arc-green {
		stroke: #4ade80;
	}
	.redline {
		stroke: #ef4444;
	}
	.tick {
		stroke: var(--ink-2, #aaa);
	}
	.needle {
		stroke: var(--ink-1, #f5f5f5);
	}
	.hub {
		fill: var(--ink-3, #555);
	}
	.label {
		fill: var(--ink-2, #aaa);
		font-family: monospace;
		text-transform: uppercase;
	}
	.readout {
		fill: var(--ink-1, #f5f5f5);
		font-family: monospace;
	}
</style>
