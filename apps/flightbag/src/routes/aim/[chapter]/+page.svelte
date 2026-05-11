<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>AIM Chapter {data.chapter.code} -- {data.chapter.title}</title>
</svelte:head>

<ReaderLayout>
	{#snippet breadcrumb()}
		<Breadcrumbs
			segments={[
				{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
				{ label: data.reference.title, href: ROUTES.FLIGHTBAG_AIM },
				{ label: `Chapter ${data.chapter.code}`, href: null },
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
		Chapter {data.chapter.code}: {data.chapter.title}
	{/snippet}

	{#if data.sections.length === 0}
		<ReaderEmptyState
			kind="no-children"
			localPdfHref={data.sourceLinks.localPdfHref}
			externalUrl={data.sourceLinks.onlineUrl}
			heading="No sections seeded under this chapter."
			note="The chapter is catalogued but its sections aren't ingested into the reader yet."
		/>
	{:else}
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
	{/if}
</ReaderLayout>

<style>
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
