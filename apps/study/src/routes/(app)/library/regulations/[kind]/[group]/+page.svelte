<script lang="ts">
import { type LibraryRegulationsKind, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import LibraryCard from '@ab/ui/library/LibraryCard.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const kind = $derived(data.kind as LibraryRegulationsKind);
const kindLabel = $derived(data.kindLabel);
</script>

<svelte:head>
	<title>{data.groupLabel} -- airboss</title>
</svelte:head>

<PageHeader title={data.groupLabel}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_REGULATIONS}>Regulations & policy</a> &raquo;
			<a href={ROUTES.LIBRARY_REGULATIONS_KIND(kind)}>{kindLabel}</a> &raquo;
			<span>{data.groupLabel}</span>
		</nav>
	{/snippet}
</PageHeader>

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
	.section-link:hover,
	.section-link:focus-visible {
		border-color: var(--action-default-edge);
		outline: none;
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
</style>
