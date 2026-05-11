<script lang="ts">
import {
	NAV_LABELS,
	NOTES_VIEW_LABELS,
	NOTES_VIEW_VALUES,
	NOTES_VIEWS,
	type NotesView,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import NotesList from '@ab/ui/components/notes/NotesList.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const tabHrefs = $derived<Record<NotesView, string>>({
	[NOTES_VIEWS.ALL]: ROUTES.NOTES,
	[NOTES_VIEWS.FOLLOW_UPS]: ROUTES.NOTES_FILTER(NOTES_VIEWS.FOLLOW_UPS),
	[NOTES_VIEWS.ARCHIVED]: ROUTES.NOTES_FILTER(NOTES_VIEWS.ARCHIVED),
	[NOTES_VIEWS.BY_CONTEXT]: ROUTES.NOTES_FILTER(NOTES_VIEWS.BY_CONTEXT),
});

let savedSearchName = $state('');
let tagCloudOpen = $state(false);

const baseSearchUrl = $derived(page.url.pathname + page.url.search);

const maxCount = $derived(data.tagCloud.reduce((m, t) => Math.max(m, t.count), 0));

function tagSize(count: number): number {
	if (maxCount <= 1) return 1;
	const ratio = count / maxCount;
	// Tag-cloud sizing: linear interpolation between 0.85rem and 1.5rem.
	return 0.85 + ratio * 0.65;
}

function tagFilterHref(tag: string): string {
	const params = new URLSearchParams(page.url.search);
	params.delete('tag');
	params.append('tag', tag);
	params.delete('cursor');
	return `${page.url.pathname}?${params.toString()}`;
}

function removeTagHref(tag: string): string {
	const params = new URLSearchParams(page.url.search);
	const remaining = params.getAll('tag').filter((t) => t !== tag);
	params.delete('tag');
	for (const t of remaining) params.append('tag', t);
	params.delete('cursor');
	const search = params.toString();
	return `${page.url.pathname}${search ? `?${search}` : ''}`;
}

function loadMoreHref(cursor: string | null): string | null {
	if (cursor === null) return null;
	const params = new URLSearchParams(page.url.search);
	params.set('cursor', cursor);
	return `${page.url.pathname}?${params.toString()}`;
}

const followUpMonths = $derived(data.followUpMonths ?? []);
</script>

