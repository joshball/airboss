<script lang="ts">
import { CITATION_SOURCE_LABELS, CITATION_SOURCE_TYPES, type CitationSourceType, ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const reference = $derived(data.reference);
const citedBy = $derived(data.citedBy);

function citedByHref(type: CitationSourceType, id: string): string | null {
	switch (type) {
		case CITATION_SOURCE_TYPES.CARD:
			return ROUTES.CARD_PUBLIC(id);
		case CITATION_SOURCE_TYPES.REP:
		case CITATION_SOURCE_TYPES.SCENARIO:
			return ROUTES.REP_DETAIL(id);
		case CITATION_SOURCE_TYPES.NODE:
			return ROUTES.KNOWLEDGE_SLUG(id);
		default:
			return null;
	}
}

function sourceTypeLabel(type: CitationSourceType): string {
	return CITATION_SOURCE_LABELS[type];
}
</script>

<svelte:head>
	<title>{reference.displayName} -- References -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<h1>{reference.displayName}</h1>
		<div class="sub">
			<span class="kind">{reference.sourceLabel}</span>
			<span class="id">{reference.id}</span>
		</div>
	</header>

	<section class="body" aria-label="Paraphrase">
		<h2>Paraphrase</h2>
		<p class="paraphrase">{reference.paraphrase}</p>
	</section>

	<section class="body" aria-label="Cited by">
		<h2>Cited by ({citedBy.length})</h2>
		{#if citedBy.length === 0}
			<p class="cited-by-empty">Not yet cited by other content.</p>
		{:else}
			<ul class="cited-by-list">
				{#each citedBy as c (c.citation.id)}
					{@const href = c.source.exists ? citedByHref(c.source.type, c.source.id) : null}
					<li class="cited-by-row">
						<span class="cited-by-type">{sourceTypeLabel(c.source.type)}</span>
						{#if href}
							<a class="cited-by-label" {href}>{c.source.label}</a>
						{:else}
							<span class="cited-by-label cited-by-missing">{c.source.label}</span>
						{/if}
						{#if c.citation.citationContext}
							<span class="cited-by-context">"{c.citation.citationContext}"</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
	}

	.kind {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--action-default-hover);
	}

	.id {
		font-family: var(--font-family-mono, ui-monospace, monospace);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
	}

	.body h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-label-size);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.paraphrase {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-reading-body-size);
		line-height: 1.55;
		white-space: pre-wrap;
	}

	.cited-by-empty {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--type-ui-label-size);
	}

	.cited-by-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.cited-by-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
		flex-wrap: wrap;
	}

	.cited-by-type {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.cited-by-label {
		color: var(--action-default-active);
		text-decoration: none;
		font-weight: 500;
	}

	.cited-by-label:is(a):hover {
		text-decoration: underline;
	}

	.cited-by-missing {
		color: var(--ink-subtle);
		font-style: italic;
	}

	.cited-by-context {
		color: var(--ink-muted);
		font-style: italic;
	}
</style>
