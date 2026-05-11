<script lang="ts">
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import SubjectChip from '@ab/library/SubjectChip.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const partLabel = $derived(data.reference.documentSlug.replace(/^\d+cfr/, ''));
</script>

<svelte:head>
	<title>{data.reference.title}</title>
</svelte:head>

<header class="title-block">
	<h1>{data.reference.title}</h1>
	<p class="meta">
		<span class="edition">{data.reference.edition}</span>
		<span class="publisher">{data.reference.publisher}</span>
	</p>
	{#if data.reference.subjects.length > 0}
		<p class="subjects">
			{#each data.reference.subjects as subject (subject)}
				<SubjectChip {subject} />
			{/each}
		</p>
	{/if}
</header>

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

<style>
	.title-block {
		margin-bottom: var(--space-lg);
	}
	.title-block h1 {
		margin: 0 0 var(--space-2xs);
	}
	.meta {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
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
