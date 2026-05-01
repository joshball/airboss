<script lang="ts">
import { ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import LibraryCard from '@ab/ui/library/LibraryCard.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title} -- airboss</title>
</svelte:head>

<PageHeader title={data.reference.title}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo; <span>{data.reference.title}</span>
		</nav>
	{/snippet}
	{#snippet subtitleSnippet()}
		<p class="subtitle">Aircraft-specific reference -- {data.reference.publisher}</p>
	{/snippet}
</PageHeader>

<div class="card-wrap">
	<LibraryCard
		documentSlug={data.reference.documentSlug}
		edition={data.reference.edition}
		title={data.reference.title}
		publisher={data.reference.publisher}
		kind={data.reference.kind}
		subjects={data.reference.subjects}
		externalUrl={data.reference.externalUrl}
		isReadable={false}
		progress={null}
	/>
</div>

<p class="explainer">
	POH/AFM content is manufacturer-specific and not redistributed through this app. The card above links to the
	publisher's source when an external URL is on file.
</p>

<style>
	.subtitle {
		margin: 0;
		color: var(--ink-muted);
	}
	.card-wrap {
		max-width: 36rem;
		margin-bottom: var(--space-md);
	}
	.explainer {
		color: var(--ink-muted);
		max-width: 60ch;
	}
</style>
