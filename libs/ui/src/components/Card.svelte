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
>
	{#if header}
		<header class="hd">{@render header()}</header>
	{/if}
	<div class="body">{@render children()}</div>
	{#if footer}
		<footer class="ft">{@render footer()}</footer>
	{/if}
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--ab-layout-panel-gap);
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-layout-panel-padding);
		box-shadow: var(--ab-shadow-sm);
		min-width: 0;
	}

	.card.v-muted {
		background: var(--ab-color-surface-sunken);
		border-style: dashed;
		border-color: var(--ab-color-border-strong);
		color: var(--ab-color-fg-subtle);
		box-shadow: var(--ab-shadow-none);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-sm);
		min-width: 0;
	}

	.ft {
		display: flex;
		justify-content: flex-end;
		gap: var(--ab-space-sm);
	}
</style>
