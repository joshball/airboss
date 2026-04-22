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
		gap: 0.5rem;
		background: var(--ab-color-surface, white);
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-radius: 10px;
		padding: 0.875rem 1rem;
		text-decoration: none;
		color: inherit;
		transition: border-color 120ms, box-shadow 120ms;
	}

	.card:hover,
	.card:focus-visible {
		border-color: var(--ab-color-primary-hover, #1d4ed8);
		box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
		outline: none;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.hd h3 {
		margin: 0;
		font-size: 1rem;
		color: var(--ab-color-fg, #0f172a);
	}

	.id {
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		font-size: 0.6875rem;
		color: var(--ab-color-fg-subtle, #94a3b8);
	}

	.para {
		margin: 0;
		font-size: 0.875rem;
		color: var(--ab-color-fg-muted, #475569);
		line-height: 1.45;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.0625rem 0.5rem;
		font-size: 0.6875rem;
		border-radius: 999px;
		background: var(--ab-color-surface-sunken, #f1f5f9);
		color: var(--ab-color-fg-muted, #475569);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border: 1px solid var(--ab-color-border, #e2e8f0);
	}

	.chip.source {
		background: var(--ab-color-primary-subtle, #eff6ff);
		color: var(--ab-color-primary, #1d4ed8);
		border-color: var(--ab-color-primary-border, #bfdbfe);
	}

	.chip.kind {
		background: #fefce8;
		color: #a16207;
		border-color: #fde047;
	}
</style>
