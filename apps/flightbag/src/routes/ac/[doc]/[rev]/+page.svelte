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

	{#if data.chapters.length === 0}
		<ReaderEmptyState
			kind="sourced-only"
			localPdfHref={data.sourceLinks.localPdfHref}
			externalUrl={data.reference.externalUrl}
			externalLabel="Online PDF"
		/>
	{:else}
		<section aria-label="Chapters">
			<h2>Contents</h2>
			<ol class="chapters">
				{#each data.chapters as chapter (chapter.id)}
					<li>
						<a href={chapter.href}>
							<span class="chapter-code">Ch {chapter.code}</span>
							<span class="chapter-title">{chapter.title}</span>
						</a>
					</li>
				{/each}
			</ol>
		</section>
	{/if}
</ReaderLayout>

<style>
	.edition {
		font-family: var(--font-family-mono);
	}
	.chapters {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.chapters a {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
	}
	.chapters a:hover,
	.chapters a:focus-visible {
		border-color: var(--action-default-edge);
	}
	.chapter-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 4rem;
	}
</style>
