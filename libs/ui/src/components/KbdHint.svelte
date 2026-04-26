<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Small kbd-style marker for keyboard shortcut hints. Use alongside action
 * labels ("Reveal <KbdHint>Space</KbdHint>") so users learn the shortcut.
 *
 * Renders a single `<kbd>` with children as the key label. For multi-key
 * combos, compose ("Cmd" + "+" + "Enter") as separate tags.
 */

let {
	children,
	ariaLabel,
}: {
	children: Snippet;
	ariaLabel?: string;
} = $props();
</script>

<kbd class="kbd" aria-label={ariaLabel} data-testid="kbdhint-root">
	{@render children()}
</kbd>

<style>
	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-strong);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
		padding: 0 var(--space-2xs);
		min-width: var(--badge-height-md);
		min-height: var(--badge-height-md);
		line-height: 1;
	}
</style>
