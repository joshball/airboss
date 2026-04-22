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
 */

type Variant = 'tip' | 'warn' | 'danger' | 'howto';

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
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-left-width: 4px;
		border-radius: var(--ab-radius-md, 6px);
		padding: 0.75rem 1rem;
		margin: 1rem 0;
		background: var(--ab-color-surface, #ffffff);
	}

	.card.tip {
		border-left-color: var(--ab-color-primary, #3b82f6);
	}

	.card.howto {
		border-left-color: var(--ab-color-success, #10b981);
	}

	.card.warn {
		border-left-color: var(--ab-color-warning, #f59e0b);
		background: var(--ab-color-warning-subtle, #fef3c7);
	}

	.card.danger {
		border-left-color: var(--ab-color-danger, #ef4444);
		background: var(--ab-color-danger-subtle, #fee2e2);
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
