<script lang="ts">
import { ROUTES } from '@ab/constants';
import HandbookChapterListItem from '@ab/ui/handbooks/HandbookChapterListItem.svelte';
import HandbookEditionBadge from '@ab/ui/handbooks/HandbookEditionBadge.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title} -- airboss</title>
</svelte:head>

<header class="page-header">
	<nav aria-label="Breadcrumb">
		<a href={ROUTES.HANDBOOKS}>Handbooks</a> &raquo; <span>{data.reference.title}</span>
	</nav>
	<h1>
		{data.reference.title}
		<HandbookEditionBadge edition={data.reference.edition} />
	</h1>
	<p class="counts">
		{data.progress.readSections} read &middot; {data.progress.readingSections} reading &middot;
		{data.progress.unreadSections} unread of {data.progress.totalSections} sections
	</p>
</header>

{#if data.reference.supersededByEdition}
	<div class="banner" role="alert">
		<strong>Newer edition available.</strong>
		You're reading {data.reference.edition}; the latest is
		<a href={ROUTES.HANDBOOK(data.reference.documentSlug)}>{data.reference.supersededByEdition}</a>.
	</div>
{/if}

{#if data.chapters.length === 0}
	<p class="empty">No chapters ingested yet for this edition.</p>
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
	.page-header {
		margin-bottom: var(--space-lg);
	}
	.page-header nav {
		color: var(--ink-muted);
		margin-bottom: var(--space-xs);
	}
	.page-header nav a {
		color: inherit;
	}
	.page-header h1 {
		margin: 0 0 var(--space-xs) 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}
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
	.empty {
		color: var(--ink-muted);
	}
</style>
