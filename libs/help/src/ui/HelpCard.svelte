<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Pull-out card primitive for how-to snippets, tips, or warnings inside a
 * section body. Authors invoke it as a Svelte snippet (passed via the
 * `children` prop) for inline use, or the `HelpPage` render pipeline can
 * compose it when a section carries structured tip/warn metadata.
 *
 * Variants map to visual intent:
 *   - 'tip'     -- neutral, informational
 *   - 'warn'    -- caution (yellow accent)
 *   - 'danger'  -- safety-critical (red accent)
 *   - 'howto'   -- a stepwise recipe
 *   - 'note'    -- neutral aside with low-emphasis border
 *   - 'example' -- worked example with subtle accent tint
 */

type Variant = 'tip' | 'warn' | 'danger' | 'howto' | 'note' | 'example';

let {
	title,
	variant = 'tip',
	children,
}: {
	title?: string;
	variant?: Variant;
	children: Snippet;
} = $props();
</script>

<aside class="card {variant}" role="note">
	{#if title}
		<header>{title}</header>
	{/if}
	<div class="body">{@render children()}</div>
</aside>

<style>
	.card {
		border: 1px solid var(--edge-default);
		border-left-width: 4px;
		border-radius: var(--radius-md);
		padding: 0.75rem 1rem;
		margin: 1rem 0;
		background: var(--surface-panel);
	}

	.card.tip {
		border-left-color: var(--action-default);
	}

	.card.howto {
		border-left-color: var(--signal-success);
	}

	.card.warn {
		border-left-color: var(--action-caution);
		background: var(--action-caution-wash);
	}

	.card.danger {
		border-left-color: var(--action-hazard);
		background: var(--action-hazard-wash);
	}

	.card.note {
		border-left-color: var(--edge-default);
		background: var(--surface-sunken);
	}

	.card.example {
		border-left-color: var(--action-default);
		background: var(--surface-raised);
	}

	header {
		font-weight: var(--font-weight-semibold);
		margin-bottom: 0.375rem;
		font-size: 0.9375rem;
	}

	.body {
		font-size: 0.9375rem;
		line-height: 1.55;
	}
</style>
