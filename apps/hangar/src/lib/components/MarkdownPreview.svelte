<script lang="ts">
import { renderMarkdown } from '@ab/utils';

/**
 * Client-safe live markdown preview. Uses the shared `renderMarkdown`
 * from `@ab/utils` so the preview renders the same subset the knowledge
 * graph and hangar surfaces render at runtime. Safe to pipe through
 * {@html} because renderMarkdown escapes HTML itself.
 */

let { source = '' }: { source?: string } = $props();

const html = $derived(renderMarkdown(source));
</script>

{#if source.trim().length === 0}
	<p class="empty">Preview renders as you type.</p>
{:else}
	<div class="body">{@html html}</div>
{/if}

<style>
	.empty {
		color: var(--ink-faint);
		font-style: italic;
		margin: 0;
	}

	.body {
		color: var(--ink-body);
		font-size: var(--type-reading-body-size);
		line-height: var(--line-height-normal);
	}

	.body :global(p) {
		margin: 0 0 var(--space-sm);
	}

	.body :global(h3),
	.body :global(h4),
	.body :global(h5),
	.body :global(h6) {
		margin: var(--space-md) 0 var(--space-xs);
		color: var(--ink-strong);
	}

	.body :global(ul),
	.body :global(ol) {
		margin: 0 0 var(--space-sm);
		padding-left: var(--space-xl);
		color: var(--ink-body);
	}

	.body :global(code) {
		font-family: var(--font-family-mono);
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		color: var(--accent-code);
	}

	.body :global(pre) {
		background: var(--surface-sunken);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		overflow-x: auto;
	}

	.body :global(pre code) {
		background: transparent;
		padding: 0;
	}

	.body :global(a) {
		color: var(--link-default);
	}

	.body :global(a:hover) {
		color: var(--link-hover);
	}
</style>
