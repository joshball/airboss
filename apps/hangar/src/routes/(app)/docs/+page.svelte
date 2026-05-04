<script lang="ts">
import { renderMarkdown, stripFrontmatter } from '@ab/utils';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const bodyHtml = $derived(data.now ? renderMarkdown(stripFrontmatter(data.now)) : null);
</script>

<section class="docs-index">
	<header class="hd">
		<h1>Docs</h1>
		<p class="muted">
			{data.indexCount.toLocaleString()} files indexed.
			{#if data.indexCount === 0}
				<strong>Index is empty.</strong> Click below to populate the FTS index from
				<code>docs/</code>, <code>course/</code>, <code>handbooks/</code>, and <code>regulations/</code>.
			{/if}
		</p>
	</header>

	{#if data.indexCount === 0}
		<form method="POST" action="?/runLoader" class="loader-prompt">
			<button type="submit">Run loader</button>
		</form>
	{/if}

	{#if form?.ranLoader}
		<p class="muted">
			Loader ran in {form.durationMs} ms. FTS:
			<strong>{form.fts.added.toLocaleString()}</strong> added,
			<strong>{form.fts.updated.toLocaleString()}</strong> updated,
			<strong>{form.fts.removed.toLocaleString()}</strong> removed.
		</p>
	{/if}

	{#if bodyHtml}
		<article class="prose">
			{@html bodyHtml}
		</article>
	{:else}
		<p class="muted">
			<code>{data.nowPath}</code> not found. The index page renders the contents of <code>docs/work/NOW.md</code> when
			present.
		</p>
	{/if}
</section>

<style>
	.docs-index {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.hd h1 {
		margin: 0;
	}

	.muted {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.loader-prompt button {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		font: inherit;
		font-weight: var(--type-ui-control-weight);
		cursor: pointer;
	}

	.loader-prompt button:hover {
		background: var(--surface-sunken);
	}

	.loader-prompt button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3),
	.prose :global(h4) {
		color: var(--ink-body);
	}

	.prose :global(p) {
		color: var(--ink-body);
	}

	.prose :global(code) {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		background: var(--surface-sunken);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
	}

	.prose :global(a) {
		color: var(--link-default);
	}

	.prose :global(a:hover) {
		color: var(--link-hover);
	}
</style>
