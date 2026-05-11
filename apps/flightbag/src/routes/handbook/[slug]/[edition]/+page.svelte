<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import SubjectChip from '@ab/library/SubjectChip.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title} -- Flightbag</title>
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

	{#if data.chapters.length === 0}
		<ReaderEmptyState
			kind="no-children"
			localPdfHref={data.sourceLinks.localPdfHref}
			externalUrl={data.sourceLinks.onlineUrl}
			heading="This handbook has no chapter rows in the catalog yet."
			note="Read the official FAA PDF below until ingestion finishes."
		/>
	{:else}
		<section aria-label="Chapters">
			<header class="chapters-header">
				<h2>Chapters</h2>
				{#if data.isAuthenticated && data.readProgress.total > 0}
					<p class="progress" aria-label="Handbook reading progress">
						Read <strong>{data.readProgress.read}</strong> of {data.readProgress.total}
						{data.readProgress.total === 1 ? 'section' : 'sections'}
					</p>
				{/if}
			</header>
			<ol class="chapters">
				{#each data.chapters as chapter (chapter.id)}
					{@const fullyRead = chapter.readProgress.total > 0 && chapter.readProgress.read === chapter.readProgress.total}
					<li>
						<a
							href={chapter.href}
							class:read={fullyRead}
							aria-label={`Chapter ${chapter.code} ${chapter.title}${fullyRead ? ' (read)' : ''}`}
						>
							<span class="chapter-code">Chapter {chapter.code}</span>
							<span class="chapter-title">{chapter.title}</span>
							{#if data.isAuthenticated && chapter.readProgress.total > 0}
								<span class="chapter-progress" aria-hidden="true">
									{chapter.readProgress.read}/{chapter.readProgress.total}
								</span>
							{/if}
							{#if chapter.faaPageStart}
								<span class="chapter-pages">pp. {chapter.faaPageStart}{chapter.faaPageEnd ? `..${chapter.faaPageEnd}` : ''}</span>
							{/if}
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
	.subjects {
		margin: var(--space-2xs) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.chapters {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.chapters a {
		display: flex;
		align-items: baseline;
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
		min-width: 6rem;
	}
	.chapter-title {
		flex: 1;
		font-weight: var(--font-weight-medium);
	}
	.chapter-pages {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}

	.chapters-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
		flex-wrap: wrap;
	}
	.chapters-header h2 {
		margin: 0;
	}
	.progress {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.progress strong {
		color: var(--ink-body);
		font-weight: var(--font-weight-bold);
	}
	.chapter-progress {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		min-width: 3rem;
		text-align: right;
	}
	.chapters a.read {
		border-color: var(--signal-success-edge, var(--edge-default));
	}
	.chapters a.read .chapter-progress {
		color: var(--signal-success-ink, var(--ink-body));
	}
</style>
