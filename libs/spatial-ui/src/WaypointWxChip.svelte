<script lang="ts">
/**
 * WaypointWxChip -- the layer-3 weather chip.
 *
 * Renders a small chip at a waypoint's projected position carrying the
 * METAR flight category (VFR / MVFR / IFR / LIFR) plus the TAF arrival
 * category when present. Clicking emits a `wx-chip-click`.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` D.2.
 */

import type { Waypoint, WaypointWxView } from '@ab/spatial-engine';
import type { GeoProjection } from 'd3-geo';

interface Props {
	/** The waypoint the chip sits on. */
	waypoint: Waypoint;
	/** The projected weather view for this waypoint. */
	wxView: WaypointWxView;
	/** The d3-geo projection. */
	projection: GeoProjection;
	/** Called when the chip is clicked. */
	onchipclick?: (args: { waypoint: Waypoint; wxView: WaypointWxView }) => void;
}

let { waypoint, wxView, projection, onchipclick }: Props = $props();

const placed = $derived(projection([waypoint.lon, waypoint.lat]));

// The chip sits below-right of the waypoint so it does not cover the
// route diamond.
const CHIP_OFFSET_X = 10;
const CHIP_OFFSET_Y = 8;
const chipWidth = 46;
const chipHeight = 18;

const metarCategory = $derived(wxView.metar?.flightCategory ?? null);
const tafCategory = $derived(wxView.taf?.arrivalFlightCategory ?? null);
</script>

{#if placed && metarCategory}
	{@const cx = placed[0] + CHIP_OFFSET_X}
	{@const cy = placed[1] + CHIP_OFFSET_Y}
	<g
		class="wx-chip wx-cat-{metarCategory.toLowerCase()}"
		data-testid="wx-chip"
		data-waypoint-id={waypoint.id}
		data-flight-category={metarCategory}
		role="button"
		aria-label="Weather at {waypoint.label}: {metarCategory}"
		tabindex="0"
		onclick={() => onchipclick?.({ waypoint, wxView })}
		onkeydown={(e) => {
			if (onchipclick && (e.key === 'Enter' || e.key === ' ')) {
				e.preventDefault();
				onchipclick({ waypoint, wxView });
			}
		}}
	>
		<rect class="wx-chip-box" x={cx} y={cy} width={chipWidth} height={chipHeight} rx="9" />
		<text class="wx-chip-text" x={cx + chipWidth / 2} y={cy + 13}>
			{metarCategory}{#if tafCategory && tafCategory !== metarCategory}&nbsp;/&nbsp;{tafCategory}{/if}
		</text>
		<title>
			{waypoint.label}: METAR {metarCategory}{#if tafCategory} -- TAF arrival {tafCategory}{/if}
		</title>
	</g>
{/if}

<style>
	.wx-chip {
		cursor: pointer;
	}

	.wx-chip-box {
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 1;
	}

	.wx-cat-vfr .wx-chip-box {
		fill: var(--color-spatial-cat-vfr);
	}

	.wx-cat-mvfr .wx-chip-box {
		fill: var(--color-spatial-cat-mvfr);
	}

	.wx-cat-ifr .wx-chip-box {
		fill: var(--color-spatial-cat-ifr);
	}

	.wx-cat-lifr .wx-chip-box {
		fill: var(--color-spatial-cat-lifr);
	}

	.wx-chip-text {
		fill: var(--color-spatial-canvas-bg);
		font-size: var(--font-size-xs);
		font-weight: 700;
		text-anchor: middle;
	}
</style>
