<script lang="ts">
/**
 * Altitude Tape -- vertical tape, current value boxed at center, hundreds
 * shown as the trailing digits of the readout, thousands rendered as a
 * rolled-counter that translates smoothly as the altitude crosses each
 * thousand-foot boundary.
 *
 * The rolled-counter is a vertical stack of digit glyphs clipped by an
 * aperture cell; translating the stack by `(altitudeFeet / 1000) * cellH`
 * produces the smooth roll a real glass-cockpit altimeter shows.
 */

interface Props {
	altitudeFeet: number;
}

const { altitudeFeet }: Props = $props();

// Viewport.
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 320;
const CENTER_Y = VIEW_HEIGHT / 2;

// Tape calibration. Altitude moves more per foot at low scales than IAS
// per knot, so a smaller pixels-per-foot keeps the visible window wide.
const PIXELS_PER_FOOT = 0.06;
const VISIBLE_RANGE_FT = VIEW_HEIGHT / PIXELS_PER_FOOT;
const HALF_VISIBLE_FT = VISIBLE_RANGE_FT / 2;

const MINOR_TICK_INTERVAL_FT = 100;
const MAJOR_TICK_INTERVAL_FT = 500;
const LABEL_INTERVAL_FT = 500;

const MIN_TAPE_FT = 0;
const MAX_TAPE_FT = 30_000;

// Tick layout (left edge of the tape).
const TAPE_LEFT_X = 4;
const MAJOR_TICK_LENGTH = 14;
const MINOR_TICK_LENGTH = 7;

// Readout box.
const READOUT_WIDTH = 88;
const READOUT_HEIGHT = 32;
const READOUT_X = (VIEW_WIDTH - READOUT_WIDTH) / 2 + 4;
const READOUT_Y = CENTER_Y - READOUT_HEIGHT / 2;

// Rolled-counter cell (renders the thousands digit) -- single digit aperture.
const COUNTER_CELL_WIDTH = 18;
const COUNTER_CELL_HEIGHT = READOUT_HEIGHT - 6;
const COUNTER_CELL_X = READOUT_X + 6;
const COUNTER_CELL_Y = READOUT_Y + 3;

const alt = $derived(Number.isFinite(altitudeFeet) ? Math.max(MIN_TAPE_FT, altitudeFeet) : 0);
const tapeOffsetY = $derived(alt * PIXELS_PER_FOOT);

interface Tick {
	ft: number;
	major: boolean;
	labeled: boolean;
}

const ticks = $derived.by<readonly Tick[]>(() => {
	const lo = Math.max(
		MIN_TAPE_FT,
		Math.floor((alt - HALF_VISIBLE_FT) / MINOR_TICK_INTERVAL_FT) * MINOR_TICK_INTERVAL_FT,
	);
	const hi = Math.min(
		MAX_TAPE_FT,
		Math.ceil((alt + HALF_VISIBLE_FT) / MINOR_TICK_INTERVAL_FT) * MINOR_TICK_INTERVAL_FT,
	);
	const out: Tick[] = [];
	for (let ft = lo; ft <= hi; ft += MINOR_TICK_INTERVAL_FT) {
		const isMajor = ft % MAJOR_TICK_INTERVAL_FT === 0;
		const isLabeled = ft % LABEL_INTERVAL_FT === 0;
		out.push({ ft, major: isMajor, labeled: isLabeled });
	}
	return out;
});

function tapeY(ft: number): number {
	return CENTER_Y - ft * PIXELS_PER_FOOT;
}

// The hundreds + tens portion (last 3 chars). Always rounded to nearest foot
// for readout stability; the rolled counter handles the smooth bit.
const lowDigits = $derived(Math.floor(alt) % 1000);

// Thousands as a fractional value (e.g. 3450 ft -> 3.45) so the rolled
// counter slides smoothly across boundaries.
const thousandsFractional = $derived(alt / 1000);

// We render digits 0..9 in a vertical strip; the visible aperture shows
// `thousandsFractional mod 10`. The strip translates by
// `-thousandsFractional * cellHeight`, then we mod the offset so the
// digit roll wraps every 10 thousand feet.
const COUNTER_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const; // extra 0 for wrap continuity
const counterTranslateY = $derived(-((thousandsFractional % 10) * COUNTER_CELL_HEIGHT));

// Helpful displays.
const lowDigitsLabel = $derived(lowDigits.toString().padStart(3, '0'));
</script>

<div class="instrument" aria-label={`Altitude ${alt.toFixed(0)} feet`}>
	<svg viewBox="0 0 {VIEW_WIDTH} {VIEW_HEIGHT}" role="img" preserveAspectRatio="xMidYMid meet">
		<defs>
			<clipPath id="alt-counter-clip">
				<rect x={COUNTER_CELL_X} y={COUNTER_CELL_Y} width={COUNTER_CELL_WIDTH} height={COUNTER_CELL_HEIGHT} />
			</clipPath>
		</defs>

		<rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} class="tape-bg" />

		<!-- Scrolling tape contents -->
		<g transform="translate(0 {tapeOffsetY})">
			{#each ticks as t (t.ft)}
				{@const y = tapeY(t.ft)}
				{@const len = t.major ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH}
				<line x1={TAPE_LEFT_X} y1={y} x2={TAPE_LEFT_X + len} y2={y} class={t.major ? 'tick-major' : 'tick-minor'} />
				{#if t.labeled}
					<text x={TAPE_LEFT_X + MAJOR_TICK_LENGTH + 4} y={y + 3} text-anchor="start" class="tick-label">{t.ft}</text>
				{/if}
			{/each}
		</g>

		<!-- Centerline -->
		<line x1="0" y1={CENTER_Y} x2={VIEW_WIDTH} y2={CENTER_Y} class="centerline" />

		<!-- Readout box -->
		<rect x={READOUT_X} y={READOUT_Y} width={READOUT_WIDTH} height={READOUT_HEIGHT} class="readout-box" />

		<!-- Rolled-counter for thousands digit -->
		<g clip-path="url(#alt-counter-clip)">
			<g transform="translate({COUNTER_CELL_X} {COUNTER_CELL_Y + counterTranslateY})">
				{#each COUNTER_DIGITS as d, i (i)}
					<text x={COUNTER_CELL_WIDTH / 2} y={i * COUNTER_CELL_HEIGHT + COUNTER_CELL_HEIGHT - 6} text-anchor="middle" class="counter-digit">
						{d}
					</text>
				{/each}
			</g>
		</g>

		<!-- Hundreds + tens text (right-aligned within the readout) -->
		<text x={READOUT_X + READOUT_WIDTH - 6} y={CENTER_Y + 6} text-anchor="end" class="readout-text">
			{lowDigitsLabel}
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

	.counter-digit {
		fill: var(--ink-strong);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
	}
</style>
