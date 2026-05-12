<!--
CourseStepChart -- embeds a wx-charts SVG inside a course step body.

Loads the chart bytes via the study app's `/api/charts/<slug>/chart.svg`
endpoint (`apps/study/src/routes/api/charts/[...slug]/+server.ts`), which
reads from `data/charts/wx/<slug>/...` on disk. The slug shape mirrors the
two chart families:

  - `wx-scenarios/<scenario-id>/<chart-kind>` (engine output)
  - `reference-fixtures/wx-<chart-kind>-<date-zulu>` (canonical reference set)

In dev (`import.meta.env.DEV`) the slug stays visible beneath the chart so
an author can see which chart a step is asking for. In prod the caption is
hidden and only the chart itself renders.
-->
<script lang="ts">
interface Props {
	slug: string;
}

let { slug }: Props = $props();

// Vite's `import.meta.env.DEV` is true in dev + test; false in prod.
// Avoids `$app/environment` so the component is testable in isolation
// (Svelte's `$app/*` aliases require SvelteKit's vite plugin loaded).
const isDev = import.meta.env.DEV ?? false;

// The slug is path-shaped (`wx-scenarios/<id>/<kind>`). The server route's
// `[...slug]` catch-all consumes the slashes transparently; no encoding
// needed at this layer.
const chartUrl = $derived(`/api/charts/${slug}/chart.svg`);
</script>

<figure class="chart" aria-label={`Chart: ${slug}`}>
	<img class="chart-image" src={chartUrl} alt={`Chart ${slug}`} loading="lazy" />
	{#if isDev}
		<figcaption class="caption">
			<code>{slug}</code>
		</figcaption>
	{/if}
</figure>

<style>
	.chart {
		margin: var(--space-md) 0;
	}

	.chart-image {
		width: 100%;
		height: auto;
		display: block;
		border-radius: var(--radius-md);
	}

	.caption {
		text-align: center;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		margin-top: var(--space-xs);
	}

	.caption :global(code) {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		background: var(--surface-muted);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
		color: var(--ink-body);
	}
</style>
