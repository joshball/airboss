<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Theme-aware card container. Header / body / footer via snippets; omit any
 * to skip its slot. Padding + radius + shadow come from tokens so `web`
 * gets rounded + subtle shadow, `tui` gets sharp + flat.
 *
 * `variant='muted'` drops the raised surface and dashes the border -- used
 * by dashboard panels when they're gated / placeholder.
 */

type Variant = 'raised' | 'muted';

let {
	variant = 'raised',
	ariaLabelledby,
	header,
	children,
	footer,
}: {
	variant?: Variant;
	ariaLabelledby?: string;
	header?: Snippet;
	children: Snippet;
	footer?: Snippet;
} = $props();
</script>

<article
	class="card v-{variant}"
	aria-labelledby={ariaLabelledby}
	data-testid="card-root"
	data-variant={variant}
>
	{#if header}
		<header class="hd" data-testid="card-header">{@render header()}</header>
	{/if}
	<div class="body" data-testid="card-body">{@render children()}</div>
	{#if footer}
		<footer class="ft" data-testid="card-footer">{@render footer()}</footer>
	{/if}
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--layout-panel-gap);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--layout-panel-padding);
		box-shadow: var(--shadow-sm);
		min-width: 0;
	}

	.card.v-muted {
		background: var(--surface-sunken);
		border-style: dashed;
		border-color: var(--edge-strong);
		color: var(--ink-subtle);
		box-shadow: var(--shadow-none);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		min-width: 0;
	}

	.ft {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
	}
</style>
