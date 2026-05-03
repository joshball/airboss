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

const VARIANT_LABELS: Record<Variant, string> = {
	tip: 'Tip',
	warn: 'Warning',
	danger: 'Danger',
	howto: 'How-to',
	note: 'Note',
	example: 'Example',
};

let {
	title,
	variant = 'tip',
	children,
}: {
	title?: string;
	variant?: Variant;
	children: Snippet;
} = $props();

const variantLabel = $derived(VARIANT_LABELS[variant]);
</script>

<!--
	The visible eyebrow + the aria-label make the card variant accessible
	to colorblind sighted users (who couldn't distinguish warn from danger
	by border colour alone) and to screen-reader users (who previously got
	only `role="note"` with no variant cue).
-->
<aside class="card {variant}" role="note" aria-label={variantLabel} data-testid="helpcard-root" data-variant={variant}>
	<span class="eyebrow" data-testid="helpcard-eyebrow">{variantLabel}</span>
	{#if title}
		<header data-testid="helpcard-title">{title}</header>
	{/if}
	<div class="body" data-testid="helpcard-body">{@render children()}</div>
</aside>

<style>
	.card {
		border: 1px solid var(--edge-default);
		border-left-width: 4px;
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
		margin: var(--space-lg) 0;
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

	.eyebrow {
		display: block;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		margin-bottom: var(--space-2xs);
	}

	header {
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-xs);
		font-size: var(--font-size-base);
	}

	.body {
		font-size: var(--font-size-base);
		line-height: 1.55;
	}
</style>
