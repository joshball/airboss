<script lang="ts">
/**
 * Altimeter -- classic three-pointer layout:
 * - Long needle: hundreds of feet (one rotation per 1000 ft)
 * - Short fat needle: thousands of feet (one rotation per 10000 ft)
 * - Pointer triangle: ten-thousands
 *
 * Plus a digital readout under the needles for instant read.
 */

let { altitudeFeet = 0 }: { altitudeFeet?: number } = $props();

const altSafe = $derived(Number.isFinite(altitudeFeet) ? altitudeFeet : 0);

// Angles increase clockwise from 12 o'clock.
const hundredsAngle = $derived(((altSafe % 1000) / 1000) * 360);
const thousandsAngle = $derived(((altSafe % 10000) / 10000) * 360);
const tenThousandsAngle = $derived(((altSafe % 100000) / 100000) * 360);

const ticks = Array.from({ length: 10 }, (_, i) => i);
</script>

<div class="instrument" aria-label={`Altimeter reading ${altSafe.toFixed(0)} feet`}>
	<svg viewBox="0 0 200 200" role="img">
		<circle cx="100" cy="100" r="96" class="instrument-face" />

		<!-- tick marks: 0..9 (hundreds scale). The "5" tick line (6 o'clock)
			 is skipped to give the digital readout below a clear upper edge,
			 but the "5" digit itself is kept so the scale still reads 0..9. -->
		{#each ticks as tick (tick)}
			{@const angle = tick * 36 - 90}
			{@const rad = (angle * Math.PI) / 180}
			{#if tick !== 5}
				<line
					x1={100 + 60 * Math.cos(rad)}
					y1={100 + 60 * Math.sin(rad)}
					x2={100 + 74 * Math.cos(rad)}
					y2={100 + 74 * Math.sin(rad)}
					class="tick-major"
					stroke-width="2"
				/>
			{/if}
			<text
				x={100 + 48 * Math.cos(rad)}
				y={100 + 48 * Math.sin(rad)}
				text-anchor="middle"
				dominant-baseline="central"
				font-size="16"
				class="tick-label">{tick}</text
			>
		{/each}

		<!-- ten-thousands pointer (small triangle well outside needle hub) -->
		<g transform={`rotate(${tenThousandsAngle} 100 100)`}>
			<polygon points="100,22 94,32 106,32" class="pointer-caution" />
		</g>

		<!-- thousands needle (short, fat) -->
		<g transform={`rotate(${thousandsAngle} 100 100)`}>
			<polygon points="100,100 92,96 96,48 104,48 108,96" class="needle-thousands" stroke-width="0.5" />
		</g>

		<!-- hundreds needle (long, thin) -->
		<g transform={`rotate(${hundredsAngle} 100 100)`}>
			<line x1="100" y1="100" x2="100" y2="28" class="needle-pointer" stroke-width="3" stroke-linecap="round" />
		</g>

		<!-- FEET / MSL label tucked at roughly 10-11 o'clock, inside the tick
			 ring, so it stays clear of the digital readout at 6 o'clock. -->
		<text x="74" y="76" text-anchor="middle" font-size="7" class="unit-label">
			<tspan x="74" dy="0">FEET</tspan>
			<tspan x="74" dy="8">MSL</tspan>
		</text>

		<circle cx="100" cy="100" r="6" class="hub" />

		<!-- Digital readout: bordered box below the "5" tick label so the
			 numeric altitude is instantly legible without reading the needles. -->
		<rect x="74" y="166" width="52" height="20" rx="2" class="readout-frame" stroke-width="1.5" />
		<text x="100" y="176" text-anchor="middle" dominant-baseline="central" font-size="14" class="digital-readout">
			{altSafe.toFixed(0)}
		</text>
	</svg>
</div>

<style>
	.instrument {
		width: 200px;
		height: 200px;
	}

	svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.instrument-face {
		fill: var(--sim-instrument-face);
		stroke: var(--sim-instrument-bezel);
	}

	.tick-major {
		stroke: var(--sim-instrument-tick);
	}

	.tick-label {
		fill: var(--sim-instrument-tick);
		font-family: var(--font-family-mono);
	}

	.pointer-caution {
		fill: var(--sim-arc-yellow);
	}

	.needle-thousands {
		fill: var(--sim-instrument-tick);
		stroke: var(--sim-instrument-face);
	}

	.needle-pointer {
		stroke: var(--sim-instrument-pointer);
	}

	.hub {
		fill: var(--sim-instrument-pointer);
	}

	.unit-label {
		fill: var(--sim-instrument-tick-minor);
		font-family: var(--font-family-mono);
	}

	.readout-frame {
		fill: var(--sim-panel-bg-darker);
		stroke: var(--sim-instrument-tick-minor);
	}

	.digital-readout {
		fill: var(--sim-instrument-tick);
		font-family: var(--font-family-mono);
	}
</style>
