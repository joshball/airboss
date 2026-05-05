<script lang="ts">
import AcCard from '@ab/aviation/ui/cards/AcCard.svelte';
import AimCorpusCard from '@ab/aviation/ui/cards/AimCorpusCard.svelte';
import NtsbCard from '@ab/aviation/ui/cards/NtsbCard.svelte';
import UmbrellaCard from '@ab/aviation/ui/cards/UmbrellaCard.svelte';
import { type LibraryRegulationsKind, REFERENCE_KINDS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const kind = $derived(data.kind as LibraryRegulationsKind);
const kindLabel = $derived(data.kindLabel);
</script>

<svelte:head>
	<title>{data.groupLabel} -- airboss</title>
</svelte:head>

<PageHeader title={data.groupLabel} subtitle={data.officialTitle ?? undefined}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_REGULATIONS}>Regulations & policy</a> &raquo;
			<a href={ROUTES.LIBRARY_REGULATIONS_KIND(kind)}>{kindLabel}</a> &raquo;
			<span>{data.groupLabel}</span>
		</nav>
	{/snippet}
</PageHeader>

{#if data.description || data.whyItMatters}
	<section aria-label="About this part" class="group-overview">
		{#if data.description}
			<p class="group-description">{data.description}</p>
		{/if}
		{#if data.whyItMatters}
			<p class="group-why">
				<span class="group-why-label">Why pilots care</span>
				<span>{data.whyItMatters}</span>
			</p>
		{/if}
	</section>
{/if}

{#if data.sections.length > 0}
	<section aria-label="Sections">
		<ul class="section-list">
			{#each data.sections as section (section.id)}
				<li>
					<a href={ROUTES.LIBRARY_REGULATIONS_SECTION(kind, data.group, section.code)} class="section-link">
						<span class="section-code">{section.code}</span>
						<span class="section-title">{section.title}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{:else if data.umbrellas.length > 0}
	<section aria-label="Umbrella references">
		<ul class="grid">
			{#each data.umbrellas as ref (ref.id)}
				<li>
					{#if ref.kind === REFERENCE_KINDS.AIM || ref.kind === REFERENCE_KINDS.PCG}
						<AimCorpusCard
							title={ref.title}
							officialTitle={ref.officialTitle ?? null}
							description={ref.description ?? ''}
							whyItMatters={ref.whyItMatters ?? ''}
							edition={ref.edition}
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
							title={ref.title}
							officialTitle={ref.officialTitle ?? null}
							description={ref.description ?? null}
							whyItMatters={ref.whyItMatters ?? null}
							kindBadge={ref.kindLabel}
							editionBadge={ref.edition}
							external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{:else}
	<EmptyState title="No content yet" body="This group exists but no section data has been ingested." />
{/if}

<style>
	.section-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.section-link {
		display: grid;
		grid-template-columns: minmax(4rem, max-content) 1fr;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}
	.section-link:hover {
		border-color: var(--action-default-edge);
	}
	.section-link:focus-visible {
		border-color: var(--action-default-edge);
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.section-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
	.group-overview {
		margin-bottom: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.group-description {
		margin: 0;
		font-size: var(--font-size-base);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.group-why {
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		border-left: 3px solid var(--action-default-edge);
		background: var(--surface-sunken, var(--surface-raised));
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}
	.group-why-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
</style>
