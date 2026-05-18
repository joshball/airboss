<script lang="ts">
/**
 * XcViewer -- the top-level XC viewer composition.
 *
 * Renders a `ScenarioBundle` into an interactive SVG sectional. Phase B
 * shipped the layer-1 sectional + pan/zoom chrome; Phase C added the
 * layer-2 route overlay + per-leg labels; Phase D added the layer-3
 * weather overlay (chips + AIRMET polygons + the waypoint detail drawer);
 * Phase E adds the per-leg performance, the leg detail drawer, and the
 * sticky performance band.
 *
 * Pure browser-safe rendering -- the bundle is loaded server-side and
 * passed in as a prop.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.5 + C.4 + D.4 + E.6.
 */

import '@ab/themes/spatial-tokens.css';
import {
	greatCircleBearing,
	greatCircleNm,
	type LegPerformance,
	regionalLambertProjection,
	type ScenarioBundle,
	SECTIONAL_SVG_HEIGHT,
	SECTIONAL_SVG_WIDTH,
	type Waypoint,
} from '@ab/spatial-engine';
import AirmetPolygon from './AirmetPolygon.svelte';
import AirportLayer from './AirportLayer.svelte';
import AirspaceLayer from './AirspaceLayer.svelte';
import LayerToggle from './controls/LayerToggle.svelte';
import type { CanvasTransform } from './controls/types';
import ZoomPanControls from './controls/ZoomPanControls.svelte';
import LegDetailDrawer from './LegDetailDrawer.svelte';
import LegLabel from './LegLabel.svelte';
import NavaidLayer from './NavaidLayer.svelte';
import PerformanceBand from './PerformanceBand.svelte';
import RouteOverlay from './RouteOverlay.svelte';
import SectionalCanvas from './SectionalCanvas.svelte';
import { SPATIAL_LAYER_KEYS, type SpatialLayerKey } from './styles/tokens';
import type { LegLabelData } from './types';
import WaypointDetailDrawer from './WaypointDetailDrawer.svelte';
import WaypointWxChip from './WaypointWxChip.svelte';

interface Props {
	/** The composed scenario bundle. */
	bundle: ScenarioBundle;
}

let { bundle }: Props = $props();

const WIDTH = SECTIONAL_SVG_WIDTH;
const HEIGHT = SECTIONAL_SVG_HEIGHT;

// Project the region, fitted to the basemap so the region fills the canvas.
const projection = $derived(
	regionalLambertProjection(bundle.geography.regionSlug, {
		width: WIDTH,
		height: HEIGHT,
		fitTarget: bundle.geography.basemap,
	}),
);

// Pan / zoom transform applied to the content group.
let transform = $state<CanvasTransform>({ scale: 1, x: 0, y: 0 });

// Which layers are visible.
let visibleLayers = $state<SpatialLayerKey[]>([
	SPATIAL_LAYER_KEYS.BASEMAP,
	SPATIAL_LAYER_KEYS.AIRSPACE,
	SPATIAL_LAYER_KEYS.NAVAIDS,
	SPATIAL_LAYER_KEYS.AIRPORTS,
	SPATIAL_LAYER_KEYS.ROUTE,
	SPATIAL_LAYER_KEYS.WEATHER,
]);

const exposedLayers: SpatialLayerKey[] = [
	SPATIAL_LAYER_KEYS.BASEMAP,
	SPATIAL_LAYER_KEYS.AIRSPACE,
	SPATIAL_LAYER_KEYS.NAVAIDS,
	SPATIAL_LAYER_KEYS.AIRPORTS,
	SPATIAL_LAYER_KEYS.ROUTE,
	SPATIAL_LAYER_KEYS.WEATHER,
];

function shows(layer: SpatialLayerKey): boolean {
	return visibleLayers.includes(layer);
}

const contentTransform = $derived(`translate(${transform.x} ${transform.y}) scale(${transform.scale})`);

// --- Leg rendering data ---
//
// When the bundle carries a derived performance table (Phase E build),
// use it. Otherwise compute geometry-only placeholders inline so the leg
// labels still render before the performance derivation lands.
interface LegRender {
	leg: LegLabelData;
	midpoint: { x: number; y: number };
}

