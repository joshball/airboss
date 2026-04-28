<script lang="ts" module>
/**
 * Interactive reference-system flow diagram. Visualises the pipeline
 *
 *   Content -> Manifest -> Validation
 *                                 |
 *                                 v
 *                          Source registry -> Registry merge -> Glossary render
 *
 * Each node is a tile with live counts; arrows connect them. When a connected
 * operation is running (see `activeJobId`), the arrow animates.
 *
 * All colors + spacing via role tokens. Tile state styling uses `signal-*`
 * tokens so appearance swaps preserve semantics.
 */

import type { Snippet } from 'svelte';

export interface FlowState {
	content: {
		wikiLinkCount: number;
		tbdCount: number;
		helpPageCount: number;
	};
	manifest: {
		citedCount: number;
		scannedAt: string | null;
		scanJobId: string | null;
	};
	validation: {
		errors: number;
		warnings: number;
		runAt: string | null;
		validateJobId: string | null;
	};
	glossary: {
		referenceCount: number;
		sourceCount: number;
	};
}
</script>

<script lang="ts">
import { ROUTES } from '@ab/constants';

interface Props {
	state: FlowState;
	actions?: Snippet;
}

const { state: flowState, actions }: Props = $props();

function timeAgo(iso: string | null): string {
	if (!iso) return 'never';
	try {
		return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	} catch {
		return iso;
	}
}

/**
 * SVG arrow geometry. Each path connects two tile centres; we measure the
 * tiles after mount and on resize so the arrows track responsive layouts.
 *
 * The row layout flips to a single column under 700px, so the manifest and
 * validation columns slide. Computing geometry from the live DOM keeps the
 * arrows correct in every layout without duplicating the pipeline shape in
 * static CSS.
 */
interface ArrowGeometry {
	id: string;
	d: string;
	/** True when an adjacent tile has a running connected job. */
	busy: boolean;
}

let containerEl = $state<HTMLElement | null>(null);
let contentTileEl = $state<HTMLElement | null>(null);
let manifestTileEl = $state<HTMLElement | null>(null);
let validationTileEl = $state<HTMLElement | null>(null);
let registryTileEl = $state<HTMLElement | null>(null);
let glossaryTileEl = $state<HTMLElement | null>(null);
let viewBox = $state('0 0 0 0');
let arrows = $state<readonly ArrowGeometry[]>([]);

const manifestBusy = $derived(flowState.manifest.scanJobId !== null);
const validationBusy = $derived(flowState.validation.validateJobId !== null);

