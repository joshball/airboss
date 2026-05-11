<script lang="ts">
import { ROUTES } from '@ab/constants';
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import SubjectChip from '@ab/library/SubjectChip.svelte';
import TOCRender, { type TOCRenderEntry } from '@ab/library/TOCRender.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const readSet = $derived(new Set(data.readSectionIds));

// Build the overview entries from the layout-loaded reading order. Mark
// the resume section as `isLastRead` so its parent ChapterTile gets the
// "Continue here" affordance.
const overviewEntries = $derived.by<TOCRenderEntry[]>(() => {
	const entries: TOCRenderEntry[] = [];
	for (const entry of data.readingOrder) {
		const href = (() => {
			if (entry.parentId === null) {
				return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(data.handbook.documentSlug, data.handbook.shortEdition, entry.code);
			}
			const parts = entry.code.split('.');
			if (parts.length !== 2) return null;
			const [ch, sec] = parts;
			if (!ch || !sec) return null;
			return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(data.handbook.documentSlug, data.handbook.shortEdition, ch, sec);
		})();
		entries.push({
			sectionId: entry.sectionId,
			code: entry.code,
			title: entry.title,
			depth: entry.depth,
			href,
			minutesToRead: Math.max(1, Math.round(entry.wordCount / 250)),
			isActive: false,
			isLastRead: data.resume?.sectionId === entry.sectionId,
		});
	}
	return entries;
});

const hasChapters = $derived(overviewEntries.some((e) => e.depth === 0));

function formatLastReadAt(isoStamp: string): string {
	const date = new Date(isoStamp);
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
</script>

<svelte:head>
	<title>{data.handbook.title} -- Flightbag</title>
</svelte:head>

<div class="landing">
	<header class="title-block">
		<h1>{data.handbook.title}</h1>
		<p class="meta">
			<span class="edition">{data.handbook.edition}</span>
			<span class="publisher">{data.handbook.publisher}</span>
		</p>
		{#if data.handbook.subjects.length > 0}
			<p class="subjects">
				{#each data.handbook.subjects as subject (subject)}
					<SubjectChip {subject} />
				{/each}
			</p>
		{/if}
	</header>

	{#if data.resume}
		<aside class="resume" aria-label="Resume reading">
			<a href={data.resume.href}>
				<span class="resume-eyebrow">Resume reading</span>
				<span class="resume-target">§{data.resume.code} -- {data.resume.title}</span>
				<span class="resume-meta">last read {formatLastReadAt(data.resume.lastReadAt)}</span>
			</a>
		</aside>
	{/if}

	{#if hasChapters}
		<TOCRender
			mode="overview"
			entries={overviewEntries}
			{readSet}
			heading="Chapters"
			summary={`${overviewEntries.filter((e) => e.depth === 0).length} chapters · ${overviewEntries.length} entries`}
		/>
	{:else}
		<ReaderEmptyState
			kind="no-children"
			localPdfHref={data.sourceLinks.localPdfHref}
			externalUrl={data.sourceLinks.onlineUrl}
			heading="This handbook has no chapter rows in the catalog yet."
			note="Read the official FAA PDF below until ingestion finishes."
		/>
	{/if}
</div>

<style>
	.landing {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
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
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.resume {
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge, var(--action-default));
		border-radius: var(--radius-md);
		padding: 0;
	}

	.resume a {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		padding: var(--space-md) var(--space-lg);
		text-decoration: none;
		color: inherit;
	}

	.resume a:hover,
	.resume a:focus-visible {
		background: var(--surface-panel);
	}

	.resume-eyebrow {
		font-family: var(--font-family-mono);
		text-transform: uppercase;
		font-size: var(--font-size-xs);
		letter-spacing: var(--letter-spacing-wide);
		color: var(--action-default-hover);
	}

	.resume-target {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-medium);
		color: var(--ink-strong);
	}

	.resume-meta {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
</style>