const legRenders = $derived.by<LegRender[]>(() => {
	const waypoints = bundle.flight.route.waypoints;
	const out: LegRender[] = [];
	for (let i = 0; i < waypoints.length - 1; i++) {
		const from = waypoints[i];
		const to = waypoints[i + 1];
		const fromP = projection([from.lon, from.lat]);
		const toP = projection([to.lon, to.lat]);
		if (!fromP || !toP) continue;
		const mid = { x: (fromP[0] + toP[0]) / 2, y: (fromP[1] + toP[1]) / 2 };
		const perfLeg: LegPerformance | undefined = bundle.performance.legs[i];
		const leg: LegLabelData = perfLeg ?? {
			from: from.id,
			to: to.id,
			distanceNm: greatCircleNm(from.lon, from.lat, to.lon, to.lat),
			trueCourse: greatCircleBearing(from.lon, from.lat, to.lon, to.lat),
		};
		out.push({ leg, midpoint: mid });
	}
	return out;
});

// --- Waypoint detail drawer state ---
let drawerWaypoint = $state<Waypoint | null>(null);

const drawerWxView = $derived(drawerWaypoint ? (bundle.weather.byWaypoint[drawerWaypoint.id] ?? null) : null);
const drawerAirport = $derived(
	drawerWaypoint?.airportIcao
		? (bundle.geography.airports.find((a) => a.icao === drawerWaypoint?.airportIcao) ?? null)
		: null,
);
const drawerOpen = $derived(drawerWaypoint !== null);

function openWaypoint(waypoint: Waypoint) {
	drawerWaypoint = waypoint;
	drawerLeg = null;
}

function closeDrawer() {
	drawerWaypoint = null;
}

// --- Leg detail drawer state ---
//
// Only a full `LegPerformance` opens the drawer; a geometry-only
// placeholder (before the performance build) is not worth a drawer.
let drawerLeg = $state<LegPerformance | null>(null);

const legDrawerOpen = $derived(drawerLeg !== null);

function isFullLeg(leg: LegLabelData): leg is LegPerformance {
	return 'fuelGal' in leg && 'eteMin' in leg;
}

function openLeg(leg: LegLabelData) {
	if (isFullLeg(leg)) {
		drawerLeg = leg;
		drawerWaypoint = null;
	}
}

function closeLegDrawer() {
	drawerLeg = null;
}

// The performance band renders only when the bundle carries a derived
// performance table (it does once `xc-scenario build` has run).
const hasPerformance = $derived(bundle.performance.legs.length > 0);

// --- Drag-to-pan ---
//
// A pointer is "armed" on pointerdown but the drag (and the SVG pointer
// capture) only starts once the pointer actually moves past a small
// threshold. Capturing on pointerdown would redirect the pointerup to the
// SVG and swallow the `click` event a child waypoint / chip needs --
// arming-then-dragging keeps child clicks working.
const DRAG_THRESHOLD_PX = 4;
let dragging = $state(false);
let armedPointerId: number | null = null;
let dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

function onPointerDown(e: PointerEvent) {
	armedPointerId = e.pointerId;
	dragging = false;
	dragStart = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
}