function recomputeArrows(): void {
	const container = containerEl;
	const content = contentTileEl;
	const manifest = manifestTileEl;
	const validation = validationTileEl;
	const registry = registryTileEl;
	const glossary = glossaryTileEl;
	if (!container || !content || !manifest || !validation || !registry || !glossary) {
		arrows = [];
		viewBox = '0 0 0 0';
		return;
	}
	const cb = container.getBoundingClientRect();
	function localCentre(el: HTMLElement): { x: number; top: number; bottom: number } {
		const r = el.getBoundingClientRect();
		return {
			x: r.left - cb.left + r.width / 2,
			top: r.top - cb.top,
			bottom: r.bottom - cb.top,
		};
	}
	const c = localCentre(content);
	const m = localCentre(manifest);
	const v = localCentre(validation);
	const r = localCentre(registry);
	const g = localCentre(glossary);
	function curve(from: { x: number; y: number }, to: { x: number; y: number }): string {
		const midY = (from.y + to.y) / 2;
		return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${from.x.toFixed(1)} ${midY.toFixed(1)}, ${to.x.toFixed(1)} ${midY.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
	}
	const cBottom = { x: c.x, y: c.bottom };
	const mTop = { x: m.x, y: m.top };
	const vTop = { x: v.x, y: v.top };
	const mBottom = { x: m.x, y: m.bottom };
	const vBottom = { x: v.x, y: v.bottom };
	const rTop = { x: r.x, y: r.top };
	const rBottom = { x: r.x, y: r.bottom };
	const gTop = { x: g.x, y: g.top };

	arrows = [
		{ id: 'content-manifest', d: curve(cBottom, mTop), busy: manifestBusy },
		{ id: 'content-validation', d: curve(cBottom, vTop), busy: validationBusy },
		{ id: 'manifest-registry', d: curve(mBottom, rTop), busy: manifestBusy },
		{ id: 'validation-registry', d: curve(vBottom, rTop), busy: validationBusy },
		{ id: 'registry-glossary', d: curve(rBottom, gTop), busy: false },
	];
	viewBox = `0 0 ${cb.width} ${cb.height}`;
}

$effect(() => {
	if (typeof window === 'undefined') return;
	const container = containerEl;
	if (!container) return;
	// Re-run when busy state flips so arrows redraw with the active class.
	void manifestBusy;
	void validationBusy;
	recomputeArrows();
	const ro = new ResizeObserver(() => recomputeArrows());
	ro.observe(container);
	for (const el of [contentTileEl, manifestTileEl, validationTileEl, registryTileEl, glossaryTileEl]) {
		if (el) ro.observe(el);
	}
	const onResize = (): void => recomputeArrows();
	window.addEventListener('resize', onResize);
	return () => {
		ro.disconnect();
		window.removeEventListener('resize', onResize);
	};
});
</script>

<section class="diagram" aria-label="Reference-system flow" bind:this={containerEl}>
	<svg class="arrows" viewBox={viewBox} aria-hidden="true" preserveAspectRatio="none">
		<defs>
			<marker
				id="flow-arrowhead"
				viewBox="0 0 10 10"
				refX="9"
				refY="5"
				markerWidth="6"
				markerHeight="6"
				orient="auto-start-reverse"
			>
				<path d="M 0 0 L 10 5 L 0 10 z" />
			</marker>
		</defs>
		{#each arrows as arrow (arrow.id)}
			<path class="arrow-path" class:busy={arrow.busy} d={arrow.d} marker-end="url(#flow-arrowhead)" />
		{/each}
	</svg>

	<!-- Row 1: Content -->
	<div class="row row-content">
		<article class="tile" aria-labelledby="content-h" bind:this={contentTileEl}>
			<h2 id="content-h" class="tile-title">Content</h2>
			<dl class="tile-body">
				<div class="metric">
					<dt>Wiki-links</dt>
					<dd>{flowState.content.wikiLinkCount}</dd>
				</div>
				<div class="metric">
					<dt>Help pages</dt>
					<dd>{flowState.content.helpPageCount}</dd>
				</div>
				<div class="metric" class:warn={flowState.content.tbdCount > 0}>
					<dt>TBD ids</dt>
					<dd>{flowState.content.tbdCount}</dd>
				</div>
			</dl>
		</article>
	</div>

	<!-- Row 2: Manifest + Validation -->
	<div class="row row-two">
		<article
			class="tile"
			aria-labelledby="manifest-h"
			class:busy={manifestBusy}
			bind:this={manifestTileEl}
		>
			<h2 id="manifest-h" class="tile-title">Manifest</h2>
			<dl class="tile-body">
				<div class="metric">
					<dt>Cited ids</dt>
					<dd>{flowState.manifest.citedCount}</dd>
				</div>
				<div class="metric">
					<dt>Scanned</dt>
					<dd class="ts">{timeAgo(flowState.manifest.scannedAt)}</dd>
				</div>
			</dl>
		</article>
		<article
			class="tile"
			aria-labelledby="validation-h"
			class:busy={validationBusy}
			bind:this={validationTileEl}
		>
			<h2 id="validation-h" class="tile-title">Validation</h2>
			<dl class="tile-body">
				<div class="metric" class:error={flowState.validation.errors > 0}>
					<dt>Errors</dt>
					<dd>{flowState.validation.errors}</dd>
				</div>
				<div class="metric" class:warn={flowState.validation.warnings > 0}>
					<dt>Warnings</dt>
					<dd>{flowState.validation.warnings}</dd>
				</div>
				<div class="metric">
					<dt>Last run</dt>
					<dd class="ts">{timeAgo(flowState.validation.runAt)}</dd>
				</div>
			</dl>
		</article>
	</div>

	<!-- Row 3: Registry merge + Glossary -->
	<div class="row row-two">
		<article class="tile" aria-labelledby="registry-h" bind:this={registryTileEl}>
			<h2 id="registry-h" class="tile-title">Registry merge</h2>
			<dl class="tile-body">
				<div class="metric">
					<dt>References</dt>
					<dd>{flowState.glossary.referenceCount}</dd>
				</div>
				<div class="metric">
					<dt>Sources</dt>
					<dd>{flowState.glossary.sourceCount}</dd>
				</div>
			</dl>
		</article>
		<article class="tile" aria-labelledby="glossary-h" bind:this={glossaryTileEl}>
			<h2 id="glossary-h" class="tile-title">Glossary render</h2>
			<p class="muted">Edit in <a href={ROUTES.HANGAR_GLOSSARY}>/glossary</a></p>
		</article>
	</div>

	{#if actions}
		<div class="actions-row">
			{@render actions()}
		</div>
	{/if}
</section>

<style>
	.diagram {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-md);
	}

	.row {
		display: grid;
		gap: var(--space-lg);
	}

	.row-content {
		grid-template-columns: minmax(18rem, 28rem);
		justify-content: center;
	}

	.row-two {
		grid-template-columns: repeat(2, minmax(14rem, 22rem));
		justify-content: center;
	}

	.tile {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
	}

	.tile.busy {
		border-color: var(--signal-info);
		box-shadow: var(--shadow-sm);
	}

	.tile-title {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-control-size);
		color: var(--ink-body);
	}

	.tile-body {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.metric {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
		font-size: var(--type-ui-label-size);
	}

	.metric dt {
		color: var(--ink-muted);
		letter-spacing: var(--letter-spacing-wide);
		text-transform: uppercase;
		font-size: var(--type-ui-caption-size);
	}

	.metric dd {
		margin: 0;
		font-family: var(--font-family-mono);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.metric.warn dd {
		color: var(--signal-warning);
	}

	.metric.error dd {
		color: var(--signal-danger);
	}

	.ts {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.muted {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.muted a {
		color: var(--link-default);
	}

	.actions-row {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		justify-content: center;
		padding-top: var(--space-sm);
	}

	@media (max-width: 700px) {
		.row-two {
			grid-template-columns: 1fr;
		}
	}
</style>
