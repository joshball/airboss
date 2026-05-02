<script lang="ts">
import LibraryCard from '@ab/aviation/ui/LibraryCard.svelte';
import { ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.topicLabel} library -- airboss</title>
</svelte:head>

<PageHeader title={`Library -- ${data.topicLabel}`}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo; <span>{data.topicLabel}</span>
		</nav>
	{/snippet}
	{#snippet subtitleSnippet()}
		<p class="counts">
			{data.totalCount} reference{data.totalCount === 1 ? '' : 's'} tagged with this topic
		</p>
	{/snippet}
</PageHeader>

{#if data.groups.length === 0}
	<EmptyState
		title={`Nothing tagged "${data.topicLabel}" yet`}
		body="No active references list this topic in their subjects."
	/>
{:else}
	{#each data.groups as group (group.cert ?? '__null__')}
		<section class="group" aria-labelledby={`g-${group.cert ?? 'null'}`}>
			<h2 id={`g-${group.cert ?? 'null'}`}>{group.label}</h2>
			<ul class="grid">
				{#each group.cards as card (`${group.cert ?? 'null'}:${card.id}`)}
					<li>
						<LibraryCard
							documentSlug={card.documentSlug}
							edition={card.edition}
							title={card.title}
							publisher={card.publisher}
							kind={card.kind}
							subjects={card.subjects}
							externalUrl={card.externalUrl}
							isReadable={card.isReadable}
							progress={null}
						/>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}

<style>
	.counts {
		margin: 0;
		color: var(--ink-muted);
	}
	.group {
		margin-bottom: var(--space-lg);
	}
	.group h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-xl);
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
</style>
