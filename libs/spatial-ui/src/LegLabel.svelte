<script lang="ts">
/**
 * LegLabel -- a per-leg callout on the route.
 *
 * Phase C renders the geometry-only payload (distance + true course) from
 * a `LegPlaceholder`. Phase E passes a full `LegPerformance` and the
 * label extends with fuel + ETE + wind. The component accepts either and
 * degrades gracefully.
 *
 * The callout sits at the leg midpoint with a leader line back to the
 * route. Hovering surfaces the basic info; clicking emits `leg-click`.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` C.3 + E.3.
 */

import type { LegPerformance } from '@ab/spatial-engine';
import type { LegLabelData } from './types';

interface Props {
	/** The leg data (placeholder or full). */
	leg: LegLabelData;
	/** The leg midpoint in projected SVG coordinates. */
	midpoint: { x: number; y: number };
	/** Called when the label is clicked. */
	onlegclick?: (leg: LegLabelData) => void;
}

let { leg, midpoint, onlegclick }: Props = $props();

/** Whether the leg carries the full performance payload. */
function isFull(l: LegLabelData): l is LegPerformance {
	return 'fuelGal' in l && 'eteMin' in l;
}

const full = $derived(isFull(leg));

// The geometry line: "<dist> nm / <course> deg".
const geometryLine = $derived(`${leg.distanceNm.toFixed(0)} nm / ${leg.trueCourse.toFixed(0)}°`);

// The performance line, only when the full payload is present.
const perfLine = $derived(full && isFull(leg) ? `${leg.fuelGal.toFixed(1)} gal / ${leg.eteMin.toFixed(0)} min` : '');
const windLine = $derived(full && isFull(leg) ? `wind ${leg.windFromDeg.toFixed(0)}°/${leg.windKt.toFixed(0)} kt` : '');

// Label box dimensions -- two or three lines depending on payload.
const lineCount = $derived(full ? 3 : 1);
const boxWidth = 116;
const boxHeight = $derived(14 + lineCount * 13);
// Offset the box above-right of the midpoint with a leader line.
const offsetX = 18;
const offsetY = -10;
const boxX = $derived(midpoint.x + offsetX);
const boxY = $derived(midpoint.y + offsetY - boxHeight);
</script>

<g
	class="leg-label"
	data-testid="leg-label"
	data-leg-from={leg.from}
	data-leg-to={leg.to}
	role="button"
	aria-label="Leg {leg.from} to {leg.to}"
	tabindex="0"
	onclick={() => onlegclick?.(leg)}
	onkeydown={(e) => {
		if (onlegclick && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			onlegclick(leg);
		}
	}}
>
	<line class="leg-leader" x1={midpoint.x} y1={midpoint.y} x2={boxX} y2={boxY + boxHeight} />
	<rect class="leg-box" x={boxX} y={boxY} width={boxWidth} height={boxHeight} rx="3" />
	<text class="leg-text leg-text-geometry" x={boxX + 7} y={boxY + 15}>{geometryLine}</text>
	{#if full}
		<text class="leg-text leg-text-perf" x={boxX + 7} y={boxY + 28}>{perfLine}</text>
		<text class="leg-text leg-text-wind" x={boxX + 7} y={boxY + 41}>{windLine}</text>
	{/if}
	<title>Leg {leg.from} -> {leg.to}</title>
</g>

<style>
	.leg-label {
		cursor: pointer;
	}

	.leg-leader {
		stroke: var(--color-spatial-leg-leader);
		stroke-width: 1;
		stroke-dasharray: 2 2;
	}

	.leg-box {
		fill: var(--color-spatial-leg-label-bg);
		stroke: var(--color-spatial-leg-leader);
		stroke-width: 1;
	}

	.leg-text {
		fill: var(--color-spatial-leg-label-ink);
		font-size: var(--font-size-xs);
	}

	.leg-text-geometry {
		font-weight: 700;
	}

	.leg-label:hover .leg-box,
	.leg-label:focus-visible .leg-box {
		stroke: var(--color-spatial-route-line);
	}
</style>
