<script lang="ts">
/**
 * AirmetPolygon -- the layer-3 AIRMET ring renderer.
 *
 * Renders an AIRMET polygon as an SVG path with a per-family stroke +
 * dasharray: Sierra (IFR / mtn obscuration) orange dashed, Tango
 * (turbulence) yellow dashed, Zulu (icing) cyan dashed. Hover surfaces
 * the AIRMET id; click emits an `airmet-click`.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` D.3.
 */

import type { AirmetView } from '@ab/spatial-engine';
import type { GeoProjection } from 'd3-geo';

interface Props {
	/** The AIRMET to render. */
	airmet: AirmetView;
	/** The d3-geo projection. */
	projection: GeoProjection;
	/** Called when the polygon is clicked. */
	onairmetclick?: (airmet: AirmetView) => void;
}

let { airmet, projection, onairmetclick }: Props = $props();

// Project each ring to an SVG path `d` string.
const ringPaths = $derived.by<string[]>(() => {
	const paths: string[] = [];
	for (const ring of airmet.rings) {
		const pts: string[] = [];
		for (const [lon, lat] of ring) {
			const p = projection([lon, lat]);
			if (p) pts.push(`${p[0]},${p[1]}`);
		}
		if (pts.length >= 3) {
			paths.push(`M ${pts.join(' L ')} Z`);
		}
	}
	return paths;
});

/** The first ring's centroid label anchor, projected. */
const labelAnchor = $derived.by<{ x: number; y: number } | null>(() => {
	const ring = airmet.rings[0];
	if (!ring || ring.length === 0) return null;
	let sx = 0;
	let sy = 0;
	let n = 0;
	for (const [lon, lat] of ring) {
		const p = projection([lon, lat]);
		if (p) {
			sx += p[0];
			sy += p[1];
			n++;
		}
	}
	return n > 0 ? { x: sx / n, y: sy / n } : null;
});

const familySuffix = $derived(airmet.family.replace('airmet-', ''));
</script>

<g
	class="airmet airmet-{familySuffix}"
	data-testid="airmet-polygon"
	data-airmet-id={airmet.id}
	data-airmet-family={airmet.family}
	role="button"
	aria-label="AIRMET {airmet.id}"
	tabindex="0"
	onclick={() => onairmetclick?.(airmet)}
	onkeydown={(e) => {
		if (onairmetclick && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			onairmetclick(airmet);
		}
	}}
>
	{#each ringPaths as d, i (i)}
		<path class="airmet-ring" {d} />
	{/each}
	{#if labelAnchor}
		<text class="airmet-label" x={labelAnchor.x} y={labelAnchor.y}>{familySuffix.toUpperCase()}</text>
	{/if}
	<title>{airmet.label}</title>
</g>

<style>
	.airmet {
		cursor: pointer;
	}

	.airmet-ring {
		fill: none;
		stroke-width: 2;
		stroke-dasharray: 7 4;
	}

	.airmet-sierra .airmet-ring {
		stroke: var(--color-spatial-airmet-sierra);
	}

	.airmet-tango .airmet-ring {
		stroke: var(--color-spatial-airmet-tango);
	}

	.airmet-zulu .airmet-ring {
		stroke: var(--color-spatial-airmet-zulu);
	}

	.airmet:hover .airmet-ring,
	.airmet:focus-visible .airmet-ring {
		stroke-width: 3;
	}

	.airmet-label {
		font-size: var(--font-size-xs);
		font-weight: 700;
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 3;
	}

	.airmet-sierra .airmet-label {
		fill: var(--color-spatial-airmet-sierra);
	}

	.airmet-tango .airmet-label {
		fill: var(--color-spatial-airmet-tango);
	}

	.airmet-zulu .airmet-label {
		fill: var(--color-spatial-airmet-zulu);
	}
</style>
