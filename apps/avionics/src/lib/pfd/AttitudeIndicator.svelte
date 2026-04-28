<script lang="ts">
/**
 * Attitude Indicator -- pure-SVG horizon, pitch ladder, bank pointer.
 *
 * Coordinate convention (matches a real PFD as the pilot sees it):
 *   - Sky on top, ground on bottom.
 *   - Nose-up pitch makes the horizon scroll DOWN on the gauge (more
 *     ground appears) -- so the world translates by `+pitchDeg * px/deg`.
 *   - Right-bank roll rotates the horizon counter-clockwise on the
 *     gauge, so the world rotates by `-rollDeg`.
 *
 * The fixed bank pointer arc lives outside the rotating world; only the
 * triangle pointer rotates with `rollDeg`. The aircraft-reference chevron
 * at the center is fixed in screen space.
 *
 * Sizing comes from a 200x200 viewBox; the parent grid scales it.
 */

interface Props {
	pitchDeg: number;
	rollDeg: number;
}

const { pitchDeg, rollDeg }: Props = $props();

// Layout constants (SVG-internal -- viewBox geometry, not theme tuning).
const VIEW_SIZE = 200;
const CENTER = VIEW_SIZE / 2;
const HORIZON_RADIUS = 90;
const PIXELS_PER_PITCH_DEG = 2.4;

// Pitch ladder authoring -- ticks every 5deg, labels at the 10deg ticks.
const PITCH_LADDER_DEGS: ReadonlyArray<number> = [-30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30];
const LADDER_MAJOR_HALFWIDTH = 22;
const LADDER_MINOR_HALFWIDTH = 12;

// Bank pointer arc tick angles (degrees), positive = right bank.
const BANK_TICK_DEGS: ReadonlyArray<number> = [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60];
const BANK_MAJOR_TICK_DEGS: ReadonlySet<number> = new Set([-60, -45, -30, 30, 45, 60]);

const safePitchDeg = $derived(Number.isFinite(pitchDeg) ? pitchDeg : 0);
const safeRollDeg = $derived(Number.isFinite(rollDeg) ? rollDeg : 0);
const horizonOffsetY = $derived(safePitchDeg * PIXELS_PER_PITCH_DEG);

function tickHalfWidth(deg: number): number {
	return Math.abs(deg) % 10 === 0 ? LADDER_MAJOR_HALFWIDTH : LADDER_MINOR_HALFWIDTH;
}

function tickIsLabeled(deg: number): boolean {
	return Math.abs(deg) % 10 === 0;
}

// Bank tick endpoints on the arc at radius `r`. Angle 0 = top of gauge.
function bankTickPath(deg: number, innerR: number, outerR: number): string {
	const rad = (deg * Math.PI) / 180;
	const sin = Math.sin(rad);
	const cos = -Math.cos(rad);
	const x1 = CENTER + innerR * sin;
	const y1 = CENTER + innerR * cos;
	const x2 = CENTER + outerR * sin;
	const y2 = CENTER + outerR * cos;
	return `M ${x1} ${y1} L ${x2} ${y2}`;
}
</script>

