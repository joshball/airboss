<script lang="ts">
/**
 * SectionalCanvas -- the layer-1 basemap renderer.
 *
 * Renders the basemap features (state outlines, water, roads, cities) as
 * an SVG group via `d3-geo`'s `geoPath`. Pure browser-safe rendering
 * against `Geography` data; no DB or filesystem access.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.1.
 */

import type { Geography } from '@ab/spatial-engine';
import { type GeoProjection, geoPath } from 'd3-geo';
import type { Feature, Geometry } from 'geojson';

interface Props {
	/** The region geography. */
	geography: Geography;
	/** The d3-geo projection sized to the canvas. */
	projection: GeoProjection;
}

let { geography, projection }: Props = $props();

const path = $derived(geoPath(projection));

interface RenderedFeature {
	kind: string;
	name: string | undefined;
	d: string;
	isPoint: boolean;
	cx: number;
	cy: number;
}

// Project every basemap feature to an SVG path string. Point features
// (cities) get a projected centroid for the marker + label.
const rendered = $derived.by<RenderedFeature[]>(() => {
	const out: RenderedFeature[] = [];
	for (const feature of geography.basemap.features as Feature<Geometry, { kind: string; name?: string }>[]) {
		const kind = feature.properties.kind;
		const name = feature.properties.name;
		if (feature.geometry.type === 'Point') {
			const coords = feature.geometry.coordinates as [number, number];
			const projected = projection(coords);
			out.push({
				kind,
				name,
				d: '',
				isPoint: true,
				cx: projected ? projected[0] : 0,
				cy: projected ? projected[1] : 0,
			});
		} else {
			out.push({ kind, name, d: path(feature) ?? '', isPoint: false, cx: 0, cy: 0 });
		}
	}
	return out;
});
</script>

<g class="basemap" data-testid="basemap-layer">
	{#each rendered as feature, i (i)}
		{#if feature.isPoint}
			<g class="basemap-feature basemap-city">
				<circle class="city-dot" cx={feature.cx} cy={feature.cy} r="3" />
				{#if feature.name}
					<text class="city-label" x={feature.cx + 6} y={feature.cy + 4}>{feature.name}</text>
				{/if}
			</g>
		{:else}
			<path class="basemap-feature basemap-{feature.kind}" d={feature.d} />
		{/if}
	{/each}
</g>

<style>
	.basemap-water {
		fill: var(--color-spatial-water);
		stroke: var(--color-spatial-water);
		stroke-width: 1.5;
		fill-opacity: 0.55;
	}

	.basemap-road {
		fill: none;
		stroke: var(--color-spatial-road);
		stroke-width: 1.25;
		stroke-dasharray: 1 0;
	}

	.basemap-state-outline {
		fill: none;
		stroke: var(--color-spatial-state-outline);
		stroke-width: 1;
		stroke-dasharray: 6 4;
	}

	.city-dot {
		fill: var(--color-spatial-city);
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 1;
	}

	.city-label {
		fill: var(--color-spatial-city-label);
		font-size: var(--font-size-sm);
		font-weight: 600;
		paint-order: stroke;
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 3;
	}
</style>
