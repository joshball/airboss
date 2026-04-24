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
interface Props {
	state: FlowState;
	actions?: Snippet;
}

const { state, actions }: Props = $props();

function timeAgo(iso: string | null): string {
	if (!iso) return 'never';
	try {
		return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	} catch {
		return iso;
	}
}
</script>

<section class="diagram" aria-label="Reference-system flow">
	<!-- Row 1: Content -->
	<div class="row row-content">
		<article class="tile" aria-labelledby="content-h">
			<h2 id="content-h" class="tile-title">Content</h2>
			<dl class="tile-body">
				<div class="metric">
					<dt>Wiki-links</dt>
					<dd>{state.content.wikiLinkCount}</dd>
				</div>
				<div class="metric">
					<dt>Help pages</dt>
					<dd>{state.content.helpPageCount}</dd>
				</div>
				<div class="metric" class:warn={state.content.tbdCount > 0}>
					<dt>TBD ids</dt>
					<dd>{state.content.tbdCount}</dd>
				</div>
			</dl>
		</article>
	</div>

	<div class="arrow" aria-hidden="true"><span>v</span></div>

	<!-- Row 2: Manifest + Validation -->
	<div class="row row-two">
		<article class="tile" aria-labelledby="manifest-h" class:busy={state.manifest.scanJobId !== null}>
			<h2 id="manifest-h" class="tile-title">Manifest</h2>
			<dl class="tile-body">
				<div class="metric">
					<dt>Cited ids</dt>
					<dd>{state.manifest.citedCount}</dd>
				</div>
				<div class="metric">
					<dt>Scanned</dt>
					<dd class="ts">{timeAgo(state.manifest.scannedAt)}</dd>
				</div>
			</dl>
		</article>
		<article class="tile" aria-labelledby="validation-h">
			<h2 id="validation-h" class="tile-title">Validation</h2>
			<dl class="tile-body">
				<div class="metric" class:error={state.validation.errors > 0}>
					<dt>Errors</dt>
					<dd>{state.validation.errors}</dd>
				</div>
				<div class="metric" class:warn={state.validation.warnings > 0}>
					<dt>Warnings</dt>
					<dd>{state.validation.warnings}</dd>
				</div>
				<div class="metric">
					<dt>Last run</dt>
					<dd class="ts">{timeAgo(state.validation.runAt)}</dd>
				</div>
			</dl>
		</article>
	</div>

	<div class="arrow" aria-hidden="true"><span>v</span></div>

	<!-- Row 3: Registry merge + Glossary -->
	<div class="row row-two">
		<article class="tile" aria-labelledby="registry-h">
			<h2 id="registry-h" class="tile-title">Registry merge</h2>
			<dl class="tile-body">
				<div class="metric">
					<dt>References</dt>
					<dd>{state.glossary.referenceCount}</dd>
				</div>
				<div class="metric">
					<dt>Sources</dt>
					<dd>{state.glossary.sourceCount}</dd>
				</div>
			</dl>
		</article>
		<article class="tile" aria-labelledby="glossary-h">
			<h2 id="glossary-h" class="tile-title">Glossary render</h2>
			<p class="muted">Edit in <a href="/glossary">/glossary</a></p>
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

	.arrow {
		text-align: center;
		color: var(--edge-strong);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-control-size);
		letter-spacing: var(--letter-spacing-wide);
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
