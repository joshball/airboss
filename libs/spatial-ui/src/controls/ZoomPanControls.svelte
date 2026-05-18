<script lang="ts">
/**
 * ZoomPanControls -- pan / zoom UI for the sectional canvas.
 *
 * Buttons: zoom in, zoom out, reset, fit-to-route. Holds the current
 * transform (`scale` + `translate`) in `$state` and reports changes via
 * the `ontransform` callback. The XcViewer applies the transform to the
 * SVG content group.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.4.
 */

import type { CanvasTransform } from './types';

interface Props {
	/** The current transform (controlled). */
	transform: CanvasTransform;
	/** Called when the user changes the transform. */
	ontransform: (next: CanvasTransform) => void;
	/** Called when the user clicks "fit to route". */
	onfitroute?: () => void;
}

let { transform, ontransform, onfitroute }: Props = $props();

/** Zoom step multiplier per button press. */
const ZOOM_STEP = 1.3;
const MIN_SCALE = 0.5;
const MAX_SCALE = 8;

function zoomIn() {
	ontransform({ ...transform, scale: Math.min(MAX_SCALE, transform.scale * ZOOM_STEP) });
}

function zoomOut() {
	ontransform({ ...transform, scale: Math.max(MIN_SCALE, transform.scale / ZOOM_STEP) });
}

function reset() {
	ontransform({ scale: 1, x: 0, y: 0 });
}
</script>

<div class="zoom-pan-controls" data-testid="zoom-pan-controls">
	<button type="button" class="ctl" onclick={zoomIn} aria-label="Zoom in">+</button>
	<button type="button" class="ctl" onclick={zoomOut} aria-label="Zoom out">&minus;</button>
	<button type="button" class="ctl" onclick={reset} aria-label="Reset view">&#8634;</button>
	{#if onfitroute}
		<button type="button" class="ctl ctl-wide" onclick={onfitroute} aria-label="Fit to route">Fit</button>
	{/if}
</div>

<style>
	.zoom-pan-controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.ctl {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-spatial-panel-border);
		border-radius: var(--radius-sm);
		background: var(--color-spatial-panel-bg);
		color: var(--color-spatial-panel-ink);
		font-size: var(--font-size-base);
		cursor: pointer;
	}

	.ctl-wide {
		width: 2rem;
		font-size: var(--font-size-xs);
	}

	.ctl:hover {
		border-color: var(--action-default);
	}
</style>
