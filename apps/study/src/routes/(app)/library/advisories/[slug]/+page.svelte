<script lang="ts">
import InfoCard from '@ab/aviation/ui/cards/InfoCard.svelte';
import SafoCard from '@ab/aviation/ui/cards/SafoCard.svelte';
import { LIBRARY_ADVISORIES_KINDS, ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const isSafo = $derived(data.bulletin.kind === LIBRARY_ADVISORIES_KINDS.SAFO);
</script>

<svelte:head>
	<title>{data.bulletin.edition} -- airboss</title>
</svelte:head>

<PageHeader title={data.bulletin.edition} subtitle={data.bulletin.title}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_ADVISORIES}>Advisories</a> &raquo;
			<span>{data.kindCopy.shortLabel}</span>
		</nav>
	{/snippet}
</PageHeader>

<section aria-label="Bulletin" class="bulletin">
	{#if isSafo}
		<SafoCard
			safoNumber={data.bulletin.documentSlug}
			title={data.bulletin.officialTitle ?? data.bulletin.title}
			date={data.bulletin.date}
			summary={data.bulletin.description ?? null}
			audience={data.bulletin.audience}
			external={data.bulletin.external}
		/>
	{:else}
		<InfoCard
			infoNumber={data.bulletin.documentSlug}
			title={data.bulletin.officialTitle ?? data.bulletin.title}
			date={data.bulletin.date}
			summary={data.bulletin.description ?? null}
			audience={data.bulletin.audience}
			external={data.bulletin.external}
		/>
	{/if}

	<div class="meta">
		{#if data.bulletin.whyItMatters}
			<p class="why">
				<span class="why-label">Why this bulletin matters</span>
				<span>{data.bulletin.whyItMatters}</span>
			</p>
		{/if}
		<p class="kind-context">
			{data.kindCopy.officialTitle} -- {data.kindCopy.description}
		</p>
		{#if data.bulletin.external}
			<p class="external-cta">
				<a href={data.bulletin.external.url} rel="noopener noreferrer" target="_blank">
					Read the bulletin on {data.bulletin.external.label}
				</a>
			</p>
		{/if}
	</div>
</section>

<style>
	.bulletin {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		max-width: 48rem;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.why {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.why-label {
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-size: var(--font-size-xs);
	}
	.kind-context {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.external-cta {
		margin: 0;
	}
	.external-cta a {
		font-weight: var(--font-weight-semibold);
	}
</style>
