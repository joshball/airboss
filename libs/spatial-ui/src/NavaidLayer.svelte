<script lang="ts">
/**
 * NavaidLayer -- the layer-1 navaid-symbol renderer.
 *
 * Renders one symbol per navaid: a star for a VOR / VORTAC / VOR-DME, a
 * dotted ring for an NDB, a small triangle for a named fix, per FAA
 * convention.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.3.
 */

import type { NavaidKind, NavaidRecord } from '@ab/spatial-engine';
import type { GeoProjection } from 'd3-geo';

interface Props {
	/** The region navaids. */
	navaids: NavaidRecord[];
	/** The d3-geo projection. */
	projection: GeoProjection;
}

let { navaids, projection }: Props = $props();

interface PlacedNavaid {
	id: string;
	name: string;
	kind: NavaidKind;
	cx: number;
	cy: number;
}

const placed = $derived.by<PlacedNavaid[]>(() => {
	const out: PlacedNavaid[] = [];
	for (const n of navaids) {
		const p = projection([n.lon, n.lat]);
		if (!p) continue;
		out.push({ id: n.id, name: n.name, kind: n.kind, cx: p[0], cy: p[1] });
	}
	return out;
});

/** Whether a navaid kind renders as a VOR-family star. */
function isVorFamily(kind: NavaidKind): boolean {
	return kind === 'VOR' || kind === 'VORTAC' || kind === 'VOR-DME';
}

/** Build the SVG points for a 5-point star centered at (cx, cy). */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
	const pts: string[] = [];
	for (let i = 0; i < 10; i++) {
		const r = i % 2 === 0 ? outer : inner;
		const angle = (Math.PI / 5) * i - Math.PI / 2;
		pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
	}
	return pts.join(' ');
}

/** Build the SVG points for an upward triangle (a fix). */
function trianglePoints(cx: number, cy: number, size: number): string {
	return `${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`;
}
</script>

<g class="navaids" data-testid="navaid-layer">
	{#each placed as navaid (navaid.id)}
		<g class="navaid-symbol navaid-{navaid.kind.toLowerCase()}" data-navaid-id={navaid.id}>
			{#if isVorFamily(navaid.kind)}
				<polygon class="navaid-vor" points={starPoints(navaid.cx, navaid.cy, 6, 2.4)} />
			{:else if navaid.kind === 'NDB'}
				<circle class="navaid-ndb" cx={navaid.cx} cy={navaid.cy} r="5" />
			{:else}
				<polygon class="navaid-fix" points={trianglePoints(navaid.cx, navaid.cy, 4)} />
			{/if}
			<text class="navaid-label" x={navaid.cx + 8} y={navaid.cy + 3}>{navaid.id}</text>
			<title>{navaid.id} -- {navaid.name} ({navaid.kind})</title>
		</g>
	{/each}
</g>

<style>
	.navaid-vor {
		fill: var(--color-spatial-navaid);
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 0.75;
	}

	.navaid-ndb {
		fill: none;
		stroke: var(--color-spatial-navaid);
		stroke-width: 1.5;
		stroke-dasharray: 2 2;
	}

	.navaid-fix {
		fill: none;
		stroke: var(--color-spatial-navaid);
		stroke-width: 1.25;
	}

	.navaid-label {
		fill: var(--color-spatial-symbol-label);
		font-size: var(--font-size-xs);
		font-style: italic;
		paint-order: stroke;
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 2;
	}
</style>
