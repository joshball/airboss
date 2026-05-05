<script lang="ts">
import LibraryCard from '@ab/aviation/ui/LibraryCard.svelte';
import { type LibraryRegulationsKind, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
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

<PageHeader title={data.kindLabel} subtitle={data.officialTitle ?? undefined}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_REGULATIONS}>Regulations & policy</a> &raquo;
			<span>{data.kindLabel}</span>
		</nav>
	{/snippet}
</PageHeader>

{#if data.description || data.whyItMatters}
	<section aria-label="About this corpus" class="kind-overview">
		{#if data.description}
			<p class="kind-description">{data.description}</p>
		{/if}
		{#if data.whyItMatters}
			<p class="kind-why">
				<span class="kind-why-label">Why pilots care</span>
				<span>{data.whyItMatters}</span>
			</p>
		{/if}
	</section>
{/if}

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
							{#if group.officialTitle}
								<span class="card-official">{group.officialTitle}</span>
							{/if}
							{#if group.description}
								<p class="card-description">{group.description}</p>
							{/if}
							{#if group.whyItMatters}
								<p class="card-why">
									<span class="card-why-label">Why pilots care</span>
									<span>{group.whyItMatters}</span>
								</p>
							{/if}
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
		gap: var(--space-md);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
	.grid-wide {
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-md) var(--space-lg);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}
	.card:hover {
		border-color: var(--action-default-edge);
	}
	.card:focus-visible {
		border-color: var(--action-default-edge);
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.card-title {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.card-official {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		font-style: italic;
	}
	.card-description {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-sm);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.card-why {
		margin: var(--space-2xs) 0 0;
		padding: var(--space-xs) var(--space-sm);
		border-left: 2px solid var(--action-default-edge);
		background: var(--surface-sunken, var(--surface-raised));
		font-size: var(--font-size-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}
	.card-why-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.card-count {
		margin-top: var(--space-xs);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.kind-overview {
		margin-bottom: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.kind-description {
		margin: 0;
		font-size: var(--font-size-base);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.kind-why {
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		border-left: 3px solid var(--action-default-edge);
		background: var(--surface-sunken, var(--surface-raised));
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}
	.kind-why-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
</style>
