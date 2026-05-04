<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title} -- Flightbag</title>
</svelte:head>

<Breadcrumbs
	segments={[
		{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
		{ label: data.reference.title, href: null },
	]}
/>

<SourceLinks
	localPdfHref={data.sourceLinks.localPdfHref}
	onlineUrl={data.sourceLinks.onlineUrl}
	localPdfMissing={data.sourceLinks.localPdfMissing}
/>

<header class="page-header">
	<h1>{data.reference.title}</h1>
	<p class="meta">
		<span class="edition">{data.reference.edition}</span>
		<span class="publisher">{data.reference.publisher}</span>
	</p>
	{#if data.reference.subjects.length > 0}
		<p class="subjects">
			{#each data.reference.subjects as subject (subject)}
				<span class="subject">{subject}</span>
			{/each}
		</p>
	{/if}
</header>

{#if data.chapters.length === 0}
	<p class="empty">This handbook has no chapter rows in the catalog yet.</p>
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

<style>
	.page-header {
		margin-bottom: var(--space-lg);
	}
	.page-header h1 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}
	.meta {
		margin: 0 0 var(--space-xs);
		display: flex;
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.edition {
		font-family: var(--font-family-mono);
	}
	.subjects {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}
	.subject {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		padding: var(--space-2xs) var(--space-xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
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
	.empty {
		color: var(--ink-muted);
		font-style: italic;
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