<svelte:head>
	<title>{NAV_LABELS.NOTES} -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title={NAV_LABELS.NOTES} subtitle="Markdown thoughts attached to context. Soft-archive; never lost.">
		{#snippet actions()}
			<Button href={ROUTES.NOTES_NEW} variant="primary">+ Note</Button>
		{/snippet}
	</PageHeader>

	<div class="layout">
		<aside class="sidebar" aria-label="Saved searches">
			<h2 class="sidebar-h">Saved searches</h2>
			{#if data.savedSearches.length === 0}
				<p class="sidebar-empty">Save a filtered view to replay it from here.</p>
			{:else}
				<ul class="saved-list">
					{#each data.savedSearches as entry (entry.name)}
						<li class="saved-row">
							<a class="saved-link" href={entry.url}>{entry.name}</a>
							<form method="POST" action="{ROUTES.NOTES}/saved-searches?/remove">
								<input type="hidden" name="name" value={entry.name} />
								<button type="submit" class="saved-remove" aria-label={`Remove saved search ${entry.name}`}>
									×
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<form
				method="POST"
				action="{ROUTES.NOTES}/saved-searches?/save"
				class="saved-form"
				data-testid="notes-save-search-form"
			>
				<label class="saved-label">
					<span>Save current view</span>
					<input
						type="text"
						name="name"
						bind:value={savedSearchName}
						maxlength="120"
						placeholder="Name this view"
						required
					/>
				</label>
				<input type="hidden" name="url" value={baseSearchUrl} />
				<button type="submit" class="saved-save">Save</button>
			</form>
		</aside>

		<div class="main">
			<nav class="tabs" aria-label="Notes views">
				{#each NOTES_VIEW_VALUES as v (v)}
					<a class="tab" href={tabHrefs[v]} aria-current={data.view === v ? 'page' : undefined}>
						{NOTES_VIEW_LABELS[v]}
					</a>
				{/each}
			</nav>

			<form method="GET" action={ROUTES.NOTES} class="search">
				<input type="hidden" name={QUERY_PARAMS.VIEW} value={data.view} />
				<label class="search-field">
					<span class="visually-hidden">Search notes</span>
					<input
						type="search"
						name="q"
						value={data.q}
						placeholder="Search body, title, excerpt, or tags"
						data-testid="notes-search-input"
					/>
				</label>
				<button type="submit" class="search-btn">Search</button>
			</form>

			{#if data.tagCloud.length > 0}
				<details class="tag-cloud-wrap" bind:open={tagCloudOpen} data-testid="notes-tag-cloud">
					<summary class="tag-cloud-summary">
						Tag cloud ({data.tagCloud.length})
					</summary>
					<div class="tag-cloud">
						{#each data.tagCloud as t (t.tag)}
							<a
								class="cloud-tag"
								href={tagFilterHref(t.tag)}
								style:font-size="{tagSize(t.count)}rem"
								title={`${t.tag} (${t.count})`}
							>
								#{t.tag}
							</a>
						{/each}
					</div>
				</details>
			{/if}

			{#if data.tagFilters.length > 0}
				<div class="active-filters" aria-label="Active filters">
					<span class="filter-heading">Filtering:</span>
					{#each data.tagFilters as tag (tag)}
						<a class="filter-chip" href={removeTagHref(tag)}>
							<span class="chip-label">tag</span>
							<span class="chip-value">#{tag}</span>
							<span class="chip-x" aria-hidden="true">×</span>
						</a>
					{/each}
				</div>
			{/if}

			{#if data.view === NOTES_VIEWS.FOLLOW_UPS}
				{#if followUpMonths.length === 0}
					<div class="empty">
						<h3>No open follow-ups</h3>
						<p>Capture a thought with a follow-up to see it here.</p>
					</div>
				{:else}
					{#each followUpMonths as group (group.key)}
						<section class="month-group" aria-labelledby={`month-${group.key}`}>
							<header class="month-head">
								<h3 id={`month-${group.key}`}>{group.label}</h3>
								<form method="POST" action="{ROUTES.NOTES}/follow-ups?/mark-month-done" class="bulk-form">
									<input type="hidden" name="month" value={group.key} />
									<button type="submit" class="bulk-btn" data-testid={`notes-mark-month-done-${group.key}`}>
										Mark all in {group.label} done
									</button>
								</form>
							</header>
							<NotesList notes={group.notes} />
						</section>
					{/each}
				{/if}
			{:else}
				<NotesList
					notes={data.notes}
					loadMoreHref={loadMoreHref(data.nextCursor)}
					emptyTitle={data.q.length > 0 ? 'No matches' : 'No notes yet'}
					emptyBody={data.q.length > 0 ? 'Try a different query.' : 'Create your first note to capture a thought.'}
				/>
			{/if}
		</div>
	</div>
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
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 16rem) minmax(0, 1fr);
		gap: var(--space-lg);
	}
	@media (max-width: 56rem) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--surface-panel, var(--surface-raised));
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}
	.sidebar-h {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.sidebar-empty {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
	}
	.saved-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.saved-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2xs);
	}
	.saved-link {
		flex: 1;
		color: var(--action-default);
		text-decoration: none;
		font-size: var(--font-size-sm);
	}
	.saved-link:hover {
		text-decoration: underline;
	}
	.saved-remove {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		font-size: var(--font-size-base);
		line-height: 1;
		cursor: pointer;
		padding: var(--space-3xs);
	}
	.saved-remove:hover {
		color: var(--ink-body);
	}
	.saved-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		margin-top: var(--space-sm);
	}
	.saved-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
	}
	.saved-label input {
		font: inherit;
		padding: var(--space-2xs);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
	}
	.saved-save {
		background: var(--action-default);
		color: var(--ink-inverse);
		border: none;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		font: inherit;
		cursor: pointer;
	}
	.main {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		min-width: 0;
	}
	.tabs {
		display: flex;
		gap: var(--space-md);
		border-bottom: 1px solid var(--edge-default);
	}
	.tab {
		padding: var(--space-sm) 0;
		color: var(--ink-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}
	.tab[aria-current='page'] {
		color: var(--ink-body);
		border-color: var(--action-default);
	}
	.search {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}
	.search-field {
		flex: 1;
	}
	.search-field input {
		font: inherit;
		width: 100%;
		padding: var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
	}
	.search-btn {
		font: inherit;
		padding: var(--space-sm) var(--space-lg);
		background: var(--action-default);
		color: var(--ink-inverse);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	.tag-cloud-wrap {
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
	}
	.tag-cloud-summary {
		cursor: pointer;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
	.tag-cloud {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs) var(--space-sm);
		padding: var(--space-sm) 0;
	}
	.cloud-tag {
		color: var(--action-default);
		text-decoration: none;
	}
	.cloud-tag:hover {
		text-decoration: underline;
	}
	.active-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-sm) 0;
	}
	.filter-heading {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-3xs) var(--space-xs);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill, 999px);
		text-decoration: none;
		color: var(--ink-body);
		font-size: var(--font-size-xs);
	}
	.chip-label {
		color: var(--ink-muted);
	}
	.chip-x {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-2xl) var(--space-md);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		color: var(--ink-muted);
	}
	.empty h3 {
		margin: 0;
		color: var(--ink-strong);
	}
	.month-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding-bottom: var(--space-md);
	}
	.month-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-md);
		flex-wrap: wrap;
	}
	.month-head h3 {
		margin: 0;
		font-size: var(--font-size-base);
		color: var(--ink-strong);
	}
	.bulk-form {
		display: contents;
	}
	.bulk-btn {
		font: inherit;
		font-size: var(--font-size-xs);
		padding: var(--space-2xs) var(--space-sm);
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		color: var(--ink-muted);
		cursor: pointer;
	}
	.bulk-btn:hover {
		border-color: var(--action-default);
		color: var(--ink-body);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
