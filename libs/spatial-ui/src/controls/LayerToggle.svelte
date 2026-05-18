<script lang="ts">
/**
 * LayerToggle -- per-layer show / hide controls.
 *
 * Renders a checkbox per renderable layer (basemap, airspace, navaids,
 * airports, route, weather). The set of visible layers is controlled by
 * the parent via `visible` + `onchange`.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.4.
 */

import { SPATIAL_LAYER_KEYS, SPATIAL_LAYER_LABELS, type SpatialLayerKey } from '../styles/tokens';

interface Props {
	/** The currently-visible layer keys. */
	visible: SpatialLayerKey[];
	/** Called with the next visible-set when the user toggles a layer. */
	onchange: (next: SpatialLayerKey[]) => void;
	/** Optional subset of layers to expose (default: all). */
	layers?: SpatialLayerKey[];
}

let { visible, onchange, layers }: Props = $props();

const allLayers = Object.values(SPATIAL_LAYER_KEYS);
const exposed = $derived(layers ?? allLayers);

function toggle(key: SpatialLayerKey) {
	const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key];
	onchange(next);
}
</script>

<fieldset class="layer-toggle" data-testid="layer-toggle">
	<legend>Layers</legend>
	{#each exposed as key (key)}
		<label class="layer-row">
			<input
				type="checkbox"
				checked={visible.includes(key)}
				onchange={() => toggle(key)}
				data-layer-key={key}
			/>
			<span>{SPATIAL_LAYER_LABELS[key]}</span>
		</label>
	{/each}
</fieldset>

<style>
	.layer-toggle {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		margin: 0;
		padding: var(--space-xs);
		border: 1px solid var(--color-spatial-panel-border);
		border-radius: var(--radius-sm);
		background: var(--color-spatial-panel-bg);
		color: var(--color-spatial-panel-ink);
	}

	legend {
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
		padding: 0 var(--space-3xs);
	}

	.layer-row {
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}
</style>
