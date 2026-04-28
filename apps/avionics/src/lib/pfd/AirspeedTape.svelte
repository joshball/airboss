<script lang="ts">
/**
 * Airspeed Tape -- vertical tape, current value boxed at center, white/
 * green/yellow arc bands and a Vne red line drawn against the tape edge.
 *
 * Visible window covers `VISIBLE_RANGE_KT` knots centered on the current
 * airspeed; the tape "scrolls" by translating a long inner group up/down
 * by `pixelsPerKt * airspeed`.
 *
 * Aircraft-agnostic: V-speeds come in as `arcs` from the parent. The
 * parent computes them from the selected aircraft's FDM config via
 * `arcBandsFromConfig()`.
 */

import type { AirspeedArcBands } from './airspeed-arcs';

interface Props {
	airspeedKnots: number;
	arcs: AirspeedArcBands;
}

const { airspeedKnots, arcs }: Props = $props();

// SVG viewport.
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 320;
const CENTER_Y = VIEW_HEIGHT / 2;

// Tape calibration.
const PIXELS_PER_KT = 3;
const VISIBLE_RANGE_KT = VIEW_HEIGHT / PIXELS_PER_KT;
const HALF_VISIBLE_KT = VISIBLE_RANGE_KT / 2;

// Tick authoring.
const MAJOR_TICK_INTERVAL_KT = 10;
const MINOR_TICK_INTERVAL_KT = 5;
const LABEL_INTERVAL_KT = 20;

// Tape extent (the long inner group). Allow speeds 0..MAX_TAPE_KT.
const MIN_TAPE_KT = 0;
const MAX_TAPE_KT = 250;

// Tick geometry (right edge of the tape; the arc band hugs the inner edge).
const TAPE_RIGHT_X = 78;
const MAJOR_TICK_LENGTH = 12;
const MINOR_TICK_LENGTH = 6;
const ARC_BAND_X = 88;
const ARC_BAND_WIDTH = 10;
const RED_LINE_WIDTH = 4;

// Center readout box dimensions.
const READOUT_HEIGHT = 28;
const READOUT_WIDTH = 78;

const ias = $derived(Number.isFinite(airspeedKnots) ? Math.max(MIN_TAPE_KT, airspeedKnots) : 0);
const tapeOffsetY = $derived(ias * PIXELS_PER_KT);

// Tick list -- only render ticks in the visible window (perf + readability).
interface Tick {
	kt: number;
	major: boolean;
	labeled: boolean;
}

const ticks = $derived.by<readonly Tick[]>(() => {
	const lo = Math.max(
		MIN_TAPE_KT,
		Math.floor((ias - HALF_VISIBLE_KT) / MINOR_TICK_INTERVAL_KT) * MINOR_TICK_INTERVAL_KT,
	);
	const hi = Math.min(
		MAX_TAPE_KT,
		Math.ceil((ias + HALF_VISIBLE_KT) / MINOR_TICK_INTERVAL_KT) * MINOR_TICK_INTERVAL_KT,
	);
	const out: Tick[] = [];
	for (let kt = lo; kt <= hi; kt += MINOR_TICK_INTERVAL_KT) {
		const isMajor = kt % MAJOR_TICK_INTERVAL_KT === 0;
		const isLabeled = kt % LABEL_INTERVAL_KT === 0;
		out.push({ kt, major: isMajor, labeled: isLabeled });
	}
	return out;
});

// Convert a knots value to its tape-internal y in screen coordinates
// when `tapeOffsetY` has been applied. y = CENTER_Y + (ias - kt) * px/kt.
function tapeY(kt: number): number {
	return CENTER_Y - kt * PIXELS_PER_KT;
}

