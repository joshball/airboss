<script lang="ts">
/**
 * Tachometer -- round gauge showing engine RPM. Green arc in the normal
 * cruise range, red line at max, numeric readout under the needle.
 */

import { C172_CONFIG } from '@ab/bc-sim';

let { rpm = 0 }: { rpm?: number } = $props();

const MIN_RPM = 0;
const MAX_RPM = 3000;
const MIN_ANGLE = -150;
const MAX_ANGLE = 150;

function rpmToAngle(v: number): number {
	const clamped = Math.max(MIN_RPM, Math.min(MAX_RPM, v));
	const t = (clamped - MIN_RPM) / (MAX_RPM - MIN_RPM);
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

const rpmSafe = $derived(Number.isFinite(rpm) ? rpm : 0);
const needleAngle = $derived(rpmToAngle(rpmSafe));

const GREEN_LOW_ANGLE = rpmToAngle(C172_CONFIG.greenArcRpmLow);
const GREEN_HIGH_ANGLE = rpmToAngle(C172_CONFIG.greenArcRpmHigh);
const REDLINE_ANGLE = rpmToAngle(C172_CONFIG.maxRpm);

const greenArc = arcPath(GREEN_LOW_ANGLE, GREEN_HIGH_ANGLE, 72);

const majorTicks = [0, 500, 1000, 1500, 2000, 2500, 3000];
</script>

<div class="instrument" aria-label={`Tachometer reading ${rpmSafe.toFixed(0)} RPM`}>
	<svg viewBox="0 0 200 200" role="img">
		<circle cx="100" cy="100" r="96" class="instrument-face" stroke-width="2" />

		<!-- green operating arc -->
		<path d={greenArc} class="arc-green" stroke-width="6" fill="none" />

		<!-- redline -->
		<line
			x1={100 + 60 * Math.cos(((REDLINE_ANGLE - 90) * Math.PI) / 180)}
			y1={100 + 60 * Math.sin(((REDLINE_ANGLE - 90) * Math.PI) / 180)}
			x2={100 + 82 * Math.cos(((REDLINE_ANGLE - 90) * Math.PI) / 180)}
			y2={100 + 82 * Math.sin(((REDLINE_ANGLE - 90) * Math.PI) / 180)}
			class="redline"
			stroke-width="3"
		/>

		<!-- tick marks + labels -->
		{#each majorTicks as t (t)}
			{@const a = rpmToAngle(t) - 90}
			{@const rad = (a * Math.PI) / 180}
			<line
				x1={100 + 62 * Math.cos(rad)}
				y1={100 + 62 * Math.sin(rad)}
				x2={100 + 78 * Math.cos(rad)}
				y2={100 + 78 * Math.sin(rad)}
				class="tick-major"
				stroke-width="2"
			/>
			<text
				x={100 + 48 * Math.cos(rad)}
				y={100 + 48 * Math.sin(rad)}
				text-anchor="middle"
				dominant-baseline="central"
				font-size="11"
				class="tick-label">{t / 100}</text
			>
		{/each}

		<!-- needle -->
		<g transform={`rotate(${needleAngle} 100 100)`}>
			<line x1="100" y1="100" x2="100" y2="28" class="needle-pointer" stroke-width="3" stroke-linecap="round" />
			<circle cx="100" cy="100" r="5" class="hub" />
		</g>

		<text x="100" y="148" text-anchor="middle" font-size="10" class="unit-label">
			RPM x100
		</text>
		<text x="100" y="172" text-anchor="middle" font-size="15" class="digital-readout">
			{rpmSafe.toFixed(0)}
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

	.arc-green {
		stroke: var(--ab-sim-arc-green);
	}

	.redline {
		stroke: var(--ab-sim-arc-red);
	}

	.tick-major {
		stroke: var(--ab-sim-instrument-tick);
	}

	.tick-label {
		fill: var(--ab-sim-instrument-tick);
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
