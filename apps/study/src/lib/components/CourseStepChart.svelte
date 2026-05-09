<script lang="ts">
import { dev } from '$app/environment';

interface Props {
	/** Stable chart slug (e.g. `sfc-analysis-2026-05-09`). Visible in dev only. */
	slug: string;
}

let { slug }: Props = $props();
</script>

<aside class="chart-stub" aria-label="Chart placeholder">
	{#if dev}
		<p class="slug">Chart placeholder: <code>{slug}</code></p>
		<p class="hint">
			Real rendering ships in the wx-chart-symbology-library WP. This bordered container is a stand-in for the
			final chart surface.
		</p>
	{/if}
</aside>

<style>
	.chart-stub {
		min-height: 8rem;
		border: 2px dashed var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-muted);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		align-items: center;
		justify-content: center;
		color: var(--ink-muted);
	}

	.slug {
		margin: 0;
		font-size: var(--type-ui-label-size);
	}

	.slug code {
		background: var(--surface-sunken);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
		font-family: var(--font-family-mono);
	}

	.hint {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
		font-style: italic;
		max-width: 32rem;
		text-align: center;
	}
</style>
