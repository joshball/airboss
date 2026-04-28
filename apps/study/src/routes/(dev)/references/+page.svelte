<script lang="ts">
/**
 * Dev demo for the ADR 019 Phase 4 renderer.
 *
 * Shows three fixture lessons rendered through the renderer in the requested
 * mode, plus a mode toggle UI. Reach manually via /references; not wired into
 * navigation. The `(dev)/` route group convention matches the primitives demo.
 */

import RenderedLesson from '$lib/components/RenderedLesson.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>References renderer demo -- airboss</title>
</svelte:head>

<header class="page-header">
	<h1>ADR 019 references renderer</h1>
	<p class="lede">
		Three fixture lessons rendered via <code>@ab/sources/render</code> in the selected mode.
	</p>
	<nav class="mode-nav" aria-label="Render mode">
		{#each data.modes as mode (mode)}
			<a
				href={`?mode=${mode}`}
				class:active={mode === data.mode}
				aria-current={mode === data.mode ? 'page' : undefined}
			>
				{mode}
			</a>
		{/each}
	</nav>
</header>

{#each data.fixtures as fixture (fixture.slug)}
	<section class="fixture">
		<h2>{fixture.title}</h2>
		<p class="meta"><code>{fixture.slug}.md</code> -- mode: <strong>{fixture.mode}</strong></p>
		<div class="rendered">
			<RenderedLesson body={fixture.body} resolved={fixture.resolved} mode={fixture.mode} />
		</div>
	</section>
{/each}

<style>
	.page-header {
		margin-bottom: var(--space-lg);
	}
	.page-header h1 {
		margin-bottom: var(--space-xs);
	}
	.lede {
		color: var(--ink-muted);
		margin-bottom: var(--space-md);
	}
	.mode-nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}
	.mode-nav a {
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--surface-muted);
		color: var(--ink-body);
		text-decoration: none;
		font-size: var(--font-size-sm);
	}
	.mode-nav a.active {
		background: var(--action-link);
		color: var(--action-link-ink);
	}
	.fixture {
		margin-bottom: var(--space-xl);
		padding: var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}
	.fixture h2 {
		margin-bottom: var(--space-xs);
	}
	.meta {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		margin-bottom: var(--space-sm);
	}
	.rendered {
		padding: var(--space-md);
		background: var(--surface-page);
		border-radius: var(--radius-sm);
		white-space: pre-wrap;
	}
	.rendered :global(.ab-ref) {
		color: var(--action-link);
	}
	.rendered :global(.ab-ref-annotation) {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		font-style: italic;
		margin-left: var(--space-xs);
	}
	.rendered :global(.ab-ref-footnotes) {
		margin-top: var(--space-md);
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
</style>
