<script lang="ts">
/**
 * XcViewer -- the top-level XC viewer composition.
 *
 * Renders a `ScenarioBundle` into an interactive SVG sectional. Phase B
 * ships the layer-1 sectional (basemap + airspace + airports + navaids)
 * plus the pan/zoom + layer-toggle chrome. Phases C/D/E add the route
 * overlay, the weather overlay, and the performance band.
 *
 * Pure browser-safe rendering -- the bundle is loaded server-side and
 * passed in as a prop.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.5.
 */

import '@ab/themes/spatial-tokens.css';
import type { ScenarioBundle } from '@ab/spatial-engine';
import { regionalLambertProjection, SECTIONAL_SVG_HEIGHT, SECTIONAL_SVG_WIDTH } from '@ab/spatial-engine';
import AirportLayer from './AirportLayer.svelte';
import AirspaceLayer from './AirspaceLayer.svelte';
import LayerToggle from './controls/LayerToggle.svelte';
import type { CanvasTransform } from './controls/types';
import ZoomPanControls from './controls/ZoomPanControls.svelte';
import NavaidLayer from './NavaidLayer.svelte';
import SectionalCanvas from './SectionalCanvas.svelte';
import { SPATIAL_LAYER_KEYS, type SpatialLayerKey } from './styles/tokens';

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

// Which layers are visible. Phase B exposes the layer-1 layers.
let visibleLayers = $state<SpatialLayerKey[]>([
	SPATIAL_LAYER_KEYS.BASEMAP,
	SPATIAL_LAYER_KEYS.AIRSPACE,
	SPATIAL_LAYER_KEYS.NAVAIDS,
	SPATIAL_LAYER_KEYS.AIRPORTS,
]);

const phaseBLayers: SpatialLayerKey[] = [
	SPATIAL_LAYER_KEYS.BASEMAP,
	SPATIAL_LAYER_KEYS.AIRSPACE,
	SPATIAL_LAYER_KEYS.NAVAIDS,
	SPATIAL_LAYER_KEYS.AIRPORTS,
];

function shows(layer: SpatialLayerKey): boolean {
	return visibleLayers.includes(layer);
}

const contentTransform = $derived(`translate(${transform.x} ${transform.y}) scale(${transform.scale})`);

// --- Drag-to-pan ---
let dragging = $state(false);
let dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

function onPointerDown(e: PointerEvent) {
	dragging = true;
	dragStart = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
	(e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
	if (!dragging) return;
	transform = {
		...transform,
		x: dragStart.tx + (e.clientX - dragStart.x),
		y: dragStart.ty + (e.clientY - dragStart.y),
	};
}

function onPointerUp(e: PointerEvent) {
	dragging = false;
	(e.currentTarget as SVGElement).releasePointerCapture?.(e.pointerId);
}

function onWheel(e: WheelEvent) {
	e.preventDefault();
	const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
	const next = Math.max(0.5, Math.min(8, transform.scale * factor));
	transform = { ...transform, scale: next };
}
</script>

<div class="xc-viewer" data-testid="xc-viewer">
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
			{#if shows(SPATIAL_LAYER_KEYS.NAVAIDS)}
				<NavaidLayer navaids={bundle.geography.navaids} {projection} />
			{/if}
			{#if shows(SPATIAL_LAYER_KEYS.AIRPORTS)}
				<AirportLayer airports={bundle.geography.airports} {projection} />
			{/if}
		</g>
	</svg>

	<div class="xc-chrome xc-chrome-top-right">
		<ZoomPanControls {transform} ontransform={(t) => (transform = t)} />
	</div>
	<div class="xc-chrome xc-chrome-top-left">
		<LayerToggle visible={visibleLayers} layers={phaseBLayers} onchange={(v) => (visibleLayers = v)} />
	</div>
</div>

<style>
	.xc-viewer {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-spatial-panel-border);
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
