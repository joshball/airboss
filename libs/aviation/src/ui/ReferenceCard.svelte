<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { Reference } from '../schema/reference';

const MAX_PREVIEW = 200;

let { reference }: { reference: Reference } = $props();

function truncate(text: string, max: number): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= max) return collapsed;
	return `${collapsed.slice(0, max).trimEnd()}...`;
}

const preview = $derived(truncate(reference.paraphrase, MAX_PREVIEW));
</script>

<a class="card" href={ROUTES.GLOSSARY_ID(reference.id)}>
	<header class="hd">
		<h3>{reference.displayName}</h3>
		<span class="id">{reference.id}</span>
	</header>
	<p class="para">{preview}</p>
	<div class="tags">
		<span class="chip source">{reference.tags.sourceType}</span>
		<span class="chip rules">{reference.tags.flightRules}</span>
		<span class="chip kind">{reference.tags.knowledgeKind}</span>
		{#each reference.tags.aviationTopic as topic (topic)}
			<span class="chip topic">{topic}</span>
		{/each}
	</div>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-sm);
		background: var(--ab-color-surface);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: 0.875rem var(--ab-space-lg);
		text-decoration: none;
		color: inherit;
		transition:
			border-color var(--ab-transition-fast),
			box-shadow var(--ab-transition-fast);
	}

	.card:hover,
	.card:focus-visible {
		border-color: var(--ab-color-primary-hover);
		box-shadow: var(--ab-shadow-sm);
		outline: none;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--ab-space-sm);
	}

	.hd h3 {
		margin: 0;
		font-size: var(--ab-font-size-base);
		color: var(--ab-color-fg);
	}

	.id {
		font-family: var(--ab-font-family-mono);
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-subtle);
	}

	.para {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-muted);
		line-height: var(--ab-line-height-normal);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--ab-space-2xs);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.0625rem var(--ab-space-sm);
		font-size: var(--ab-font-size-xs);
		border-radius: var(--ab-radius-pill);
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg-muted);
		text-transform: uppercase;
		letter-spacing: var(--ab-letter-spacing-wide);
		border: 1px solid var(--ab-color-border);
	}

	.chip.source {
		background: var(--ab-color-primary-subtle);
		color: var(--ab-color-primary);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.chip.kind {
		background: var(--ab-color-warning-subtle);
		color: var(--ab-color-warning);
		border-color: var(--ab-color-warning-subtle-border);
	}
</style>
