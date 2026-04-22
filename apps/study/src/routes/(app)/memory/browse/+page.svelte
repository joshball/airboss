<script lang="ts">
import {
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	CARD_TYPE_LABELS,
	CARD_TYPE_VALUES,
	CONTENT_SOURCE_VALUES,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import { buildQuery } from '@ab/utils';
import { tick } from 'svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const cards = $derived(data.cards);
const filters = $derived(data.filters);
const currentPage = $derived(data.page);
const hasMore = $derived(data.hasMore);
const total = $derived(data.total);
const totalPages = $derived(data.totalPages);
const pageSize = $derived(data.pageSize);
const createdCard = $derived(data.createdCard);

// Range "Showing 21-40 of 137" -- computed client-side so the list and pager
// agree even if `total` and `cards.length` drift (e.g., a concurrent delete).
const rangeStart = $derived(cards.length === 0 ? 0 : (currentPage - 1) * pageSize + 1);
const rangeEnd = $derived(cards.length === 0 ? 0 : (currentPage - 1) * pageSize + cards.length);

// True when no filters are active -- a blank deck vs over-filtered.
const hasActiveFilters = $derived(
	Boolean(filters.domain || filters.cardType || filters.sourceType || filters.search) ||
		filters.status !== CARD_STATUSES.ACTIVE,
);

// Success banner + row highlight when redirected from a create.
let bannerDismissed = $state(false);
const bannerVisible = $derived(createdCard !== null && !bannerDismissed);

$effect(() => {
	const current = createdCard;
	if (!current) return;
	void tick().then(() => {
		const el = document.getElementById(`card-${current.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
});

type ChipFilterKey =
	| typeof QUERY_PARAMS.DOMAIN
	| typeof QUERY_PARAMS.CARD_TYPE
	| typeof QUERY_PARAMS.SOURCE
	| typeof QUERY_PARAMS.STATUS
	| typeof QUERY_PARAMS.SEARCH;

interface FilterChip {
	key: ChipFilterKey;
	label: string;
	value: string;
}

function shortenFront(text: string, max = 60): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max).trimEnd()}...`;
}

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function cardTypeLabel(slug: string): string {
	return (CARD_TYPE_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function shorten(text: string, max = 120): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max).trimEnd()}...`;
}

const chips = $derived.by<FilterChip[]>(() => {
	const out: FilterChip[] = [];
	if (filters.search)
		out.push({ key: QUERY_PARAMS.SEARCH, label: 'Search', value: `"${shortenFront(filters.search, 40)}"` });
	if (filters.domain) out.push({ key: QUERY_PARAMS.DOMAIN, label: 'Domain', value: domainLabel(filters.domain) });
	if (filters.cardType)
		out.push({ key: QUERY_PARAMS.CARD_TYPE, label: 'Type', value: cardTypeLabel(filters.cardType) });
	if (filters.sourceType) out.push({ key: QUERY_PARAMS.SOURCE, label: 'Source', value: humanize(filters.sourceType) });
	if (filters.status !== CARD_STATUSES.ACTIVE)
		out.push({ key: QUERY_PARAMS.STATUS, label: 'Status', value: humanize(filters.status) });
	return out;
});

function removeChipHref(key: ChipFilterKey): string {
	return buildHref({ [key]: undefined });
}

function buildHref(next: Record<string, string | undefined>): string {
	const full: Record<string, string | number | null | undefined> = {
		[QUERY_PARAMS.DOMAIN]: filters.domain,
		[QUERY_PARAMS.CARD_TYPE]: filters.cardType,
		[QUERY_PARAMS.SOURCE]: filters.sourceType,
		[QUERY_PARAMS.STATUS]: filters.status === CARD_STATUSES.ACTIVE ? undefined : filters.status,
		[QUERY_PARAMS.SEARCH]: filters.search || undefined,
		...next,
	};
	return `${ROUTES.MEMORY_BROWSE}${buildQuery(full)}`;
}

function pageHref(n: number): string {
	return buildHref({ [QUERY_PARAMS.PAGE]: n > 1 ? String(n) : undefined });
}
</script>

<svelte:head>
	<title>Browse cards -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Browse</h1>
			<p class="sub">Your deck of memory items. Filter, search, or click a card to edit.</p>
		</div>
		<a class="btn primary" href={ROUTES.MEMORY_NEW}>New card</a>
	</header>

	{#if bannerVisible && createdCard}
		<div class="banner" role="status">
			<span>
				Card saved.
				<a class="banner-link" href={ROUTES.MEMORY_CARD(createdCard.id)}>View &ldquo;{shortenFront(createdCard.front)}&rdquo;</a>
			</span>
			<button type="button" class="banner-dismiss" onclick={() => (bannerDismissed = true)} aria-label="Dismiss">
				×
			</button>
		</div>
	{/if}

	<form class="filters" method="GET" role="search" aria-label="Filter cards">
		<input type="hidden" name={QUERY_PARAMS.PAGE} value="1" />
		<div class="filter">
			<label for="f-q">Search</label>
			<input
				id="f-q"
				type="search"
				name={QUERY_PARAMS.SEARCH}
				placeholder="front or back..."
				value={filters.search ?? ''}
			/>
		</div>
		<div class="filter">
			<label for="f-domain">Domain</label>
			<select id="f-domain" name={QUERY_PARAMS.DOMAIN} value={filters.domain ?? ''}>
				<option value="">All</option>
				{#each DOMAIN_VALUES as d (d)}
					<option value={d}>{domainLabel(d)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-type">Type</label>
			<select id="f-type" name={QUERY_PARAMS.CARD_TYPE} value={filters.cardType ?? ''}>
				<option value="">All</option>
				{#each CARD_TYPE_VALUES as t (t)}
					<option value={t}>{cardTypeLabel(t)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-source">Source</label>
			<select id="f-source" name={QUERY_PARAMS.SOURCE} value={filters.sourceType ?? ''}>
				<option value="">All</option>
				{#each CONTENT_SOURCE_VALUES as s (s)}
					<option value={s}>{humanize(s)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-status">Status</label>
			<select id="f-status" name={QUERY_PARAMS.STATUS} value={filters.status ?? CARD_STATUSES.ACTIVE}>
				{#each CARD_STATUS_VALUES as s (s)}
					<option value={s}>{humanize(s)}</option>
				{/each}
			</select>
		</div>
		<div class="filter-actions">
			<button type="submit" class="btn secondary">Apply</button>
			<a class="btn ghost" href={ROUTES.MEMORY_BROWSE}>Reset</a>
		</div>
	</form>

	{#if chips.length > 0}
		<div class="chip-row" aria-label="Active filters">
			<span class="chip-label">Filtering:</span>
			{#each chips as chip (chip.key)}
				<a class="chip" href={removeChipHref(chip.key)} aria-label={`Remove ${chip.label} filter`}>
					<span class="chip-name">{chip.label}:</span>
					<span class="chip-value">{chip.value}</span>
					<span class="chip-x" aria-hidden="true">×</span>
				</a>
			{/each}
			<a class="chip-clear" href={ROUTES.MEMORY_BROWSE}>Clear all</a>
		</div>
	{/if}

	{#if total > 0}
		<p class="result-summary">
			{#if total > pageSize}
				Showing {rangeStart}&ndash;{rangeEnd} of {total} card{total === 1 ? '' : 's'}{hasActiveFilters
					? ' matching your filters'
					: ''}.
			{:else}
				Showing {total} card{total === 1 ? '' : 's'}{hasActiveFilters ? ' matching your filters' : ''}.
			{/if}
		</p>
	{/if}

	{#if cards.length === 0}
		<div class="empty">
			{#if hasActiveFilters}
				<p>No cards match these filters.</p>
				<a class="btn ghost" href={ROUTES.MEMORY_BROWSE}>Clear filters</a>
			{:else}
				<p>Your deck is empty. Capture your first card while you study.</p>
				<a class="btn primary" href={ROUTES.MEMORY_NEW}>Create your first card</a>
			{/if}
		</div>
	{:else}
		<ul class="list">
			{#each cards as c (c.id)}
				<li id={`card-${c.id}`} class="card" class:just-created={createdCard?.id === c.id}>
					<a class="card-link" href={ROUTES.MEMORY_CARD(c.id)}>
						<div class="card-front">{shorten(c.front)}</div>
						<div class="card-meta">
							<span class="badge domain">{domainLabel(c.domain)}</span>
							<span class="badge type">{cardTypeLabel(c.cardType)}</span>
							{#if c.status !== CARD_STATUSES.ACTIVE}
								<span class="badge status-{c.status}">{humanize(c.status)}</span>
							{/if}
							{#if c.sourceType !== 'personal'}
								<span class="badge source">{humanize(c.sourceType)}</span>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>

		<nav class="pager" aria-label="Pagination">
			{#if currentPage > 1}
				<a class="btn ghost" href={pageHref(currentPage - 1)}>Previous</a>
			{:else}
				<span></span>
			{/if}
			<span class="page-num">Page {currentPage} of {totalPages}</span>
			{#if hasMore}
				<a class="btn ghost" href={pageHref(currentPage + 1)}>Next</a>
			{:else}
				<span></span>
			{/if}
		</nav>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-body);
	}

	.filters {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto;
		gap: 0.75rem;
		align-items: end;
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: 1rem;
	}

	.filter {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter label {
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		color: var(--ab-color-fg-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.filter input,
	.filter select {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-sm);
		background: white;
		color: var(--ab-color-fg);
	}

	.filter input:focus,
	.filter select:focus {
		outline: none;
		border-color: var(--ab-color-primary);
		box-shadow: var(--ab-shadow-focus-ring);
	}

	.filter-actions {
		display: flex;
		gap: 0.375rem;
	}

	.banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--ab-color-primary-subtle);
		border: 1px solid var(--ab-color-primary-subtle-border);
		color: var(--ab-color-primary-active);
		padding: 0.625rem 0.875rem;
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
	}

	.banner-link {
		color: var(--ab-color-primary-hover);
		font-weight: 600;
		text-decoration: none;
		margin-left: 0.25rem;
	}

	.banner-link:hover {
		text-decoration: underline;
	}

	.banner-dismiss {
		margin-left: auto;
		background: transparent;
		border: none;
		color: var(--ab-color-primary-active);
		font-size: var(--ab-font-size-2xl);
		line-height: 1;
		cursor: pointer;
		padding: 0 0.25rem;
	}

	.banner-dismiss:hover {
		color: var(--ab-color-primary-hover);
	}

	.chip-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0 0.125rem;
	}

	.chip-label {
		font-size: var(--ab-font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ab-color-fg-subtle);
		font-weight: 600;
		margin-right: 0.25rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem;
		background: var(--ab-color-primary-subtle);
		border: 1px solid var(--ab-color-primary-subtle-border);
		border-radius: var(--ab-radius-pill);
		color: var(--ab-color-primary-hover);
		font-size: var(--ab-font-size-sm);
		text-decoration: none;
		transition: background 120ms, border-color 120ms;
	}

	.chip:hover {
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.chip:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.chip-name {
		color: var(--ab-color-primary-active);
		font-weight: 600;
	}

	.chip-value {
		color: var(--ab-color-fg);
	}

	.chip-x {
		color: var(--ab-color-primary);
		font-size: var(--ab-font-size-base);
		line-height: 1;
	}

	.chip-clear {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-muted);
		text-decoration: underline;
		margin-left: 0.25rem;
	}

	.chip-clear:hover {
		color: var(--ab-color-fg);
	}

	.result-summary {
		margin: 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-sm);
	}

	.card.just-created {
		border-color: var(--ab-color-success-subtle-border);
		box-shadow: var(--ab-shadow-success-glow);
	}

	.empty {
		background: white;
		border: 1px dashed var(--ab-color-border-strong);
		border-radius: var(--ab-radius-lg);
		padding: 3rem 1.5rem;
		text-align: center;
		color: var(--ab-color-fg-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		transition: border-color 120ms, box-shadow 120ms;
	}

	.card:hover {
		border-color: var(--ab-color-primary-subtle-border);
		box-shadow: var(--ab-shadow-sm);
	}

	.card-link {
		display: block;
		padding: 0.875rem 1rem;
		text-decoration: none;
		color: inherit;
	}

	.card-front {
		color: var(--ab-color-fg);
		font-size: var(--ab-font-size-body);
		line-height: 1.4;
	}

	.card-meta {
		margin-top: 0.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		border-radius: var(--ab-radius-pill);
		border: 1px solid var(--ab-color-border);
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.domain {
		color: var(--ab-color-primary-hover);
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.badge.status-suspended {
		color: var(--ab-color-warning-active);
		background: var(--ab-color-warning-subtle);
		border-color: var(--ab-color-warning-subtle-border);
	}

	.badge.status-archived {
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface-sunken);
		border-color: var(--ab-color-border);
	}

	.badge.source {
		color: var(--ab-color-accent-fg);
		background: var(--ab-color-accent-subtle);
		border-color: var(--ab-color-accent-subtle-border);
	}

	.pager {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.pager > :first-child {
		justify-self: start;
	}

	.pager > :last-child {
		justify-self: end;
	}

	.page-num {
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-sm);
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover {
		background: var(--ab-color-primary-hover);
	}

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.secondary:hover {
		background: var(--ab-color-border);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
		border-color: transparent;
	}

	.btn.ghost:hover {
		background: var(--ab-color-surface-sunken);
	}

	@media (max-width: 640px) {
		.filters {
			grid-template-columns: 1fr 1fr;
		}

		.filter-actions {
			grid-column: 1 / -1;
			justify-content: flex-end;
		}
	}
</style>
