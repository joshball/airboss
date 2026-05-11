<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import SubjectChip from '@ab/library/SubjectChip.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const partLabel = $derived(data.reference.documentSlug.replace(/^\d+cfr/, ''));
</script>

<svelte:head>
	<title>{data.reference.title}</title>
</svelte:head>

<ReaderLayout>
	{#snippet breadcrumb()}
		<Breadcrumbs
			segments={[
				{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
				{ label: data.reference.title, href: null },
			]}
		/>
	{/snippet}

	{#snippet sourceLinks()}
		<SourceLinks
			localPdfHref={data.sourceLinks.localPdfHref}
			onlineUrl={data.sourceLinks.onlineUrl}
			localPdfMissing={data.sourceLinks.localPdfMissing}
		/>
	{/snippet}

	{#snippet title()}
		{data.reference.title}
	{/snippet}

	{#snippet subtitle()}
		<span class="edition">{data.reference.edition}</span>
		<span class="publisher">{data.reference.publisher}</span>
	{/snippet}

	{#snippet pageHeaderExtra()}
		{#if data.reference.subjects.length > 0}
			<p class="subjects">
				{#each data.reference.subjects as subject (subject)}
					<SubjectChip {subject} />
				{/each}
			</p>
		{/if}
	{/snippet}

	{#if data.sections.length > 0}
		<section aria-label="Sections">
			<h2>Sections</h2>
			<ol class="sections">
				{#each data.sections as section (section.id)}
					<li>
						<a href={section.href}>
							<span class="section-code">§{section.code}</span>
							<span class="section-title">{section.title}</span>
						</a>
					</li>
				{/each}
			</ol>
		</section>
	{:else}
		<ReaderEmptyState
			kind="not-yet-ingested"
			externalUrl={data.ecfrUrl}
			heading="Read on eCFR"
			note="This Part has been catalogued in airboss but its individual sections aren't ingested into the flightbag reader yet. The federal eCFR site is the authoritative source -- it stays current with amendments and supports per-section deep links."
			externalLabel={`Open Part ${partLabel} on eCFR`}
		/>
	{/if}
</ReaderLayout>

<style>
	.edition {
		font-family: var(--font-family-mono);
	}
	.subjects {
		margin: var(--space-2xs) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.sections {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.sections a {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
	}
	.sections a:hover,
	.sections a:focus-visible {
		border-color: var(--action-default-edge);
	}
	.section-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 4rem;
	}
</style>
