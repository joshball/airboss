<script lang="ts">
import { type LibraryRegulationsKind, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import LibraryCard from '@ab/ui/library/LibraryCard.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// PageData is narrowed by the loader; the TS inference through SvelteKit
// occasionally widens kind back to `string`. Re-narrow at the boundary
// so the route helpers stay typed.
const kind = $derived(data.kind as LibraryRegulationsKind);
</script>

<svelte:head>
	<title>{data.kindLabel} -- airboss</title>
</svelte:head>

<PageHeader title={data.kindLabel}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_REGULATIONS}>Regulations & policy</a> &raquo;
			<span>{data.kindLabel}</span>
		</nav>
	{/snippet}
</PageHeader>

{#if data.groups.length === 0 && data.umbrellas.length === 0}
	<EmptyState
		title={`No ${data.kindLabel} references seeded yet`}
		body="Add reference rows under this kind and run the seed."
	/>
{:else}
	{#if data.groups.length > 0}
		<section aria-label="Groups" class="block">
			<ul class="grid">
				{#each data.groups as group (group.groupKey)}
					<li>
						<a class="card" href={ROUTES.LIBRARY_REGULATIONS_GROUP(kind, group.groupKey)}>
							<span class="card-title">{group.label}</span>
							<span class="card-count">
								{group.referenceCount} reference{group.referenceCount === 1 ? '' : 's'}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.umbrellas.length > 0}
		<section aria-label="Umbrella references" class="block">
			<h2>Umbrella references</h2>
			<ul class="grid grid-wide">
				{#each data.umbrellas as ref (ref.id)}
					<li>
						<LibraryCard
							documentSlug={ref.documentSlug}
							edition={ref.edition}
							title={ref.title}
							publisher={ref.publisher}
							kind={ref.kind}
							subjects={[]}
							externalUrl={ref.externalUrl}
							isReadable={false}
							progress={null}
						/>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

<style>
	.block {
		margin-bottom: var(--space-lg);
	}
	.block h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
	}
	.grid-wide {
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
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
	.card-title {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
	}
	.card-count {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
</style>
