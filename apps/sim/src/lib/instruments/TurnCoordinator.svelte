<script lang="ts">
/**
 * Turn Coordinator -- aircraft symbol rotates with yaw rate. Standard-rate
 * marks (L and R) sit at +/- 3 deg/s. Ball slides below, driven by
 * `slipBall` (-1..+1 where positive = ball right).
 */

let { yawRateDegPerSec = 0, slipBall = 0 }: { yawRateDegPerSec?: number; slipBall?: number } = $props();

// Visual map: 3 deg/s -> 20 deg rotation of the aircraft symbol (classic TC).
const DEG_PER_STANDARD_RATE = 3;
const VISUAL_DEG_AT_STANDARD_RATE = 20;
const MAX_VISUAL_DEG = 40;

const yawSafe = $derived(Number.isFinite(yawRateDegPerSec) ? yawRateDegPerSec : 0);
const ballSafe = $derived(Number.isFinite(slipBall) ? slipBall : 0);

const symbolAngle = $derived(
	Math.max(-MAX_VISUAL_DEG, Math.min(MAX_VISUAL_DEG, (yawSafe / DEG_PER_STANDARD_RATE) * VISUAL_DEG_AT_STANDARD_RATE)),
);

// Ball position: +/- 1 slip maps to +/- 22px along the tube (center at x=100).
const BALL_TRAVEL_PX = 22;
const ballX = $derived(100 + Math.max(-1, Math.min(1, ballSafe)) * BALL_TRAVEL_PX);
</script>

<div
	class="instrument"
	aria-label={`Turn coordinator: yaw ${yawSafe.toFixed(1)} deg per second, ball ${ballSafe.toFixed(2)}`}
>
	<svg viewBox="0 0 200 200" role="img">
		<circle cx="100" cy="100" r="96" class="instrument-face" stroke-width="2" />

		<!-- Standard-rate marks (L and R) -->
		<g class="rate-label" font-size="12">
			<text x="44" y="82" text-anchor="middle">L</text>
			<text x="156" y="82" text-anchor="middle">R</text>
		</g>

		<!-- Standard-rate tick marks on the outer ring -->
		{#each [-VISUAL_DEG_AT_STANDARD_RATE, VISUAL_DEG_AT_STANDARD_RATE] as deg (deg)}
			{@const rad = ((deg - 90) * Math.PI) / 180}
			<line
				x1={100 + 80 * Math.cos(rad)}
				y1={100 + 80 * Math.sin(rad)}
				x2={100 + 92 * Math.cos(rad)}
				y2={100 + 92 * Math.sin(rad)}
				class="rate-tick"
				stroke-width="3"
			/>
		{/each}

		<!-- Wings-level reference marks -->
		<line x1="30" y1="100" x2="52" y2="100" class="wings-ref" stroke-width="2" />
		<line x1="148" y1="100" x2="170" y2="100" class="wings-ref" stroke-width="2" />

		<!-- Aircraft symbol (rotates with yaw rate) -->
		<g transform={`rotate(${symbolAngle} 100 100)`}>
			<!-- wings -->
			<line x1="46" y1="100" x2="154" y2="100" class="aircraft-ref" stroke-width="4" stroke-linecap="round" />
			<!-- fuselage -->
			<line x1="100" y1="82" x2="100" y2="118" class="aircraft-ref" stroke-width="4" stroke-linecap="round" />
			<!-- tail -->
			<line x1="90" y1="82" x2="110" y2="82" class="aircraft-ref" stroke-width="3" />
			<!-- nose dot -->
			<circle cx="100" cy="100" r="4" class="nose-dot" stroke-width="2" />
		</g>

		<!-- Inclinometer tube (below the aircraft) -->
		<rect x="70" y="152" width="60" height="16" rx="8" class="tube" stroke-width="1" />
		<!-- centering reference lines -->
		<line x1="94" y1="148" x2="94" y2="172" class="tube-ref" stroke-width="1.5" />
		<line x1="106" y1="148" x2="106" y2="172" class="tube-ref" stroke-width="1.5" />
		<!-- Ball -->
		<circle cx={ballX} cy="160" r="5.5" class="ball" stroke-width="1" />

		<!-- Top label stays on-face; it's well clear of the symbol. -->
		<text x="100" y="40" text-anchor="middle" font-size="10" class="unit-label">
			TURN COORDINATOR
		</text>
	</svg>
	<div class="foot-caption">NO PITCH INFORMATION</div>
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
		color: var(--sim-instrument-tick-dim);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin-top: var(--space-2xs);
	}

	.instrument-face {
		fill: var(--sim-instrument-face);
		stroke: var(--sim-instrument-bezel);
	}

	.rate-label {
		fill: var(--sim-instrument-tick);
		font-family: var(--font-family-mono);
	}

	.rate-tick {
		stroke: var(--sim-instrument-pointer);
	}

	.wings-ref {
		stroke: var(--sim-instrument-tick-subtle);
	}

	.aircraft-ref {
		stroke: var(--sim-instrument-pointer);
	}

	.nose-dot {
		fill: var(--sim-instrument-face);
		stroke: var(--sim-instrument-pointer);
	}

	.tube {
		fill: var(--sim-instrument-face-inner);
		stroke: var(--sim-instrument-tick-faint);
	}

	.tube-ref {
		stroke: var(--sim-instrument-tick-subtle);
	}

	.ball {
		fill: var(--sim-instrument-tick);
		stroke: var(--sim-instrument-tick-subtle);
	}

	.unit-label {
		fill: var(--sim-instrument-tick-minor);
		font-family: var(--font-family-mono);
	}

</style>
