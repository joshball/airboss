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
		<circle cx="100" cy="100" r="96" fill="#111" stroke="#333" stroke-width="2" />

		<!-- green operating arc -->
		<path d={greenArc} stroke="#2fb856" stroke-width="6" fill="none" />

		<!-- redline -->
		<line
			x1={100 + 60 * Math.cos(((REDLINE_ANGLE - 90) * Math.PI) / 180)}
			y1={100 + 60 * Math.sin(((REDLINE_ANGLE - 90) * Math.PI) / 180)}
			x2={100 + 82 * Math.cos(((REDLINE_ANGLE - 90) * Math.PI) / 180)}
			y2={100 + 82 * Math.sin(((REDLINE_ANGLE - 90) * Math.PI) / 180)}
			stroke="#e0443e"
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
				stroke="#f5f5f5"
				stroke-width="2"
			/>
			<text
				x={100 + 48 * Math.cos(rad)}
				y={100 + 48 * Math.sin(rad)}
				text-anchor="middle"
				dominant-baseline="central"
				font-size="11"
				fill="#f5f5f5"
				font-family="ui-monospace, monospace">{t / 100}</text
			>
		{/each}

		<!-- needle -->
		<g transform={`rotate(${needleAngle} 100 100)`}>
			<line x1="100" y1="100" x2="100" y2="28" stroke="#ffe270" stroke-width="3" stroke-linecap="round" />
			<circle cx="100" cy="100" r="5" fill="#ffe270" />
		</g>

		<text x="100" y="148" text-anchor="middle" font-size="10" fill="#bbb" font-family="ui-monospace, monospace">
			RPM x100
		</text>
		<text x="100" y="172" text-anchor="middle" font-size="15" fill="#f5f5f5" font-family="ui-monospace, monospace">
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
</style>
