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
		<circle cx="100" cy="100" r="96" fill="#111" stroke="#333" stroke-width="2" />

		<!-- tick marks: 0..9 (hundreds scale) -->
		{#each ticks as tick (tick)}
			{@const angle = tick * 36 - 90}
			{@const rad = (angle * Math.PI) / 180}
			<line
				x1={100 + 60 * Math.cos(rad)}
				y1={100 + 60 * Math.sin(rad)}
				x2={100 + 74 * Math.cos(rad)}
				y2={100 + 74 * Math.sin(rad)}
				stroke="#f5f5f5"
				stroke-width="2"
			/>
			<text
				x={100 + 48 * Math.cos(rad)}
				y={100 + 48 * Math.sin(rad)}
				text-anchor="middle"
				dominant-baseline="central"
				font-size="16"
				fill="#f5f5f5"
				font-family="ui-monospace, monospace">{tick}</text
			>
		{/each}

		<!-- ten-thousands pointer (small triangle well outside needle hub) -->
		<g transform={`rotate(${tenThousandsAngle} 100 100)`}>
			<polygon points="100,22 94,32 106,32" fill="#e9c53c" />
		</g>

		<!-- thousands needle (short, fat) -->
		<g transform={`rotate(${thousandsAngle} 100 100)`}>
			<polygon points="100,100 92,96 96,48 104,48 108,96" fill="#f5f5f5" stroke="#111" stroke-width="0.5" />
		</g>

		<!-- hundreds needle (long, thin) -->
		<g transform={`rotate(${hundredsAngle} 100 100)`}>
			<line x1="100" y1="100" x2="100" y2="28" stroke="#ffe270" stroke-width="3" stroke-linecap="round" />
		</g>

		<circle cx="100" cy="100" r="6" fill="#ffe270" />

		<text x="100" y="158" text-anchor="middle" font-size="10" fill="#bbb" font-family="ui-monospace, monospace">
			FEET MSL
		</text>
		<text x="100" y="176" text-anchor="middle" font-size="16" fill="#f5f5f5" font-family="ui-monospace, monospace">
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
</style>
