<script lang="ts">
import CfrTitleCard from '@ab/aviation/ui/cards/CfrTitleCard.svelte';
import UmbrellaCard from '@ab/aviation/ui/cards/UmbrellaCard.svelte';
import { LIBRARY_REGULATIONS_KINDS, ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Regulations & policy -- airboss</title>
</svelte:head>

<PageHeader
	title="Regulations & policy"
	subtitle="Federal regulations, AIM, advisory circulars, and accident-investigation references."
>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo; <span>Regulations & policy</span>
		</nav>
	{/snippet}
</PageHeader>

<ul class="grid">
	{#each data.buckets as bucket (bucket.kind)}
		<li class:empty={bucket.count === 0}>
			{#if bucket.kind === LIBRARY_REGULATIONS_KINDS.CFR_14 || bucket.kind === LIBRARY_REGULATIONS_KINDS.CFR_49}
				<CfrTitleCard
					shortLabel={bucket.label}
					topic={bucket.topic ?? ''}
					officialTitle={bucket.officialTitle ?? ''}
					description={bucket.description ?? ''}
					whyItMatters={bucket.whyItMatters ?? ''}
					href={ROUTES.LIBRARY_REGULATIONS_KIND(bucket.kind)}
					countLabel={`${bucket.count} reference${bucket.count === 1 ? '' : 's'}`}
				/>
			{:else}
				<UmbrellaCard
					title={bucket.label}
					officialTitle={bucket.officialTitle ?? null}
					description={bucket.description ?? null}
					whyItMatters={bucket.whyItMatters ?? null}
					href={ROUTES.LIBRARY_REGULATIONS_KIND(bucket.kind)}
				/>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-md);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
	li.empty {
		opacity: 0.55;
	}
</style>
