<script lang="ts">
import { CARD_TYPE_LABELS, type CardType, CONTENT_SOURCE_LABELS, type ContentSource, domainLabel } from '@ab/constants';
import CitationChips, { type CitationChipItem } from '@ab/ui/components/CitationChips.svelte';
import { humanize } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const card = $derived(data.card);

const citationItems = $derived<CitationChipItem[]>(
	card.citations.map((c) => ({
		id: c.id,
		typeLabel: c.detail,
		label: c.label,
		href: c.href,
	})),
);

function cardTypeLabel(slug: string): string {
	return (CARD_TYPE_LABELS as Record<CardType, string>)[slug as CardType] ?? humanize(slug);
}

function sourceLabel(slug: string): string {
	return (CONTENT_SOURCE_LABELS as Record<ContentSource, string>)[slug as ContentSource] ?? humanize(slug);
}
</script>

<svelte:head>
	<title>{card.front.slice(0, 60)} -- airboss</title>
	<meta name="description" content={card.back.slice(0, 200)} />
	<meta property="og:title" content={card.front.slice(0, 120)} />
	<meta property="og:description" content={card.back.slice(0, 200)} />
	<meta property="og:type" content="article" />
</svelte:head>

<main class="page">
	<article class="card">
		<header class="hd">
			<span class="badge domain">{domainLabel(card.domain)}</span>
			<span class="badge type">{cardTypeLabel(card.cardType)}</span>
		</header>

		<section class="section">
			<div class="section-label">Question</div>
			<div class="section-text">{card.front}</div>
		</section>

		<hr />

		<section class="section">
			<div class="section-label">Answer</div>
			<div class="section-text">{card.back}</div>
		</section>

		{#if citationItems.length > 0}
			<section class="section">
				<div class="section-label">Citations</div>
				<CitationChips items={citationItems} />
			</section>
		{/if}

		<footer class="ft">
			<span class="source">Source: {sourceLabel(card.sourceType)}</span>
			<span class="brand">airboss</span>
		</footer>
	</article>
</main>

<style>
	.page {
		max-width: 42rem;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-lg);
	}

	.card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--font-size-xs);
		font-weight: 600;
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		background: var(--surface-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badge.domain {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.section-label {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin-bottom: var(--space-sm);
	}

	.section-text {
		white-space: pre-wrap;
		color: var(--ink-body);
		font-size: var(--type-reading-body-size);
		line-height: 1.55;
	}

	hr {
		border: none;
		border-top: 1px dashed var(--edge-default);
		margin: 0;
	}

	.ft {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: var(--space-md);
		border-top: 1px solid var(--edge-default);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.brand {
		font-weight: 600;
		color: var(--ink-muted);
	}
</style>
