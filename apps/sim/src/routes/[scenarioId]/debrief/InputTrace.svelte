<script lang="ts">
/**
 * Input tape -- a small SVG line chart showing the pilot's throttle,
 * elevator, aileron, and rudder commands over the duration of the
 * tape. Same horizontal axis as the scrubber so a debrief reviewer
 * can see "you were holding 100% throttle when the engine quit at
 * t=42" or "your elevator went hard back when the AI started to lie."
 *
 * Pure renderer -- the caller hands in frames + the highlighted t.
 * No tape mutation, no DOM access beyond the SVG.
 */

import type { ReplayFrame } from '@ab/bc-sim';

interface Props {
	frames: readonly ReplayFrame[];
	/** Sim time the scrubber is parked at, for the playhead line. */
	currentT: number;
	/** Width of the chart in CSS pixels. Defaults to 100% of the parent. */
	width?: number;
	/** Height of the chart in CSS pixels. */
	height?: number;
}

let { frames, currentT, width = 1080, height = 160 }: Props = $props();

const padX = 36;
const padY = 16;

const startT = $derived(frames.length > 0 ? frames[0].t : 0);
const endT = $derived(frames.length > 0 ? frames[frames.length - 1].t : 0);
const span = $derived(Math.max(0.001, endT - startT));

function tToX(t: number): number {
	return padX + ((t - startT) / span) * (width - padX * 2);
}

/**
 * Inputs are 0..1 (throttle) or -1..+1 (control surfaces). Map to
 * vertical position so 0 is the centerline; +/-1 fills the chart.
 */
function valueToY(v: number, signed: boolean): number {
	const usable = height - padY * 2;
	if (signed) {
		// Centerline at midpoint; +1 -> top, -1 -> bottom.
		const t = (v + 1) / 2; // 0..1
		return padY + (1 - t) * usable;
	}
	// Throttle: 0 at bottom, 1 at top.
	return padY + (1 - Math.max(0, Math.min(1, v))) * usable;
}

interface SeriesSpec {
	id: string;
	label: string;
	color: string;
	signed: boolean;
	pick: (f: ReplayFrame) => number;
}

const SERIES: readonly SeriesSpec[] = [
	{ id: 'throttle', label: 'Throttle', color: 'var(--sim-arc-green)', signed: false, pick: (f) => f.inputs.throttle },
	{ id: 'elevator', label: 'Elevator', color: 'var(--sim-arc-yellow)', signed: true, pick: (f) => f.inputs.elevator },
	{ id: 'aileron', label: 'Aileron', color: 'var(--sim-arc-white)', signed: true, pick: (f) => f.inputs.aileron },
	{ id: 'rudder', label: 'Rudder', color: 'var(--sim-arc-red)', signed: true, pick: (f) => f.inputs.rudder },
] as const;

function pathFor(spec: SeriesSpec): string {
	if (frames.length === 0) return '';
	let d = '';
	for (let i = 0; i < frames.length; i += 1) {
		const f = frames[i];
		const x = tToX(f.t);
		const y = valueToY(spec.pick(f), spec.signed);
		d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
	}
	return d;
}

const playheadX = $derived(tToX(startT + currentT));
const centerY = $derived(padY + (height - padY * 2) / 2);
</script>

<svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pilot input traces over the run">
	<!-- Background panel -->
	<rect x="0" y="0" width={width} height={height} class="bg" rx="4" />
	<!-- Centerline + 0/1 reference for throttle (no signed-vs-unsigned ambiguity here -- both axes share the same band) -->
	<line x1={padX} y1={centerY} x2={width - padX} y2={centerY} class="grid" />
	<line x1={padX} y1={padY} x2={width - padX} y2={padY} class="grid grid-edge" />
	<line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} class="grid grid-edge" />
	<!-- Axis labels -->
	<text x={padX - 6} y={padY + 4} text-anchor="end" class="axis-label">+1</text>
	<text x={padX - 6} y={centerY + 4} text-anchor="end" class="axis-label">0</text>
	<text x={padX - 6} y={height - padY + 4} text-anchor="end" class="axis-label">-1</text>

	{#each SERIES as spec (spec.id)}
		<path d={pathFor(spec)} class="series" stroke={spec.color} fill="none" stroke-width="1.5" />
	{/each}

	<!-- Playhead at the scrubbed t -->
	<line x1={playheadX} y1={padY} x2={playheadX} y2={height - padY} class="playhead" />
</svg>

<ul class="legend" aria-label="Input series legend">
	{#each SERIES as spec (spec.id)}
		<li>
			<span class="swatch" style:background={spec.color} aria-hidden="true"></span>
			{spec.label}
		</li>
	{/each}
</ul>

<style>
	svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.bg {
		fill: var(--sim-instrument-face);
		stroke: var(--sim-instrument-bezel);
	}
	.grid {
		stroke: var(--sim-instrument-tick-faint);
		stroke-width: 1;
	}
	.grid-edge {
		stroke-dasharray: 2 3;
		opacity: 0.6;
	}
	.axis-label {
		fill: var(--sim-instrument-tick-minor);
		font-family: var(--font-family-mono, monospace);
		font-size: 10px;
	}
	.series {
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.playhead {
		stroke: var(--sim-instrument-pointer);
		stroke-width: 2;
		stroke-dasharray: 3 2;
	}
	.legend {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin: var(--space-2xs) 0 0;
		padding: 0;
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs, 12px);
		color: var(--ink-muted);
	}
	.legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}
	.swatch {
		display: inline-block;
		width: 10px;
		height: 2px;
		border-radius: 1px;
	}
</style>
