<script lang="ts">
/**
 * RouteOverlay -- the layer-2 route renderer.
 *
 * Renders the route as an SVG path (a great-circle-ish polyline through
 * the waypoints) plus a filled diamond at each waypoint. Hovering a
 * waypoint surfaces its label; clicking emits a `waypoint-click`.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` C.2.
 */

import type { RouteSpec, Waypoint } from '@ab/spatial-engine';
import type { GeoProjection } from 'd3-geo';

interface Props {
	/** The route to render. */
	route: RouteSpec;
	/** The d3-geo projection. */
	projection: GeoProjection;
	/** Called when a waypoint is clicked. */
	onwaypointclick?: (waypoint: Waypoint) => void;
}

let { route, projection, onwaypointclick }: Props = $props();

interface PlacedWaypoint {
	waypoint: Waypoint;
	x: number;
	y: number;
}

const placed = $derived.by<PlacedWaypoint[]>(() => {
	const out: PlacedWaypoint[] = [];
	for (const wp of route.waypoints) {
		const p = projection([wp.lon, wp.lat]);
		if (!p) continue;
		out.push({ waypoint: wp, x: p[0], y: p[1] });
	}
	return out;
});

// The route line as an SVG polyline `d` string through the projected
// waypoints.
const lineD = $derived.by<string>(() => {
	if (placed.length < 2) return '';
	return placed.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
});

/** SVG points for a small diamond centered at (x, y). */
function diamond(x: number, y: number, r: number): string {
	return `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;
}
</script>

<g class="route-overlay" data-testid="route-overlay">
	{#if lineD}
		<path class="route-line" d={lineD} />
	{/if}
	{#each placed as p (p.waypoint.id)}
		<g
			class="route-waypoint-group"
			class:waypoint-airport={p.waypoint.kind === 'airport'}
			class:waypoint-fix={p.waypoint.kind === 'fix'}
			data-waypoint-id={p.waypoint.id}
			role="button"
			aria-label="Waypoint {p.waypoint.label}"
			tabindex="0"
			onclick={() => onwaypointclick?.(p.waypoint)}
			onkeydown={(e) => {
				if (onwaypointclick && (e.key === 'Enter' || e.key === ' ')) {
					e.preventDefault();
					onwaypointclick(p.waypoint);
				}
			}}
		>
			<polygon class="route-waypoint" points={diamond(p.x, p.y, 6)} />
			<text class="route-waypoint-label" x={p.x} y={p.y - 11}>{p.waypoint.label}</text>
			<title>{p.waypoint.label} ({p.waypoint.kind})</title>
		</g>
	{/each}
</g>

<style>
	.route-line {
		fill: none;
		stroke: var(--color-spatial-route-line);
		stroke-width: 2.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.route-waypoint-group {
		cursor: pointer;
	}

	.route-waypoint {
		fill: var(--color-spatial-route-waypoint);
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 1.5;
	}

	.route-waypoint-group:hover .route-waypoint,
	.route-waypoint-group:focus-visible .route-waypoint {
		fill: var(--color-spatial-route-line);
	}

	.waypoint-fix .route-waypoint {
		fill: var(--color-spatial-canvas-bg);
		stroke: var(--color-spatial-route-waypoint);
		stroke-width: 2;
	}

	.route-waypoint-label {
		fill: var(--color-spatial-route-waypoint);
		font-size: var(--font-size-xs);
		font-weight: 700;
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 3;
	}
</style>
