<script lang="ts">
/**
 * Vertical Speed Indicator -- circular dial, pointer indicating feet per
 * minute. Scale +/- 2000 fpm with extra detail near zero.
 */

let { fpm = 0 }: { fpm?: number } = $props();

const MAX_FPM = 2000;
// 0 fpm at 9 o'clock (pointer horizontal, pointing right). Climb = up = CCW.
// Match real VSI: zero at 9 o'clock, 2000 fpm climb at 12 o'clock,
// -2000 fpm descent at 6 o'clock.
// Convert: angle (deg from 12 o'clock, clockwise) = 270 - (fpm/2000)*90 for up, etc.

function fpmToAngle(v: number): number {
	const clamped = Math.max(-MAX_FPM, Math.min(MAX_FPM, v));
	// Positive fpm (climb) -> from 270 (9 o'clock) toward 0 (12 o'clock), so angle goes 270 -> 0 CCW => 270 - 90 = 180.
	// Using our convention (0 at 12, CW positive): climb maps 270 -> 0 means shorter path is CCW which is +90 to 0.
	// Simpler: define angle in degrees-from-12 clockwise.
	//   v = 0    -> 270 (9 o'clock)
	//   v = +2000 -> 360 (= 0, 12 o'clock)
	//   v = -2000 -> 180 (6 o'clock)
	const t = clamped / MAX_FPM; // -1..+1
	return 270 + t * 90;
}

const fpmSafe = $derived(Number.isFinite(fpm) ? fpm : 0);
const needleAngle = $derived(fpmToAngle(fpmSafe));

// Tick marks every 500 fpm, plus minor ticks every 100 near zero.
const majorTicks = [-2000, -1500, -1000, -500, 0, 500, 1000, 1500, 2000];
const minorTicks = [-400, -300, -200, -100, 100, 200, 300, 400];
</script>

<div class="instrument" aria-label={`Vertical speed indicator reading ${fpmSafe.toFixed(0)} feet per minute`}>
	<svg viewBox="0 0 200 200" role="img">
		<circle cx="100" cy="100" r="96" class="instrument-face" stroke-width="2" />

		{#each majorTicks as t (t)}
			{@const a = fpmToAngle(t) - 90}
			{@const rad = (a * Math.PI) / 180}
			<line
				x1={100 + 74 * Math.cos(rad)}
				y1={100 + 74 * Math.sin(rad)}
				x2={100 + 86 * Math.cos(rad)}
				y2={100 + 86 * Math.sin(rad)}
				class="tick-major"
				stroke-width={t === 0 ? 3 : 2}
			/>
			<text
				x={100 + 62 * Math.cos(rad)}
				y={100 + 62 * Math.sin(rad)}
				text-anchor="middle"
				dominant-baseline="central"
				font-size="10"
				class="tick-label">{Math.abs(t) / 1000}</text
			>
		{/each}
		{#each minorTicks as t (t)}
			{@const a = fpmToAngle(t) - 90}
			{@const rad = (a * Math.PI) / 180}
			<line
				x1={100 + 78 * Math.cos(rad)}
				y1={100 + 78 * Math.sin(rad)}
				x2={100 + 86 * Math.cos(rad)}
				y2={100 + 86 * Math.sin(rad)}
				class="tick-minor"
				stroke-width="1"
			/>
		{/each}

		<!-- UP / DOWN arrows -->
		<text x="100" y="60" text-anchor="middle" font-size="9" class="foot-label">
			UP
		</text>
		<text x="100" y="148" text-anchor="middle" font-size="9" class="foot-label">
			DN
		</text>

		<!-- Needle -->
		<g transform={`rotate(${needleAngle} 100 100)`}>
			<line x1="100" y1="100" x2="100" y2="22" class="needle-pointer" stroke-width="3" stroke-linecap="round" />
			<circle cx="100" cy="100" r="5" class="hub" />
		</g>

		<!-- Digital readout -->
		<text x="100" y="170" text-anchor="middle" font-size="10" class="unit-label">
			FPM
		</text>
		<text x="100" y="186" text-anchor="middle" font-size="13" class="digital-readout">
			{fpmSafe >= 0 ? '+' : ''}{fpmSafe.toFixed(0)}
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
		fill: var(--ab-sim-instrument-face);
		stroke: var(--ab-sim-instrument-bezel);
	}

	.tick-major {
		stroke: var(--ab-sim-instrument-tick);
	}

	.tick-minor {
		stroke: var(--ab-sim-instrument-tick-subtle);
	}

	.tick-label {
		fill: var(--ab-sim-instrument-tick);
		font-family: var(--ab-font-mono);
	}

	.foot-label {
		fill: var(--ab-sim-instrument-tick-dim);
		font-family: var(--ab-font-mono);
	}

	.needle-pointer {
		stroke: var(--ab-sim-instrument-pointer);
	}

	.hub {
		fill: var(--ab-sim-instrument-pointer);
	}

	.unit-label {
		fill: var(--ab-sim-instrument-tick-minor);
		font-family: var(--ab-font-mono);
	}

	.digital-readout {
		fill: var(--ab-sim-instrument-tick);
		font-family: var(--ab-font-mono);
	}
</style>
