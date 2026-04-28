<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const reference = $derived(data.reference);
const chapters = $derived(data.chapters);
</script>

<svelte:head>
	<title>{reference.title} -- Handbook lens -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.LENS_HANDBOOK}>{NAV_LABELS.LENS_HANDBOOK}</a>
		<span aria-hidden="true">/</span>
		<span>{reference.title}</span>
	</nav>

	<PageHeader
		eyebrow={reference.publisher}
		title={reference.title}
		subtitle="Edition: {reference.edition}. Chapters with knowledge-node citations and your read state."
	/>

	{#if chapters.length === 0}
		<EmptyState
			title="No chapters ingested"
			body="The reference exists but no chapters were ingested. Run the ingest pipeline for this handbook."
		/>
	{:else}
		<ul class="chapters">
			{#each chapters as chapter (chapter.id)}
				<li class="chapter">
					<a class="chapter-link" href={ROUTES.LENS_HANDBOOK_CHAPTER(reference.documentSlug, chapter.code)}>
						<span class="ch-code">{chapter.code}</span>
						<span class="ch-title">{chapter.title}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 80rem;
		margin: 0 auto;
		width: 100%;
	}

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.crumb a {
		color: var(--ink-subtle);
	}

	.chapters {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.chapter {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.chapter:hover {
		border-color: var(--edge-strong);
	}

	.chapter-link {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		padding: var(--space-md);
		color: inherit;
		text-decoration: none;
	}

	.ch-code {
		color: var(--ink-faint);
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-sm);
		min-width: 3rem;
	}

	.ch-title {
		font-weight: var(--font-weight-semibold);
	}
</style>
