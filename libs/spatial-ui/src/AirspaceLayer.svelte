<script lang="ts">
/**
 * AirspaceLayer -- the layer-1 airspace renderer.
 *
 * Renders one SVG group per airspace class (B/C/D/E/SUA) with per-class
 * stroke + dasharray + fill per FAA convention. Class B = blue solid with
 * a faint fill; Class C = magenta solid; Class D = blue dashed;
 * MOA / Restricted = hatched.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.2.
 */

import type { AirspaceClass, AirspacePolygon } from '@ab/spatial-engine';
import { type GeoProjection, geoPath } from 'd3-geo';

interface Props {
	/** The region's airspace polygons. */
	airspace: AirspacePolygon[];
	/** The d3-geo projection. */
	projection: GeoProjection;
	/** Optional class filter -- only render these classes. */
	activeClasses?: AirspaceClass[];
}

let { airspace, projection, activeClasses }: Props = $props();

const path = $derived(geoPath(projection));

/** The airspace classes the renderer draws a group for, in z-order. */
const CLASS_ORDER: AirspaceClass[] = ['E', 'B', 'C', 'D', 'MOA', 'RESTRICTED', 'PROHIBITED'];

const visibleClasses = $derived(CLASS_ORDER.filter((c) => (activeClasses ? activeClasses.includes(c) : true)));

/** CSS class suffix per airspace class. */
function classSuffix(c: AirspaceClass): string {
	return c.toLowerCase();
}

/** The polygons for a given airspace class, projected to path strings. */
function pathsFor(c: AirspaceClass): Array<{ id: string; label: string; d: string }> {
	return airspace
		.filter((a) => a.airspaceClass === c)
		.map((a) => ({ id: a.id, label: a.label, d: path(a.geometry) ?? '' }));
}
</script>

<g class="airspace" data-testid="airspace-layer">
	{#each visibleClasses as airspaceClass (airspaceClass)}
		{@const polys = pathsFor(airspaceClass)}
		{#if polys.length > 0}
			<g class="airspace-class airspace-{classSuffix(airspaceClass)}" data-class={airspaceClass}>
				{#each polys as poly (poly.id)}
					<path class="airspace-poly" d={poly.d} data-airspace-id={poly.id}>
						<title>{poly.label}</title>
					</path>
				{/each}
			</g>
		{/if}
	{/each}
</g>

<style>
	.airspace-poly {
		fill: none;
	}

	/* Class B: blue solid stroke, faint fill. */
	.airspace-b .airspace-poly {
		stroke: var(--color-spatial-airspace-b);
		stroke-width: 2;
		fill: var(--color-spatial-airspace-b);
		fill-opacity: 0.06;
	}

	/* Class C: magenta solid stroke, no fill. */
	.airspace-c .airspace-poly {
		stroke: var(--color-spatial-airspace-c);
		stroke-width: 2;
	}

	/* Class D: blue dashed stroke, no fill. */
	.airspace-d .airspace-poly {
		stroke: var(--color-spatial-airspace-d);
		stroke-width: 1.5;
		stroke-dasharray: 5 3;
	}

	/* Class E: faint dashed magenta. */
	.airspace-e .airspace-poly {
		stroke: var(--color-spatial-airspace-e);
		stroke-width: 1;
		stroke-dasharray: 2 3;
		stroke-opacity: 0.6;
	}

	/* MOA / Restricted / Prohibited: hatched SUA convention. */
	.airspace-moa .airspace-poly,
	.airspace-restricted .airspace-poly,
	.airspace-prohibited .airspace-poly {
		stroke: var(--color-spatial-airspace-sua);
		stroke-width: 1.5;
		stroke-dasharray: 8 2 2 2;
	}
</style>
