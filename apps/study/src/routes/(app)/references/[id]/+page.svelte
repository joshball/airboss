<script lang="ts">
import { CITATION_SOURCE_LABELS, CITATION_SOURCE_TYPES, type CitationSourceType, ROUTES } from '@ab/constants';
import CitedByPanel, { type CitedByItem } from '@ab/ui/components/CitedByPanel.svelte';
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

const citedByItems = $derived<CitedByItem[]>(
	citedBy.map((c) => ({
		id: c.citation.id,
		typeLabel: sourceTypeLabel(c.source.type),
		label: c.source.label,
		href: c.source.exists ? citedByHref(c.source.type, c.source.id) : null,
		context: c.citation.citationContext,
	})),
);
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

	<div class="body">
		<CitedByPanel items={citedByItems} />
	</div>
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

</style>
