<script lang="ts">
/**
 * Ideal-path overlay: actual trajectory vs scenario-authored target.
 *
 * Renders altitude (the most legible single-axis trace) against time
 * for both the recorded run and the scenario's ideal path. The pilot
 * sees how far off their flight was from the authored "good" path at
 * any moment.
 *
 * Only displayed when the scenario sets def.idealPath. Pure SVG
 * renderer, mirrors the InputTrace pattern.
 */

import type { IdealPathDefinition, ReplayFrame } from '@ab/bc-sim';
import { SIM_FEET_PER_METER } from '@ab/constants';

interface Props {
	frames: readonly ReplayFrame[];
	idealPath: IdealPathDefinition;
	currentT: number;
	width?: number;
	height?: number;
}

let { frames, idealPath, currentT, width = 1080, height = 200 }: Props = $props();

const padX = 48;
const padY = 16;

const startT = $derived(frames.length > 0 ? frames[0].t : 0);
const endT = $derived(frames.length > 0 ? frames[frames.length - 1].t : 0);
const span = $derived(Math.max(0.001, endT - startT));

/**
 * Interpolate the ideal-path altitude at sim time t (relative to the
 * tape's start). Linear interpolation between consecutive segments.
 * Returns the first segment's altitude before its endT, the last
 * segment's altitude after its endT.
 */
function idealAltitudeAt(t: number): number {
	const segs = idealPath.segments;
	if (segs.length === 0) return 0;
	if (t <= segs[0].endT) return segs[0].altitudeMsl;
	for (let i = 1; i < segs.length; i += 1) {
		const prev = segs[i - 1];
		const curr = segs[i];
		if (t <= curr.endT) {
			const span = Math.max(1e-6, curr.endT - prev.endT);
			const ratio = (t - prev.endT) / span;
			return prev.altitudeMsl + (curr.altitudeMsl - prev.altitudeMsl) * ratio;
		}
	}
	return segs[segs.length - 1].altitudeMsl;
}

// Vertical axis: altitude in feet. Pick min/max so both traces fit.
const allAltsFt = $derived.by(() => {
	const out: number[] = [];
	for (const f of frames) out.push(f.truth.altitude * SIM_FEET_PER_METER);
	for (const seg of idealPath.segments) out.push(seg.altitudeMsl * SIM_FEET_PER_METER);
	return out;
});
const minAltFt = $derived(allAltsFt.length === 0 ? 0 : Math.min(...allAltsFt));
const maxAltFt = $derived(allAltsFt.length === 0 ? 1 : Math.max(...allAltsFt));
const altSpanFt = $derived(Math.max(1, maxAltFt - minAltFt));

function tToX(t: number): number {
	return padX + ((t - startT) / span) * (width - padX * 2);
}
function altFtToY(altFt: number): number {
	const usable = height - padY * 2;
	const ratio = (altFt - minAltFt) / altSpanFt;
	return padY + (1 - ratio) * usable;
}

const actualPath = $derived.by(() => {
	if (frames.length === 0) return '';
	let d = '';
	for (let i = 0; i < frames.length; i += 1) {
		const f = frames[i];
		const x = tToX(f.t);
		const y = altFtToY(f.truth.altitude * SIM_FEET_PER_METER);
		d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
	}
	return d;
});

const idealPathStr = $derived.by(() => {
	if (idealPath.segments.length === 0) return '';
	let d = '';
	// Sample the ideal path at every actual frame so the line tracks the
	// same horizontal axis. For sparsely-segmented ideals this still
	// linearises through the keyframes; for densely-segmented ones it
	// reveals the segment-to-segment shape.
	const samples = frames.length > 0 ? frames : idealPath.segments.map((s) => ({ t: s.endT }));
	for (let i = 0; i < samples.length; i += 1) {
		const s = samples[i];
		const tRel = s.t - startT;
		const x = tToX(s.t);
		const y = altFtToY(idealAltitudeAt(tRel) * SIM_FEET_PER_METER);
		d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
	}
	return d;
});

const playheadX = $derived(tToX(startT + currentT));
</script>

<svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Altitude versus time, actual run against ideal path">
	<rect x="0" y="0" width={width} height={height} class="bg" rx="4" />
	<line x1={padX} y1={padY} x2={width - padX} y2={padY} class="grid grid-edge" />
	<line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} class="grid grid-edge" />
	<text x={padX - 6} y={padY + 4} text-anchor="end" class="axis-label">{maxAltFt.toFixed(0)} ft</text>
	<text x={padX - 6} y={height - padY + 4} text-anchor="end" class="axis-label">{minAltFt.toFixed(0)} ft</text>

	<path d={idealPathStr} class="ideal" fill="none" stroke-width="2" stroke-dasharray="6 4" />
	<path d={actualPath} class="actual" fill="none" stroke-width="1.5" />

	<line x1={playheadX} y1={padY} x2={playheadX} y2={height - padY} class="playhead" />
</svg>

<ul class="legend" aria-label="Trajectory series legend">
	<li><span class="swatch actual-swatch" aria-hidden="true"></span> Actual (truth)</li>
	<li><span class="swatch ideal-swatch" aria-hidden="true"></span> Ideal (target)</li>
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
	.grid-edge {
		stroke: var(--sim-instrument-tick-faint);
		stroke-width: 1;
		stroke-dasharray: 2 3;
		opacity: 0.6;
	}
	.axis-label {
		fill: var(--sim-instrument-tick-minor);
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs);
	}
	.actual {
		stroke: var(--sim-arc-green);
		stroke-linejoin: round;
	}
	.ideal {
		stroke: var(--sim-arc-yellow);
		stroke-linejoin: round;
	}
	.playhead {
		stroke: var(--sim-instrument-pointer);
		stroke-width: 2;
		stroke-dasharray: 3 2;
	}
	.legend {
		list-style: none;
		display: flex;
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
		width: 12px;
		height: 2px;
		border-radius: 1px;
	}
	.actual-swatch {
		background: var(--sim-arc-green);
	}
	.ideal-swatch {
		background: var(--sim-arc-yellow);
	}
</style>
