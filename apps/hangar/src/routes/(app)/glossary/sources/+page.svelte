<script lang="ts">
import { QUERY_PARAMS, type ReferenceSourceType, ROUTES, SOURCE_TYPE_LABELS, SOURCE_TYPE_VALUES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import { enhance } from '$app/forms';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

// svelte-ignore state_referenced_locally
let searchValue = $state(data.filters.search);
// svelte-ignore state_referenced_locally
let typeValue = $state<ReferenceSourceType | ''>(data.filters.type ?? '');
// svelte-ignore state_referenced_locally
let formatValue = $state(data.filters.format ?? '');
// svelte-ignore state_referenced_locally
let dirtyOnlyValue = $state(data.filters.dirtyOnly);
let syncing = $state(false);

let debounce: ReturnType<typeof setTimeout> | null = null;
$effect(() => {
	const _deps = [searchValue, typeValue, formatValue, dirtyOnlyValue];
	void _deps;
	if (typeof window === 'undefined') return;
	if (debounce !== null) clearTimeout(debounce);
	debounce = setTimeout(() => {
		const url = new URL(page.url);
		const params = url.searchParams;
		const setOrDelete = (key: string, value: string) => {
			if (value) params.set(key, value);
			else params.delete(key);
		};
		setOrDelete(QUERY_PARAMS.SEARCH, searchValue.trim());
		setOrDelete(QUERY_PARAMS.SOURCE, typeValue);
		setOrDelete('format', formatValue);
		if (dirtyOnlyValue) params.set('dirty', '1');
		else params.delete('dirty');
		params.delete(QUERY_PARAMS.PAGE);
		if (url.search === page.url.search) return;
		replaceState(url, page.state);
	}, 150);
	return () => {
		if (debounce !== null) clearTimeout(debounce);
	};
});

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function prevPageHref(): string {
	const url = new URL(page.url);
	const target = Math.max(1, data.page - 1);
	if (target === 1) url.searchParams.delete(QUERY_PARAMS.PAGE);
	else url.searchParams.set(QUERY_PARAMS.PAGE, String(target));
	return `${url.pathname}${url.search}`;
}

function nextPageHref(): string {
	const url = new URL(page.url);
	url.searchParams.set(QUERY_PARAMS.PAGE, String(Math.min(data.totalPages, data.page + 1)));
	return `${url.pathname}${url.search}`;
}
</script>

<svelte:head>
	<title>Sources -- hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Sources</h1>
			<p class="sub">{data.total} source{data.total === 1 ? '' : 's'} in the registry.</p>
		</div>
		<div class="actions">
			<a class="btn secondary" href={ROUTES.HANGAR_GLOSSARY_SOURCES_NEW}>New source</a>
			<form method="POST" action="?/syncAll" use:enhance={() => {
				syncing = true;
				return async ({ update }) => {
					syncing = false;
					await update();
				};
			}}>
				<Button
					type="submit"
					variant="primary"
					size="md"
					disabled={data.dirtyCount === 0}
					loading={syncing}
					loadingLabel="Queueing..."
				>
					Sync all pending{data.dirtyCount > 0 ? ` (${data.dirtyCount})` : ''}
				</Button>
			</form>
		</div>
	</header>

	{#if form?.error}
		<Banner tone="danger">{form.error}</Banner>
	{/if}

	<section class="filter-bar" aria-label="Filter sources">
		<div class="field">
			<label for="src-search">Search</label>
			<input id="src-search" type="search" bind:value={searchValue} placeholder="id, title, or url" autocomplete="off" />
		</div>

		<div class="field">
			<label for="src-filter-type">Type</label>
			<select id="src-filter-type" bind:value={typeValue}>
				<option value="">All types</option>
				{#each SOURCE_TYPE_VALUES as value (value)}
					<option {value}>{SOURCE_TYPE_LABELS[value]}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="src-filter-format">Format</label>
			<select id="src-filter-format" bind:value={formatValue}>
				<option value="">All formats</option>
				<option value="xml">xml</option>
				<option value="pdf">pdf</option>
				<option value="html">html</option>
				<option value="txt">txt</option>
				<option value="json">json</option>
				<option value="csv">csv</option>
			</select>
		</div>

		<label class="dirty-toggle">
			<input type="checkbox" bind:checked={dirtyOnlyValue} />
			<span>Dirty only</span>
		</label>
	</section>

	{#if data.sources.length === 0}
		<p class="empty">
			{#if data.filters.search || data.filters.type || data.filters.format || data.filters.dirtyOnly}
				No sources match the current filters.
			{:else}
				No sources yet. <a href={ROUTES.HANGAR_GLOSSARY_SOURCES_NEW}>Add one</a>.
			{/if}
		</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col" class="col-id">ID</th>
						<th scope="col">Title</th>
						<th scope="col">Type</th>
						<th scope="col">Version</th>
						<th scope="col">Format</th>
						<th scope="col">Updated</th>
						<th scope="col">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.sources as src (src.id)}
						<tr>
							<td class="col-id mono">
								<a href={ROUTES.HANGAR_GLOSSARY_SOURCES_DETAIL(src.id)}>{src.id}</a>
							</td>
							<td>{src.title}</td>
							<td>{SOURCE_TYPE_LABELS[src.type as ReferenceSourceType] ?? src.type}</td>
							<td class="mono">{src.version}</td>
							<td class="mono">{src.format}</td>
							<td class="mono">{formatDate(src.updatedAt)}</td>
							<td>
								{#if src.dirty}
									<span class="badge dirty">Dirty</span>
								{:else}
									<span class="badge clean">Clean</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.totalPages > 1}
			<nav class="pagination" aria-label="Pagination">
				<a
					href={prevPageHref()}
					aria-disabled={data.page <= 1}
					class:disabled={data.page <= 1}
					tabindex={data.page <= 1 ? -1 : 0}
				>
					Previous
				</a>
				<span class="page-status">Page {data.page} of {data.totalPages}</span>
				<a
					href={nextPageHref()}
					aria-disabled={data.page >= data.totalPages}
					class:disabled={data.page >= data.totalPages}
					tabindex={data.page >= data.totalPages ? -1 : 0}
				>
					Next
				</a>
			</nav>
		{/if}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		align-items: center;
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: var(--font-weight-semibold);
		border-radius: var(--radius-md);
		text-decoration: none;
		border: 1px solid transparent;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-default);
	}

	.btn.secondary:hover {
		background: var(--edge-default);
	}

	.filter-bar {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr auto;
		gap: var(--space-md);
		align-items: end;
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	@media (max-width: 700px) {
		.filter-bar {
			grid-template-columns: 1fr 1fr;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.field label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.field input,
	.field select {
		background: var(--input-default-bg);
		color: var(--input-default-ink);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		font: inherit;
	}

	.field input:focus-visible,
	.field select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--input-default-hover-border);
	}

	.dirty-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		cursor: pointer;
		padding-bottom: var(--space-xs);
	}

	.dirty-toggle input {
		accent-color: var(--action-default);
	}

	.empty {
		color: var(--ink-muted);
		font-style: italic;
		padding: var(--space-xl);
		text-align: center;
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.empty a {
		color: var(--link-default);
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	th,
	td {
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		border-bottom: 1px solid var(--table-row-edge);
		color: var(--ink-body);
		vertical-align: top;
	}

	th {
		background: var(--table-header-bg);
		color: var(--table-header-ink);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
	}

	tr:hover {
		background: var(--table-row-bg-hover);
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.col-id {
		width: 18%;
	}

	.col-id a {
		color: var(--link-default);
		text-decoration: none;
	}

	.col-id a:hover {
		text-decoration: underline;
	}

	.badge {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
	}

	.badge.dirty {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}

	.badge.clean {
		background: var(--signal-success-wash);
		color: var(--signal-success);
	}

	.pagination {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
	}

	.pagination a {
		color: var(--link-default);
		text-decoration: none;
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-label-size);
	}

	.pagination a:hover {
		background: var(--surface-sunken);
	}

	.pagination a.disabled {
		color: var(--disabled-ink);
		pointer-events: none;
	}

	.page-status {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}
</style>
