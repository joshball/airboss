<script lang="ts">
import AcCard from '@ab/aviation/ui/cards/AcCard.svelte';
import AimCorpusCard from '@ab/aviation/ui/cards/AimCorpusCard.svelte';
import CfrPartCard from '@ab/aviation/ui/cards/CfrPartCard.svelte';
import NtsbCard from '@ab/aviation/ui/cards/NtsbCard.svelte';
import UmbrellaCard from '@ab/aviation/ui/cards/UmbrellaCard.svelte';
import { LIBRARY_REGULATIONS_KINDS, type LibraryRegulationsKind, REFERENCE_KINDS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// PageData is narrowed by the loader; the TS inference through SvelteKit
// occasionally widens kind back to `string`. Re-narrow at the boundary
// so the route helpers stay typed.
const kind = $derived(data.kind as LibraryRegulationsKind);
const titleNumber = $derived(
	kind === LIBRARY_REGULATIONS_KINDS.CFR_14 ? 14 : kind === LIBRARY_REGULATIONS_KINDS.CFR_49 ? 49 : null,
);
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
		{#if data.chapters.length > 0}
			<p class="kind-chapters">
				<span class="kind-chapters-label">Chapters:</span>
				<span>
					{#each data.chapters as ch, i (ch.id)}
						{i > 0 ? ', ' : ''}{ch.id} ({ch.name})
					{/each}
				</span>
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
						{#if titleNumber !== null && group.external}
							<CfrPartCard
								titleNumber={titleNumber as 14 | 49}
								partNumber={group.groupKey}
								partTitle={group.officialTitle ?? `Part ${group.groupKey}`}
								description={group.description ?? null}
								whyItMatters={group.whyItMatters ?? null}
								href={ROUTES.LIBRARY_REGULATIONS_GROUP(kind, group.groupKey)}
								external={group.external}
								sectionCount={group.referenceCount}
							/>
						{:else}
							<UmbrellaCard
								title={group.officialTitle ?? group.label}
								description={group.description ?? null}
								whyItMatters={group.whyItMatters ?? null}
								kindBadge={group.label}
								href={ROUTES.LIBRARY_REGULATIONS_GROUP(kind, group.groupKey)}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.umbrellas.length > 0}
		<section aria-label="Umbrella references" class="block">
			<h2>Umbrella references</h2>
			<ul class="grid">
				{#each data.umbrellas as ref (ref.id)}
					<li>
						{#if ref.kind === REFERENCE_KINDS.AIM || ref.kind === REFERENCE_KINDS.PCG}
							<AimCorpusCard
								title={ref.officialTitle ?? ref.title}
								description={ref.description ?? ''}
								whyItMatters={ref.whyItMatters ?? ''}
								edition={ref.edition}
								kindBadge={ref.kind === REFERENCE_KINDS.PCG ? 'PCG' : 'AIM'}
								external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
							/>
						{:else if ref.kind === REFERENCE_KINDS.NTSB}
							<NtsbCard
								reportNumber={ref.documentSlug}
								reportTitle={ref.title}
								summary={ref.description ?? null}
								external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
							/>
						{:else if ref.kind === REFERENCE_KINDS.AC}
							<AcCard
								acNumber={ref.documentSlug.replace(/^ac-/, '')}
								acTitle={ref.title}
								edition={ref.edition}
								description={ref.description ?? null}
								external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
							/>
						{:else}
							<UmbrellaCard
								title={ref.officialTitle ?? ref.title}
								description={ref.description ?? null}
								whyItMatters={ref.whyItMatters ?? null}
								kindBadge={ref.kindLabel}
								identifier={ref.edition && ref.edition !== '-' ? ref.edition : null}
								external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

<style>
	.block {
		margin-bottom: var(--space-xl);
	}
	.block h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-lg);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
	.kind-overview {
		margin-top: var(--space-md);
		margin-bottom: var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		max-width: 70ch;
	}
	.kind-description {
		margin: 0;
		font-size: var(--font-size-base);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.kind-why {
		margin: 0;
		padding: var(--space-md) var(--space-lg);
		border-left: 3px solid var(--action-default-edge);
		background: var(--surface-sunken, var(--surface-raised));
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		border-radius: var(--radius-sm);
	}
	.kind-why-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.kind-chapters {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
	.kind-chapters-label {
		font-weight: var(--font-weight-semibold);
		margin-right: var(--space-xs);
	}
</style>
