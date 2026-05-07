<script lang="ts">
import AcsCard from '@ab/aviation/ui/cards/AcsCard.svelte';
import PtsCard from '@ab/aviation/ui/cards/PtsCard.svelte';
import { LIBRARY_TESTING_KINDS, ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const isAcs = $derived(data.reference.testingKind === LIBRARY_TESTING_KINDS.ACS);
</script>

<svelte:head>
	<title>{data.reference.title} -- airboss</title>
</svelte:head>

<PageHeader title={data.reference.title} subtitle={data.copy.officialTitle ?? undefined}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_TESTING}>Testing standards</a> &raquo;
			<span>{data.reference.edition || data.reference.documentSlug}</span>
		</nav>
	{/snippet}
</PageHeader>

<div class="card-container">
	{#if isAcs}
		<AcsCard
			slug={data.reference.documentSlug}
			title={data.copy.officialTitle ?? data.reference.title}
			edition={data.reference.edition}
			description={data.copy.description ?? null}
			whyItMatters={data.copy.whyItMatters ?? null}
			external={data.external}
		/>
	{:else}
		<PtsCard
			slug={data.reference.documentSlug}
			title={data.copy.officialTitle ?? data.reference.title}
			edition={data.reference.edition}
			description={data.copy.description ?? null}
			whyItMatters={data.copy.whyItMatters ?? null}
			external={data.external}
		/>
	{/if}
</div>

{#if data.external}
	<section aria-labelledby="open-h" class="reader-fallback">
		<h2 id="open-h">Open the publication</h2>
		<p>
			The full text of this publication lives on the publisher's site. Read it directly to see the task tables,
			special-emphasis areas, and the references the FAA cites for each element.
		</p>
		<p>
			<a class="external-link" href={data.external.url} target="_blank" rel="noopener noreferrer"
				>Open on {data.external.label}</a
			>
		</p>
	</section>
{/if}

<style>
	.card-container {
		max-width: 36rem;
		margin-bottom: var(--space-2xl);
	}
	.reader-fallback {
		margin-top: var(--space-xl);
		padding: var(--space-md) var(--space-lg);
		border-left: 3px solid var(--action-default-edge);
		background: var(--surface-sunken, var(--surface-raised));
		border-radius: var(--radius-sm);
		max-width: 70ch;
	}
	.reader-fallback h2 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.reader-fallback p {
		margin: var(--space-2xs) 0;
		line-height: var(--line-height-relaxed, 1.55);
	}
	.external-link {
		font-weight: var(--font-weight-semibold);
	}
</style>