function onPointerMove(e: PointerEvent) {
	if (armedPointerId !== e.pointerId) return;
	const dx = e.clientX - dragStart.x;
	const dy = e.clientY - dragStart.y;
	if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
	if (!dragging) {
		dragging = true;
		(e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
	}
	transform = { ...transform, x: dragStart.tx + dx, y: dragStart.ty + dy };
}

function onPointerUp(e: PointerEvent) {
	if (dragging) {
		(e.currentTarget as SVGElement).releasePointerCapture?.(e.pointerId);
	}
	dragging = false;
	armedPointerId = null;
}

function onWheel(e: WheelEvent) {
	e.preventDefault();
	const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
	const next = Math.max(0.5, Math.min(8, transform.scale * factor));
	transform = { ...transform, scale: next };
}
</script>

<div class="xc-viewer" data-testid="xc-viewer">
	<div class="xc-stage">
	<svg
		class="xc-canvas"
		class:dragging
		viewBox="0 0 {WIDTH} {HEIGHT}"
		role="img"
		aria-label="XC viewer sectional for {bundle.label}"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onwheel={onWheel}
	>
		<rect class="canvas-bg" x="0" y="0" width={WIDTH} height={HEIGHT} />
		<g class="xc-content" transform={contentTransform}>
			{#if shows(SPATIAL_LAYER_KEYS.BASEMAP)}
				<SectionalCanvas geography={bundle.geography} {projection} />
			{/if}
			{#if shows(SPATIAL_LAYER_KEYS.AIRSPACE)}
				<AirspaceLayer airspace={bundle.geography.airspace} {projection} />
			{/if}
			{#if shows(SPATIAL_LAYER_KEYS.WEATHER)}
				<g class="airmet-layer" data-testid="airmet-layer">
					{#each bundle.weather.airmets as airmet (airmet.id)}
						<AirmetPolygon {airmet} {projection} />
					{/each}
				</g>
			{/if}
			{#if shows(SPATIAL_LAYER_KEYS.NAVAIDS)}
				<NavaidLayer navaids={bundle.geography.navaids} {projection} />
			{/if}
			{#if shows(SPATIAL_LAYER_KEYS.AIRPORTS)}
				<AirportLayer airports={bundle.geography.airports} {projection} />
			{/if}
			{#if shows(SPATIAL_LAYER_KEYS.ROUTE)}
				<RouteOverlay route={bundle.flight.route} {projection} onwaypointclick={openWaypoint} />
				<g class="leg-labels" data-testid="leg-labels">
					{#each legRenders as render (`${render.leg.from}-${render.leg.to}`)}
						<LegLabel leg={render.leg} midpoint={render.midpoint} onlegclick={openLeg} />
					{/each}
				</g>
			{/if}
			{#if shows(SPATIAL_LAYER_KEYS.WEATHER)}
				<g class="wx-chip-layer" data-testid="wx-chip-layer">
					{#each bundle.flight.route.waypoints as wp (wp.id)}
						{@const wxView = bundle.weather.byWaypoint[wp.id]}
						{#if wxView}
							<WaypointWxChip waypoint={wp} {wxView} {projection} onchipclick={({ waypoint }) => openWaypoint(waypoint)} />
						{/if}
					{/each}
				</g>
			{/if}
		</g>
	</svg>

	<div class="xc-chrome xc-chrome-top-right">
		<ZoomPanControls {transform} ontransform={(t) => (transform = t)} />
	</div>
	<div class="xc-chrome xc-chrome-top-left">
		<LayerToggle visible={visibleLayers} layers={exposedLayers} onchange={(v) => (visibleLayers = v)} />
	</div>

	<WaypointDetailDrawer
		open={drawerOpen}
		waypoint={drawerWaypoint}
		wxView={drawerWxView}
		airport={drawerAirport}
		airmets={bundle.weather.airmets}
		onclose={closeDrawer}
	/>

	<LegDetailDrawer
		open={legDrawerOpen}
		leg={drawerLeg}
		performance={bundle.performance}
		onclose={closeLegDrawer}
	/>
	</div>

	{#if hasPerformance}
		<PerformanceBand performance={bundle.performance} aircraft={bundle.flight.aircraft} />
	{/if}
</div>

<style>
	.xc-viewer {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-spatial-panel-border);
		overflow: hidden;
	}

	.xc-stage {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 10;
		overflow: hidden;
	}

	.xc-canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
	}

	.xc-canvas.dragging {
		cursor: grabbing;
	}

	.canvas-bg {
		fill: var(--color-spatial-canvas-bg);
	}

	.xc-chrome {
		position: absolute;
		z-index: 2;
	}

	.xc-chrome-top-right {
		top: var(--space-sm);
		right: var(--space-sm);
	}

	.xc-chrome-top-left {
		top: var(--space-sm);
		left: var(--space-sm);
	}
</style>
