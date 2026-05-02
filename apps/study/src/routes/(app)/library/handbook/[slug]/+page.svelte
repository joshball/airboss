<script lang="ts">
import HandbookChapterListItem from '@ab/aviation/ui/handbooks/HandbookChapterListItem.svelte';
import HandbookEditionBadge from '@ab/aviation/ui/handbooks/HandbookEditionBadge.svelte';
import { ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title} -- airboss</title>
</svelte:head>

<PageHeader title={data.reference.title}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo; <span>{data.reference.title}</span>
		</nav>
	{/snippet}
	{#snippet titleSuffix()}
		<HandbookEditionBadge edition={data.reference.edition} />
	{/snippet}
	{#snippet subtitleSnippet()}
		<p class="counts">
			{data.progress.readSections} read &middot; {data.progress.readingSections} reading &middot;
			{data.progress.unreadSections} unread of {data.progress.totalSections} sections
		</p>
	{/snippet}
</PageHeader>

{#if data.reference.supersededByEdition}
	<div class="banner" role="alert">
		<strong>Newer edition available.</strong>
		You're reading {data.reference.edition}; the latest is
		<a href={ROUTES.LIBRARY_HANDBOOK(data.reference.documentSlug)}>{data.reference.supersededByEdition}</a>.
	</div>
{/if}

{#if data.chapters.length === 0}
	<EmptyState title="No chapters yet" body="No chapters ingested yet for this edition." />
{:else}
	<ul class="chapter-list">
		{#each data.chapters as chapter (chapter.id)}
			<li>
				<HandbookChapterListItem
					documentSlug={data.reference.documentSlug}
					code={chapter.code}
					title={chapter.title}
					faaPageStart={chapter.faaPageStart}
					faaPageEnd={chapter.faaPageEnd}
				/>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.counts {
		margin: 0;
		color: var(--ink-muted);
	}
	.banner {
		margin-bottom: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--signal-info-wash);
		border-left: var(--space-2xs) solid var(--signal-info-edge);
		border-radius: var(--radius-md);
	}
	.chapter-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
</style>
