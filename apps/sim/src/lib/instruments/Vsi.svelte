<script lang="ts">
/**
 * Vertical Speed Indicator -- circular dial, pointer indicating feet per
 * minute. Scale +/- 2000 fpm with extra detail near zero.
 */

let { fpm = 0 }: { fpm?: number } = $props();

const MAX_FPM = 2000;
// Real VSI geometry: 0 at 9 o'clock; climb sweeps CCW over the top to
// +2000 near 3 o'clock; descent sweeps CW under the bottom to -2000
// near 3 o'clock. Both extremes meet on the right side -- the scale
// covers ~270 deg of arc so the needle has useful resolution around 0.
//   v = 0     -> 270 deg (9 o'clock)
//   v = +2000 -> 90 deg  (3 o'clock via top)
//   v = -2000 -> 90 deg  (3 o'clock via bottom, i.e. 450 == 90)

function fpmToAngle(v: number): number {
	const clamped = Math.max(-MAX_FPM, Math.min(MAX_FPM, v));
	const t = clamped / MAX_FPM; // -1..+1
	return 270 + t * 180;
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

		<!-- UP / DN labels on the left side, inside the tick ring, since the
			 9 o'clock quadrant is open air (0 fpm sits there on the outer ring). -->
		<text x="70" y="84" text-anchor="middle" font-size="9" class="foot-label">
			UP
		</text>
		<text x="70" y="120" text-anchor="middle" font-size="9" class="foot-label">
			DN
		</text>

		<!-- Needle -->
		<g transform={`rotate(${needleAngle} 100 100)`}>
			<line x1="100" y1="100" x2="100" y2="22" class="needle-pointer" stroke-width="3" stroke-linecap="round" />
			<circle cx="100" cy="100" r="5" class="hub" />
		</g>
	</svg>
	<div class="foot-caption">
		{fpmSafe >= 0 ? '+' : ''}{fpmSafe.toFixed(0)} FPM
	</div>
</div>

<style>
	.instrument {
		width: 200px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	svg {
		width: 200px;
		height: 200px;
		display: block;
	}

	.foot-caption {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--sim-instrument-tick-minor);
		margin-top: var(--space-2xs);
	}

	.instrument-face {
		fill: var(--sim-instrument-face);
		stroke: var(--sim-instrument-bezel);
	}

	.tick-major {
		stroke: var(--sim-instrument-tick);
	}

	.tick-minor {
		stroke: var(--sim-instrument-tick-subtle);
	}

	.tick-label {
		fill: var(--sim-instrument-tick);
		font-family: var(--font-family-mono);
	}

	.foot-label {
		fill: var(--sim-instrument-tick-dim);
		font-family: var(--font-family-mono);
	}

	.needle-pointer {
		stroke: var(--sim-instrument-pointer);
	}

	.hub {
		fill: var(--sim-instrument-pointer);
	}

</style>
