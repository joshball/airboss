<script lang="ts">
/**
 * Airspeed Indicator -- circular dial, sweep needle, C172 arcs + Vspeed
 * markings. Pure SVG; driven by a KIAS prop.
 *
 * Arc ranges (C172):
 * - White arc (flap operating range): Vs0 to Vfe
 * - Green arc (normal operating range): Vs1 to Vno
 * - Yellow arc (caution range): Vno to Vne
 * - Red line at Vne
 */

import { C172_CONFIG } from '@ab/bc-sim';
import { SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';

let { kias = 0 }: { kias?: number } = $props();

const MIN_KIAS = 40;
const MAX_KIAS = 180;
const MIN_ANGLE_DEG = -150;
const MAX_ANGLE_DEG = 150;

function kiasToAngle(v: number): number {
	const clamped = Math.max(MIN_KIAS, Math.min(MAX_KIAS, v));
	const t = (clamped - MIN_KIAS) / (MAX_KIAS - MIN_KIAS);
	return MIN_ANGLE_DEG + t * (MAX_ANGLE_DEG - MIN_ANGLE_DEG);
}

const VS0_KTS = C172_CONFIG.vS0 * SIM_KNOTS_PER_METER_PER_SECOND;
const VS1_KTS = C172_CONFIG.vS1 * SIM_KNOTS_PER_METER_PER_SECOND;
const VFE_KTS = C172_CONFIG.vFe * SIM_KNOTS_PER_METER_PER_SECOND;
const VNO_KTS = C172_CONFIG.vNo * SIM_KNOTS_PER_METER_PER_SECOND;
const VNE_KTS = C172_CONFIG.vNe * SIM_KNOTS_PER_METER_PER_SECOND;

const kiasSafe = $derived(Number.isFinite(kias) ? kias : 0);
const needleAngle = $derived(kiasToAngle(kiasSafe));

/**
 * SVG arc path from angle a1 to angle a2 (degrees, 0 = up, clockwise).
 * Radius r, center (cx, cy). Returns a ring stroke path.
 */
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

const whiteArc = $derived(arcPath(kiasToAngle(VS0_KTS), kiasToAngle(VFE_KTS), 82));
const greenArc = $derived(arcPath(kiasToAngle(VS1_KTS), kiasToAngle(VNO_KTS), 72));
const yellowArc = $derived(arcPath(kiasToAngle(VNO_KTS), kiasToAngle(VNE_KTS), 72));

const ticks = Array.from({ length: 15 }, (_, i) => MIN_KIAS + i * 10);
</script>

<div class="instrument" aria-label={`Airspeed indicator reading ${kiasSafe.toFixed(0)} knots`}>
	<svg viewBox="0 0 200 200" role="img">
		<circle cx="100" cy="100" r="96" class="instrument-face" stroke-width="2" />

		<!-- arcs -->
		<path d={whiteArc} class="arc-white" stroke-width="6" fill="none" />
		<path d={greenArc} class="arc-green" stroke-width="6" fill="none" />
		<path d={yellowArc} class="arc-yellow" stroke-width="6" fill="none" />
		<!-- Vne redline -->
		<line
			x1={100 + 60 * Math.cos(((kiasToAngle(VNE_KTS) - 90) * Math.PI) / 180)}
			y1={100 + 60 * Math.sin(((kiasToAngle(VNE_KTS) - 90) * Math.PI) / 180)}
			x2={100 + 82 * Math.cos(((kiasToAngle(VNE_KTS) - 90) * Math.PI) / 180)}
			y2={100 + 82 * Math.sin(((kiasToAngle(VNE_KTS) - 90) * Math.PI) / 180)}
			class="redline"
			stroke-width="3"
		/>

		<!-- tick marks + labels -->
		{#each ticks as tick (tick)}
			{@const angle = kiasToAngle(tick)}
			{@const rad = ((angle - 90) * Math.PI) / 180}
			{@const inner = tick % 20 === 0 ? 56 : 62}
			{@const outer = 68}
			<line
				x1={100 + inner * Math.cos(rad)}
				y1={100 + inner * Math.sin(rad)}
				x2={100 + outer * Math.cos(rad)}
				y2={100 + outer * Math.sin(rad)}
				class="tick-major"
				stroke-width={tick % 20 === 0 ? 2 : 1}
			/>
			{#if tick % 20 === 0}
				<text
					x={100 + 46 * Math.cos(rad)}
					y={100 + 46 * Math.sin(rad)}
					text-anchor="middle"
					dominant-baseline="central"
					font-size="12"
					class="tick-label">{tick}</text
				>
			{/if}
		{/each}

		<!-- needle -->
		<g transform={`rotate(${needleAngle} 100 100)`}>
			<line x1="100" y1="100" x2="100" y2="22" class="needle-pointer" stroke-width="3" stroke-linecap="round" />
			<circle cx="100" cy="100" r="5" class="hub" />
		</g>

		<!-- label -->
		<text x="100" y="150" text-anchor="middle" font-size="11" class="unit-label">
			KIAS
		</text>
		<text x="100" y="170" text-anchor="middle" font-size="16" class="digital-readout">
			{kiasSafe.toFixed(0)}
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

	.arc-white {
		stroke: var(--sim-arc-white);
	}

	.arc-green {
		stroke: var(--sim-arc-green);
	}

	.arc-yellow {
		stroke: var(--sim-arc-yellow);
	}

	.redline {
		stroke: var(--sim-arc-red);
	}

	.tick-major {
		stroke: var(--sim-instrument-tick);
	}

	.tick-label {
		fill: var(--sim-instrument-tick);
		font-family: var(--font-family-mono);
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

	.digital-readout {
		fill: var(--sim-instrument-tick);
		font-family: var(--font-family-mono);
	}
</style>
