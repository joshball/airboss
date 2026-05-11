<script lang="ts">
import ReaderNav from '@ab/library/ReaderNav.svelte';
import ReadingTime from '@ab/library/ReadingTime.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import { hasChapterPreamble } from '../../../../../lib/chapter-preamble';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const hasPreamble = $derived(hasChapterPreamble({ contentMd: data.chapter.contentMd, figures: data.figures }));
const hasSections = $derived(data.sections.length > 0);
const isEndOfDoc = $derived(data.nav.next === null);
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

	<ReaderNav nav={data.nav} variant={isEndOfDoc ? 'end-of-doc' : 'footer'} />
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
			<ReaderNav nav={data.nav} variant={isEndOfDoc ? 'end-of-doc' : 'footer'} />
		{/snippet}
	</RenderedSection>
{/if}

<style>
	.page-header-inline {
		margin-bottom: var(--space-lg);
	}
	.page-header-inline h1 {
		margin: 0 0 var(--space-md);
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