<div class="instrument" aria-label={`Attitude pitch ${safePitchDeg.toFixed(1)} bank ${safeRollDeg.toFixed(1)}`}>
	<svg viewBox="0 0 {VIEW_SIZE} {VIEW_SIZE}" role="img" preserveAspectRatio="xMidYMid meet">
		<defs>
			<clipPath id="ai-clip">
				<circle cx={CENTER} cy={CENTER} r={HORIZON_RADIUS} />
			</clipPath>
		</defs>

		<!-- Static instrument face background -->
		<rect x="0" y="0" width={VIEW_SIZE} height={VIEW_SIZE} class="face" />

		<!-- Rotating + translating horizon world, clipped to the inner circle -->
		<g clip-path="url(#ai-clip)">
			<g transform="rotate({-safeRollDeg} {CENTER} {CENTER}) translate(0 {horizonOffsetY})">
				<!-- Sky half (top) -->
				<rect x="-200" y="-400" width="800" height={400 + CENTER} class="sky" />
				<!-- Ground half (bottom) -->
				<rect x="-200" y={CENTER} width="800" height={400 + CENTER} class="ground" />
				<!-- Horizon line -->
				<line x1="-200" y1={CENTER} x2={VIEW_SIZE + 200} y2={CENTER} class="horizon-line" />

				<!-- Pitch ladder -->
				{#each PITCH_LADDER_DEGS as deg (deg)}
					{@const y = CENTER - deg * PIXELS_PER_PITCH_DEG}
					{@const halfW = tickHalfWidth(deg)}
					<line x1={CENTER - halfW} y1={y} x2={CENTER + halfW} y2={y} class="ladder-line" />
					{#if tickIsLabeled(deg)}
						<text x={CENTER - halfW - 4} y={y + 3} text-anchor="end" class="ladder-label">{Math.abs(deg)}</text>
						<text x={CENTER + halfW + 4} y={y + 3} text-anchor="start" class="ladder-label">{Math.abs(deg)}</text>
					{/if}
				{/each}
			</g>
		</g>

		<!-- Bank arc + ticks (fixed) -->
		<g class="bank-arc">
			{#each BANK_TICK_DEGS as deg (deg)}
				{@const isMajor = BANK_MAJOR_TICK_DEGS.has(deg)}
				<path
					d={bankTickPath(deg, HORIZON_RADIUS - (isMajor ? 12 : 6), HORIZON_RADIUS - 1)}
					class={isMajor ? 'bank-tick-major' : 'bank-tick-minor'}
				/>
			{/each}
			<!-- Bank reference triangle at the top (fixed) -->
			<path d="M {CENTER} {CENTER - HORIZON_RADIUS + 1} l -5 8 l 10 0 z" class="bank-reference" />
		</g>

		<!-- Rotating bank pointer triangle on the arc -->
		<g transform="rotate({safeRollDeg} {CENTER} {CENTER})">
			<path d="M {CENTER} {CENTER - HORIZON_RADIUS + 14} l -6 10 l 12 0 z" class="bank-pointer" />
		</g>

		<!-- Bezel ring -->
		<circle cx={CENTER} cy={CENTER} r={HORIZON_RADIUS} fill="none" class="bezel" />

		<!-- Fixed aircraft reference chevron (yellow) -->
		<g class="aircraft-ref">
			<line x1={CENTER - 36} y1={CENTER} x2={CENTER - 14} y2={CENTER} />
			<line x1={CENTER + 14} y1={CENTER} x2={CENTER + 36} y2={CENTER} />
			<line x1={CENTER - 14} y1={CENTER} x2={CENTER} y2={CENTER + 8} />
			<line x1={CENTER + 14} y1={CENTER} x2={CENTER} y2={CENTER + 8} />
			<circle cx={CENTER} cy={CENTER} r="2" class="aircraft-ref-fill" />
		</g>
	</svg>
</div>

<style>
	.instrument {
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
	}

	svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.face {
		fill: var(--surface-sunken);
	}

	.sky {
		fill: var(--avionics-sky);
	}

	.ground {
		fill: var(--avionics-ground);
	}

	.horizon-line {
		stroke: var(--ink-body);
		stroke-width: 1.5;
	}

	.ladder-line {
		stroke: var(--ink-body);
		stroke-width: 1.2;
	}

	.ladder-label {
		fill: var(--ink-body);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
	}

	.bank-tick-major {
		stroke: var(--ink-body);
		stroke-width: 1.5;
	}

	.bank-tick-minor {
		stroke: var(--ink-muted);
		stroke-width: 1;
	}

	.bank-reference {
		fill: var(--ink-body);
		stroke: var(--ink-body);
	}

	.bank-pointer {
		fill: var(--avionics-pointer);
		stroke: var(--avionics-pointer);
	}

	.bezel {
		stroke: var(--edge-strong);
		stroke-width: 1.5;
	}

	.aircraft-ref line {
		stroke: var(--avionics-pointer);
		stroke-width: 2.5;
	}

	.aircraft-ref-fill {
		fill: var(--avionics-pointer);
	}
</style>
