<script lang="ts">
/**
 * Vertical Speed Indicator -- vertical strip with a moving pointer
 * showing climb/descent rate. Range is +/-2000 fpm with major ticks
 * every 500 fpm. Pointer color uses the avionics pointer token.
 *
 * Numeric readout floats next to the pointer when |VS| is above the
 * dead zone (per real PFD convention; small VS noise stays unlabelled).
 */

interface Props {
	verticalSpeedFpm: number;
}

const { verticalSpeedFpm }: Props = $props();

// Viewport.
const VIEW_WIDTH = 60;
const VIEW_HEIGHT = 320;
const CENTER_Y = VIEW_HEIGHT / 2;

// Scale: -2000..+2000 fpm maps to (CENTER_Y + RANGE) .. (CENTER_Y - RANGE).
const RANGE_FPM = 2000;
const PIXELS_PER_FPM = (VIEW_HEIGHT / 2 - 10) / RANGE_FPM;

// Tick authoring (absolute fpm values).
const MAJOR_TICKS_FPM: ReadonlyArray<number> = [-2000, -1500, -1000, -500, 0, 500, 1000, 1500, 2000];
const MINOR_TICKS_FPM: ReadonlyArray<number> = [-1750, -1250, -750, -250, 250, 750, 1250, 1750];

// Tick layout (left edge of the strip).
const STRIP_LEFT_X = 4;
const MAJOR_TICK_LENGTH = 12;
const MINOR_TICK_LENGTH = 6;

// Pointer triangle.
const POINTER_TIP_X = 0;
const POINTER_BASE_X = 22;

// Dead zone for the floating numeric readout.
const READOUT_DEAD_ZONE_FPM = 100;

const vs = $derived.by(() => {
	if (!Number.isFinite(verticalSpeedFpm)) return 0;
	if (verticalSpeedFpm > RANGE_FPM) return RANGE_FPM;
	if (verticalSpeedFpm < -RANGE_FPM) return -RANGE_FPM;
	return verticalSpeedFpm;
});

function fpmToY(fpm: number): number {
	return CENTER_Y - fpm * PIXELS_PER_FPM;
}

const pointerY = $derived(fpmToY(vs));
const showReadout = $derived(Math.abs(vs) >= READOUT_DEAD_ZONE_FPM);

function tickLabel(fpm: number): string {
	if (fpm === 0) return '0';
	// Use abbreviated label: 500 -> "5", 1000 -> "10", etc. (per glass-cockpit
	// convention where labels read as hundreds-of-fpm scaled by 0.1).
	return (Math.abs(fpm) / 100).toString();
}
</script>

<div class="instrument" aria-label={`Vertical speed ${vs.toFixed(0)} feet per minute`}>
	<svg viewBox="0 0 {VIEW_WIDTH} {VIEW_HEIGHT}" role="img" preserveAspectRatio="xMidYMid meet">
		<rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} class="strip-bg" />

		<!-- Center reference -->
		<line x1="0" y1={CENTER_Y} x2={VIEW_WIDTH} y2={CENTER_Y} class="centerline" />

		<!-- Major ticks + labels -->
		{#each MAJOR_TICKS_FPM as fpm (fpm)}
			{@const y = fpmToY(fpm)}
			<line x1={STRIP_LEFT_X} y1={y} x2={STRIP_LEFT_X + MAJOR_TICK_LENGTH} y2={y} class="tick-major" />
			<text x={STRIP_LEFT_X + MAJOR_TICK_LENGTH + 4} y={y + 3} text-anchor="start" class="tick-label">
				{tickLabel(fpm)}
			</text>
		{/each}

		<!-- Minor ticks -->
		{#each MINOR_TICKS_FPM as fpm (fpm)}
			{@const y = fpmToY(fpm)}
			<line x1={STRIP_LEFT_X} y1={y} x2={STRIP_LEFT_X + MINOR_TICK_LENGTH} y2={y} class="tick-minor" />
		{/each}

		<!-- Pointer triangle pointing left at current vs -->
		<path
			d="M {POINTER_TIP_X} {pointerY} L {POINTER_BASE_X} {pointerY - 6} L {POINTER_BASE_X} {pointerY + 6} z"
			class="pointer"
		/>

		<!-- Floating numeric readout -->
		{#if showReadout}
			<text x={VIEW_WIDTH - 4} y={pointerY + 3} text-anchor="end" class="readout-text">
				{Math.round(vs)}
			</text>
		{/if}
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

	.centerline {
		stroke: var(--ink-muted);
		stroke-width: 1;
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

	.pointer {
		fill: var(--avionics-pointer);
		stroke: var(--avionics-pointer);
	}

	.readout-text {
		fill: var(--ink-strong);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
	}
</style>
