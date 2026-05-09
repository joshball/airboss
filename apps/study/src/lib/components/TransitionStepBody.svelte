<script lang="ts">
import { renderMarkdown } from '@ab/utils';

interface Props {
	/** The transition node's contentMd (rendered as connective prose, not phase-scaffolded). */
	contentMd: string;
}

let { contentMd }: Props = $props();
</script>

<section class="bridge" aria-label="Transition step">
	<span class="bridge-tag">Transition</span>
	{#if contentMd}
		<div class="prose">{@html renderMarkdown(contentMd)}</div>
	{:else}
		<p class="empty">This transition has no body authored yet.</p>
	{/if}
</section>

<style>
	.bridge {
		position: relative;
		padding: var(--space-md) var(--space-lg);
		border-left: 4px solid var(--action-default-edge);
		background: var(--surface-muted);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.bridge-tag {
		display: inline-flex;
		align-self: flex-start;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-pill);
	}

	.empty {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}

	.prose :global(p) {
		margin: 0 0 var(--space-md);
		line-height: 1.55;
		color: var(--ink-body);
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 var(--space-md) var(--space-xl);
		line-height: 1.55;
	}
</style>
