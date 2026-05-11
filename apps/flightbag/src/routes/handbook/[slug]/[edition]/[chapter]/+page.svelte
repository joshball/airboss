<script lang="ts">
import { ROUTES } from '@ab/constants';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import ReadingTime from '@ab/library/ReadingTime.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import { hasChapterPreamble } from '../../../../../lib/chapter-preamble';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const hasPreamble = $derived(hasChapterPreamble({ contentMd: data.chapter.contentMd, figures: data.figures }));
const hasSections = $derived(data.sections.length > 0);
</script>

<svelte:head>
	<title>{data.reference.title} -- Chapter {data.chapter.code}</title>
</svelte:head>

{#if hasSections}
	{#if hasPreamble}
		<RenderedSection
			title={`Chapter ${data.chapter.code}: ${data.chapter.title}`}
			id={data.uri}
			body={data.chapter.contentMd}
			figures={data.figures}
			locator={data.chapter.sourceLocator}
			metadata={data.chapter.metadata}
			readingTimeMinutes={data.readingTime.chapterMinutes}
		/>
	{:else}
		<header class="page-header-inline">
			<h1>Chapter {data.chapter.code}: {data.chapter.title}</h1>
			<p class="meta-row">
				{#if data.chapter.sourceLocator}
					<span class="locator">{data.chapter.sourceLocator}</span>
				{/if}
				<ReadingTime
					minutes={data.readingTime.chapterMinutes}
					ariaLabel={`Approximately ${data.readingTime.chapterMinutes} minutes to read this chapter`}
				/>
			</p>
		</header>
	{/if}

	<section aria-label="Sections">
		<header class="sections-header">
			<h2>Sections</h2>
			{#if data.isAuthenticated && data.readProgress.total > 0}
				<p class="progress" aria-label="Chapter reading progress">
					Read <strong>{data.readProgress.read}</strong> of {data.readProgress.total}
					{data.readProgress.total === 1 ? 'section' : 'sections'}
				</p>
			{/if}
		</header>
		<ol class="sections">
			{#each data.sections as section (section.id)}
				{@const isRead = data.readSectionIds.includes(section.id)}
				<li>
					<a
						href={section.href}
						class:read={isRead}
						aria-label={`§${section.code} ${section.title}${isRead ? ' (read)' : ''}`}
					>
						<span class="section-code">§{section.code}</span>
						<span class="section-title">{section.title}</span>
						{#if isRead}
							<span class="check" aria-hidden="true">✓</span>
						{/if}
					</a>
				</li>
			{/each}
		</ol>
	</section>

	<ReaderNav nav={data.nav} variant={data.nav.next === null ? 'end-of-doc' : 'footer'} />
{:else}
	<RenderedSection
		title={`Chapter ${data.chapter.code}: ${data.chapter.title}`}
		id={data.uri}
		body={data.chapter.contentMd}
		figures={data.figures}
		locator={data.chapter.sourceLocator}
		metadata={data.chapter.metadata}
		readingTimeMinutes={data.readingTime.chapterMinutes}
	>
		{#snippet emptyFallback()}
			<ReaderNav nav={data.nav} variant="empty" />
		{/snippet}
		{#snippet footer()}
			<ReaderNav nav={data.nav} variant={data.nav.next === null ? 'end-of-doc' : 'footer'} />
		{/snippet}
	</RenderedSection>
{/if}

<style>
	.page-header-inline {
		margin-bottom: var(--space-lg);
	}
	.page-header-inline h1 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}
	.meta-row {
		margin: 0;
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--space-xs) var(--space-sm);
	}
	.locator {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}

	.sections {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.sections a {
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
	.sections a:hover,
	.sections a:focus-visible {
		border-color: var(--action-default-edge);
	}
	.section-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 4rem;
	}
	.section-title {
		flex: 1;
	}
	.check {
		color: var(--signal-success-ink, var(--ink-muted));
		font-weight: var(--font-weight-bold);
	}
	.sections a.read {
		border-color: var(--signal-success-edge, var(--edge-default));
	}

	.sections-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
		flex-wrap: wrap;
		margin-top: var(--space-lg);
	}
	.sections-header h2 {
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
</style>
