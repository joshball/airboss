<!--
CourseStepChart -- placeholder for the future weather-chart embedding.

This WP ships the component as a placeholder per OUT-OF-SCOPE.md "Real WX
chart embedding in step reader." The follow-on WP wires the wx-charts
library output into the body without changing the call site.

In dev the slug is visible inside the bordered container so an author can
see which chart a step is asking for. In prod the wrapper renders empty.
-->
<script lang="ts">
import { dev } from '$app/environment';

interface Props {
	slug: string;
}

let { slug }: Props = $props();
</script>

<figure class="chart-stub" aria-label="Chart placeholder">
	{#if dev}
		<figcaption class="caption">
			Chart slot (placeholder): <code>{slug}</code>
		</figcaption>
	{/if}
</figure>

<style>
	.chart-stub {
		margin: var(--space-md) 0;
		padding: var(--space-xl);
		background: var(--surface-muted);
		border: 2px dashed var(--edge-strong);
		border-radius: var(--radius-md);
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 120px;
	}

	.caption {
		text-align: center;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.caption :global(code) {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		background: var(--ink-inverse);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
		color: var(--ink-body);
	}
</style>
