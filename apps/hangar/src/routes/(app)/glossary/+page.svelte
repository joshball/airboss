<script lang="ts">
import {
	CERT_APPLICABILITY_LABELS,
	type CertApplicability,
	FLIGHT_RULES_LABELS,
	FLIGHT_RULES_VALUES,
	type FlightRules,
	KNOWLEDGE_KIND_LABELS,
	KNOWLEDGE_KIND_VALUES,
	type KnowledgeKind,
	QUERY_PARAMS,
	type ReferenceSourceType,
	ROUTES,
	SOURCE_TYPE_LABELS,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';
import Badge from '@ab/ui/components/Badge.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import FilterBar from '@ab/ui/components/FilterBar.svelte';
import FilterField from '@ab/ui/components/FilterField.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import Table from '@ab/ui/components/Table.svelte';
import { enhance } from '$app/forms';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

// Seed from server-rendered filters once, then URL <-> state syncs below.
// svelte-ignore state_referenced_locally
let searchValue = $state(data.filters.search);
// svelte-ignore state_referenced_locally
let sourceTypeValue = $state<ReferenceSourceType | ''>(data.filters.sourceType ?? '');
// svelte-ignore state_referenced_locally
let knowledgeKindValue = $state<KnowledgeKind | ''>(data.filters.knowledgeKind ?? '');
// svelte-ignore state_referenced_locally
let flightRulesValue = $state<FlightRules | ''>(data.filters.flightRules ?? '');
// svelte-ignore state_referenced_locally
let dirtyOnlyValue = $state(data.filters.dirtyOnly);
let syncing = $state(false);

function buildFilterUrl(): URL {
	const url = new URL(page.url);
	const params = url.searchParams;
	const setOrDelete = (key: string, value: string) => {
		if (value) params.set(key, value);
		else params.delete(key);
	};
	setOrDelete(QUERY_PARAMS.SEARCH, searchValue.trim());
	setOrDelete(QUERY_PARAMS.SOURCE, sourceTypeValue);
	setOrDelete('kind', knowledgeKindValue);
	setOrDelete('rules', flightRulesValue);
	if (dirtyOnlyValue) params.set('dirty', '1');
	else params.delete('dirty');
	// Reset to page 1 when filters change.
	params.delete(QUERY_PARAMS.PAGE);
	return url;
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
$effect(() => {
	// Track the state so the effect re-runs on change.
	const _deps = [searchValue, sourceTypeValue, knowledgeKindValue, flightRulesValue, dirtyOnlyValue];
	void _deps;
	if (typeof window === 'undefined') return;
	if (searchDebounce !== null) clearTimeout(searchDebounce);
	searchDebounce = setTimeout(() => {
		const url = buildFilterUrl();
		if (url.search === page.url.search) return;
		replaceState(url, page.state);
	}, 150);
	return () => {
		if (searchDebounce !== null) clearTimeout(searchDebounce);
	};
});

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

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<svelte:head>
	<title>Glossary -- hangar</title>
</svelte:head>

<section class="page">
	<PageHeader
		title="Glossary"
		subtitle={`${data.total} reference${data.total === 1 ? '' : 's'} in the registry.`}
	>
		{#snippet actions()}
			<Button variant="secondary" size="md" href={ROUTES.HANGAR_GLOSSARY_NEW}>New reference</Button>
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
		{/snippet}
	</PageHeader>

	{#if form?.error}
		<Banner tone="danger">{form.error}</Banner>
	{/if}

	<FilterBar ariaLabel="Filter references" columns="2fr 1fr 1fr 1fr auto">
		<FilterField id="ref-search" label="Search">
			<input
				id="ref-search"
				type="search"
				placeholder="id, term, or paraphrase"
				bind:value={searchValue}
				autocomplete="off"
			/>
		</FilterField>

		<FilterField id="ref-source-type" label="Source type">
			<select id="ref-source-type" bind:value={sourceTypeValue}>
				<option value="">All sources</option>
				{#each SOURCE_TYPE_VALUES as value (value)}
					<option {value}>{SOURCE_TYPE_LABELS[value]}</option>
				{/each}
			</select>
		</FilterField>

		<FilterField id="ref-kind" label="Kind">
			<select id="ref-kind" bind:value={knowledgeKindValue}>
				<option value="">All kinds</option>
				{#each KNOWLEDGE_KIND_VALUES as value (value)}
					<option {value}>{KNOWLEDGE_KIND_LABELS[value]}</option>
				{/each}
			</select>
		</FilterField>

		<FilterField id="ref-rules" label="Rules">
			<select id="ref-rules" bind:value={flightRulesValue}>
				<option value="">All</option>
				{#each FLIGHT_RULES_VALUES as value (value)}
					<option {value}>{FLIGHT_RULES_LABELS[value]}</option>
				{/each}
			</select>
		</FilterField>

		<label class="dirty-toggle">
			<input type="checkbox" bind:checked={dirtyOnlyValue} />
			<span>Dirty only</span>
		</label>
	</FilterBar>

	{#if data.references.length === 0}
		{#if data.filters.search || data.filters.sourceType || data.filters.knowledgeKind || data.filters.flightRules || data.filters.dirtyOnly}
			<EmptyState title="No matches" body="No references match the current filters." />
		{:else}
			<EmptyState title="No references yet">
				{#snippet bodySnippet()}
					<p>No references yet. <a href={ROUTES.HANGAR_GLOSSARY_NEW}>Add one</a>.</p>
				{/snippet}
			</EmptyState>
		{/if}
	{:else}
		<Table ariaLabel="References" stickyHeader>
			<thead>
				<tr>
					<th scope="col" class="col-id">ID</th>
					<th scope="col">Display name</th>
					<th scope="col">Source</th>
					<th scope="col">Kind</th>
					<th scope="col">Certs</th>
					<th scope="col">Updated</th>
					<th scope="col">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each data.references as ref (ref.id)}
					<tr>
						<td class="col-id mono">
							<a href={ROUTES.HANGAR_GLOSSARY_DETAIL(ref.id)}>{ref.id}</a>
						</td>
						<td>{ref.displayName}</td>
						<td>{ref.sourceType ? SOURCE_TYPE_LABELS[ref.sourceType] : '-'}</td>
						<td>{ref.knowledgeKind ? KNOWLEDGE_KIND_LABELS[ref.knowledgeKind] : '-'}</td>
						<td class="certs">
							{#if ref.certApplicability.length === 0}
								<span class="muted">-</span>
							{:else}
								{ref.certApplicability.map((c) => CERT_APPLICABILITY_LABELS[c as CertApplicability]).join(', ')}
							{/if}
						</td>
						<td class="mono">{formatDate(ref.updatedAt)}</td>
						<td>
							{#if ref.dirty}
								<Badge tone="warning" size="sm">Dirty</Badge>
							{:else}
								<Badge tone="success" size="sm">Clean</Badge>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</Table>

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

	.mono {
		font-family: var(--font-family-mono);
	}

	.col-id {
		width: 20%;
	}

	.col-id a {
		color: var(--link-default);
		text-decoration: none;
	}

	.col-id a:hover {
		text-decoration: underline;
	}

	.certs {
		color: var(--ink-muted);
	}

	.muted {
		color: var(--ink-faint);
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
