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
	<title>AIM §{data.section.code} -- {data.section.title}</title>
</svelte:head>

<ReaderLayout>
	{#snippet breadcrumb()}
		<Breadcrumbs
			segments={[
				{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
				{ label: data.reference.title, href: data.links.aimHref },
				{ label: `Chapter ${data.section.code.split('-')[0]}`, href: data.links.chapterHref },
				{ label: `§${data.section.code}`, href: null },
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
		§{data.section.code} -- {data.section.title}
	{/snippet}

	{#if data.paragraphs.length === 0}
		<ReaderEmptyState
			kind="no-children"
			localPdfHref={data.sourceLinks.localPdfHref}
			externalUrl={data.sourceLinks.onlineUrl}
			heading="No paragraphs seeded under this section."
			note="The section is catalogued but its paragraphs aren't ingested into the reader yet."
		/>
	{:else}
		<section aria-label="Paragraphs">
			<h2>Paragraphs</h2>
			<ol class="paragraphs">
				{#each data.paragraphs as paragraph (paragraph.id)}
					<li>
						<a href={paragraph.href}>
							<span class="para-code">¶{paragraph.code}</span>
							<span class="para-title">{paragraph.title}</span>
						</a>
					</li>
				{/each}
			</ol>
		</section>
	{/if}
</ReaderLayout>

<style>
	.paragraphs {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.paragraphs a {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
	}
	.paragraphs a:hover,
	.paragraphs a:focus-visible {
		border-color: var(--action-default-edge);
	}
	.para-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 5rem;
	}
</style>
