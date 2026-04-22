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

<kbd class="kbd" aria-label={ariaLabel}>
	{@render children()}
</kbd>

<style>
	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ab-font-family-mono);
		font-size: var(--ab-font-size-xs);
		font-weight: var(--ab-font-weight-medium);
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface-sunken);
		border: 1px solid var(--ab-color-border-strong);
		border-bottom-width: 2px;
		border-radius: var(--ab-radius-sm);
		padding: 0 var(--ab-space-2xs);
		min-width: 1.25rem;
		min-height: 1.1rem;
		line-height: 1;
	}
</style>