// Arc band rectangles in tape-internal coordinates (before tape translation).
const whiteY = $derived(tapeY(arcs.whiteEndKt));
const whiteHeight = $derived((arcs.whiteEndKt - arcs.whiteStartKt) * PIXELS_PER_KT);
const greenY = $derived(tapeY(arcs.greenEndKt));
const greenHeight = $derived((arcs.greenEndKt - arcs.greenStartKt) * PIXELS_PER_KT);
const yellowY = $derived(tapeY(arcs.yellowEndKt));
const yellowHeight = $derived((arcs.yellowEndKt - arcs.greenEndKt) * PIXELS_PER_KT);
const redY = $derived(tapeY(arcs.redLineKt));
</script>

<div class="instrument" aria-label={`Airspeed ${ias.toFixed(0)} knots`}>
	<svg viewBox="0 0 {VIEW_WIDTH} {VIEW_HEIGHT}" role="img" preserveAspectRatio="xMidYMid meet">
		<!-- Tape background -->
		<rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} class="tape-bg" />

		<!-- Scrolling tape contents -->
		<g transform="translate(0 {tapeOffsetY})">
			<!-- Arc bands (drawn first so ticks paint on top) -->
			<rect x={ARC_BAND_X} y={whiteY} width={ARC_BAND_WIDTH} height={whiteHeight} class="band-white" />
			<rect x={ARC_BAND_X} y={greenY} width={ARC_BAND_WIDTH} height={greenHeight} class="band-green" />
			<rect x={ARC_BAND_X} y={yellowY} width={ARC_BAND_WIDTH} height={yellowHeight} class="band-yellow" />
			<rect x={ARC_BAND_X - RED_LINE_WIDTH} y={redY - 1} width={ARC_BAND_WIDTH + RED_LINE_WIDTH} height="2" class="redline" />

			<!-- Ticks + labels -->
			{#each ticks as t (t.kt)}
				{@const y = tapeY(t.kt)}
				{@const len = t.major ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH}
				<line x1={TAPE_RIGHT_X - len} y1={y} x2={TAPE_RIGHT_X} y2={y} class={t.major ? 'tick-major' : 'tick-minor'} />
				{#if t.labeled}
					<text x={TAPE_RIGHT_X - MAJOR_TICK_LENGTH - 4} y={y + 3} text-anchor="end" class="tick-label">{t.kt}</text>
				{/if}
			{/each}
		</g>

		<!-- Centerline indicator (fixed) -->
		<line x1="0" y1={CENTER_Y} x2={VIEW_WIDTH} y2={CENTER_Y} class="centerline" />

		<!-- Center readout box (fixed) -->
		<rect
			x={(VIEW_WIDTH - READOUT_WIDTH) / 2 - 6}
			y={CENTER_Y - READOUT_HEIGHT / 2}
			width={READOUT_WIDTH}
			height={READOUT_HEIGHT}
			class="readout-box"
		/>
		<text x={(VIEW_WIDTH - READOUT_WIDTH) / 2 - 6 + READOUT_WIDTH - 8} y={CENTER_Y + 6} text-anchor="end" class="readout-text">
			{ias.toFixed(0)}
		</text>
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

	.tape-bg {
		fill: var(--surface-sunken);
	}

	.band-white {
		fill: var(--avionics-arc-white);
	}

	.band-green {
		fill: var(--avionics-arc-green);
	}

	.band-yellow {
		fill: var(--avionics-arc-yellow);
	}

	.redline {
		fill: var(--avionics-arc-red);
	}

	.tick-major {
		stroke: var(--ink-body);
		stroke-width: 1.5;
	}

	.tick-minor {
		stroke: var(--ink-muted);
		stroke-width: 1;
	}

	.tick-label {
		fill: var(--ink-body);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
	}

	.centerline {
		stroke: var(--avionics-pointer);
		stroke-width: 1;
		opacity: 0.5;
	}

	.readout-box {
		fill: var(--surface-page);
		stroke: var(--avionics-pointer);
		stroke-width: 1.5;
	}

	.readout-text {
		fill: var(--ink-strong);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
	}
</style>
