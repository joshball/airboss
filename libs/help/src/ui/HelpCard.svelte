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
		border: 1px solid var(--ab-color-border);
		border-left-width: 4px;
		border-radius: var(--ab-radius-md, 6px);
		padding: 0.75rem 1rem;
		margin: 1rem 0;
		background: var(--ab-color-surface);
	}

	.card.tip {
		border-left-color: var(--ab-color-primary);
	}

	.card.howto {
		border-left-color: var(--ab-color-success);
	}

	.card.warn {
		border-left-color: var(--ab-color-warning);
		background: var(--ab-color-warning-subtle);
	}

	.card.danger {
		border-left-color: var(--ab-color-danger);
		background: var(--ab-color-danger-subtle);
	}

	.card.note {
		border-left-color: var(--ab-color-border);
		background: var(--ab-color-surface-sunken);
	}

	.card.example {
		border-left-color: var(--ab-color-primary);
		background: var(--ab-color-surface-raised);
	}

	header {
		font-weight: var(--ab-font-weight-semibold, 600);
		margin-bottom: 0.375rem;
		font-size: 0.9375rem;
	}

	.body {
		font-size: 0.9375rem;
		line-height: 1.55;
	}
</style>
