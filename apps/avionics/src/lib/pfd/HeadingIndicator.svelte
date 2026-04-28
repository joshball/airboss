<script lang="ts">
/**
 * Heading Indicator -- horizontal compass strip across the bottom of the
 * PFD. Current heading boxed at top-center, cardinal labels at N/E/S/W,
 * ticks every 10deg with major numeric labels every 30deg per the
 * glass-cockpit convention ("3" for 30, "33" for 330, etc.).
 *
 * The strip translates so the current heading is centered. Headings wrap
 * mod 360, so we render ticks across a window that covers the visible
 * range plus a small overscan for smooth scrolling.
 */

interface Props {
	headingDegMag: number;
}

const { headingDegMag }: Props = $props();

// Viewport.
const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 64;
const CENTER_X = VIEW_WIDTH / 2;

// Strip calibration.
const PIXELS_PER_DEG = 4;
const VISIBLE_RANGE_DEG = VIEW_WIDTH / PIXELS_PER_DEG;
const HALF_VISIBLE_DEG = VISIBLE_RANGE_DEG / 2;

const MINOR_TICK_INTERVAL_DEG = 5;
const MAJOR_TICK_INTERVAL_DEG = 10;
const LABEL_INTERVAL_DEG = 30;

// Tick geometry (top edge of the strip).
const STRIP_TOP_Y = 24;
const MAJOR_TICK_LENGTH = 12;
const MINOR_TICK_LENGTH = 6;

// Readout box at top-center.
const READOUT_WIDTH = 56;
const READOUT_HEIGHT = 22;

const heading = $derived((((Number.isFinite(headingDegMag) ? headingDegMag : 0) % 360) + 360) % 360);
const headingForLabel = $derived(Math.round(heading) === 0 ? 360 : Math.round(heading));

// Render ticks across [heading - HALF_VISIBLE_DEG - overscan, heading + ...]
// using absolute degrees, then position each at `(deg - heading)*px/deg + cx`.
const OVERSCAN_DEG = 10;

interface Tick {
	deg: number; // 0..359 normalized
	major: boolean;
	cardinal: string | null;
	majorLabel: string | null;
}

function cardinalFor(deg: number): string | null {
	if (deg === 0) return 'N';
	if (deg === 90) return 'E';
	if (deg === 180) return 'S';
	if (deg === 270) return 'W';
	return null;
}

function majorLabelFor(deg: number): string | null {
	if (deg % LABEL_INTERVAL_DEG !== 0) return null;
	if (cardinalFor(deg) !== null) return null;
	// Glass-cockpit convention: drop the trailing zero ("3" for 30, "33" for 330).
	return Math.round(deg / 10).toString();
}

const ticks = $derived.by<readonly Tick[]>(() => {
	const lo =
		Math.floor((heading - HALF_VISIBLE_DEG - OVERSCAN_DEG) / MINOR_TICK_INTERVAL_DEG) * MINOR_TICK_INTERVAL_DEG;
	const hi = Math.ceil((heading + HALF_VISIBLE_DEG + OVERSCAN_DEG) / MINOR_TICK_INTERVAL_DEG) * MINOR_TICK_INTERVAL_DEG;
	const out: Tick[] = [];
	for (let raw = lo; raw <= hi; raw += MINOR_TICK_INTERVAL_DEG) {
		const norm = ((raw % 360) + 360) % 360;
		const isMajor = norm % MAJOR_TICK_INTERVAL_DEG === 0;
		out.push({
			deg: raw, // keep raw for placement; norm only for labelling
			major: isMajor,
			cardinal: cardinalFor(norm),
			majorLabel: isMajor ? majorLabelFor(norm) : null,
		});
	}
	return out;
});

function tickX(rawDeg: number): number {
	return CENTER_X + (rawDeg - heading) * PIXELS_PER_DEG;
}
</script>

<div class="instrument" aria-label={`Heading ${headingForLabel} degrees`}>
	<svg viewBox="0 0 {VIEW_WIDTH} {VIEW_HEIGHT}" role="img" preserveAspectRatio="xMidYMid meet">
		<rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} class="strip-bg" />

		<!-- Tick + label strip -->
		<g>
			{#each ticks as t, i (i)}
				{@const x = tickX(t.deg)}
				{@const len = t.major ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH}
				<line x1={x} y1={STRIP_TOP_Y} x2={x} y2={STRIP_TOP_Y + len} class={t.major ? 'tick-major' : 'tick-minor'} />
				{#if t.cardinal !== null}
					<text x={x} y={STRIP_TOP_Y + MAJOR_TICK_LENGTH + 16} text-anchor="middle" class="cardinal-label">
						{t.cardinal}
					</text>
				{:else if t.majorLabel !== null}
					<text x={x} y={STRIP_TOP_Y + MAJOR_TICK_LENGTH + 14} text-anchor="middle" class="major-label">
						{t.majorLabel}
					</text>
				{/if}
			{/each}
		</g>

		<!-- Center pointer triangle (fixed) -->
		<path
			d="M {CENTER_X - 6} {STRIP_TOP_Y - 4} L {CENTER_X + 6} {STRIP_TOP_Y - 4} L {CENTER_X} {STRIP_TOP_Y + 4} z"
			class="pointer"
		/>

		<!-- Readout box (fixed) -->
		<rect
			x={CENTER_X - READOUT_WIDTH / 2}
			y="0"
			width={READOUT_WIDTH}
			height={READOUT_HEIGHT}
			class="readout-box"
		/>
		<text x={CENTER_X} y={READOUT_HEIGHT - 6} text-anchor="middle" class="readout-text">
			{headingForLabel.toString().padStart(3, '0')}
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

	.strip-bg {
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

	.cardinal-label {
		fill: var(--ink-strong);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
	}

	.major-label {
		fill: var(--ink-body);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
	}

	.pointer {
		fill: var(--avionics-pointer);
		stroke: var(--avionics-pointer);
	}

	.readout-box {
		fill: var(--surface-page);
		stroke: var(--avionics-pointer);
		stroke-width: 1.5;
	}

	.readout-text {
		fill: var(--ink-strong);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
	}
</style>
