<script lang="ts">
import { ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Regulations & policy -- airboss</title>
</svelte:head>

<PageHeader title="Regulations & policy" subtitle="Federal regulations, AIM, advisory circulars, and accident-investigation references.">
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo; <span>Regulations & policy</span>
		</nav>
	{/snippet}
</PageHeader>

<ul class="grid">
	{#each data.buckets as bucket (bucket.kind)}
		<li>
			<a class="card" class:empty={bucket.count === 0} href={ROUTES.LIBRARY_REGULATIONS_KIND(bucket.kind)}>
				<span class="card-title">{bucket.label}</span>
				<span class="card-count">
					{bucket.count} reference{bucket.count === 1 ? '' : 's'}
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}
	.card:hover,
	.card:focus-visible {
		border-color: var(--action-default-edge);
		outline: none;
	}
	.card.empty {
		opacity: 0.55;
	}
	.card-title {
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-semibold);
	}
	.card-count {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
</style>
