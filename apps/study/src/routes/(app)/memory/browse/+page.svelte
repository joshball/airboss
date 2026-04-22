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
const createdCard = $derived(data.createdCard);

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

	{#if hasActiveFilters && cards.length > 0}
		<p class="result-summary">
			Showing {cards.length} card{cards.length === 1 ? '' : 's'}{hasMore ? '+' : ''} matching your filters.
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
			<span class="page-num">Page {currentPage}</span>
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
		font-size: 1.5rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}

	.filters {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto;
		gap: 0.75rem;
		align-items: end;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem;
	}

	.filter {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.filter input,
	.filter select {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		background: white;
		color: #0f172a;
	}

	.filter input:focus,
	.filter select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	.filter-actions {
		display: flex;
		gap: 0.375rem;
	}

	.banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		color: #1e3a8a;
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.banner-link {
		color: #1d4ed8;
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
		color: #1e3a8a;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.25rem;
	}

	.banner-dismiss:hover {
		color: #1d4ed8;
	}

	.chip-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0 0.125rem;
	}

	.chip-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
		font-weight: 600;
		margin-right: 0.25rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 999px;
		color: #1d4ed8;
		font-size: 0.8125rem;
		text-decoration: none;
		transition: background 120ms, border-color 120ms;
	}

	.chip:hover {
		background: #dbeafe;
		border-color: #93c5fd;
	}

	.chip:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.chip-name {
		color: #1e40af;
		font-weight: 600;
	}

	.chip-value {
		color: #0f172a;
	}

	.chip-x {
		color: #2563eb;
		font-size: 1rem;
		line-height: 1;
	}

	.chip-clear {
		font-size: 0.75rem;
		color: #475569;
		text-decoration: underline;
		margin-left: 0.25rem;
	}

	.chip-clear:hover {
		color: #1a1a2e;
	}

	.result-summary {
		margin: 0;
		color: #64748b;
		font-size: 0.8125rem;
	}

	.card.just-created {
		border-color: #86efac;
		box-shadow: 0 0 0 3px rgba(134, 239, 172, 0.35);
	}

	.empty {
		background: white;
		border: 1px dashed #cbd5e1;
		border-radius: 12px;
		padding: 3rem 1.5rem;
		text-align: center;
		color: #64748b;
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
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		transition: border-color 120ms, box-shadow 120ms;
	}

	.card:hover {
		border-color: #bfdbfe;
		box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
	}

	.card-link {
		display: block;
		padding: 0.875rem 1rem;
		text-decoration: none;
		color: inherit;
	}

	.card-front {
		color: #0f172a;
		font-size: 0.9375rem;
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
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: 999px;
		border: 1px solid #e2e8f0;
		color: #475569;
		background: #f8fafc;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.domain {
		color: #1d4ed8;
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.badge.status-suspended {
		color: #92400e;
		background: #fffbeb;
		border-color: #fde68a;
	}

	.badge.status-archived {
		color: #4b5563;
		background: #f3f4f6;
		border-color: #e5e7eb;
	}

	.badge.source {
		color: #6b21a8;
		background: #faf5ff;
		border-color: #e9d5ff;
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
		color: #64748b;
		font-size: 0.875rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover {
		background: #e2e8f0;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
		border-color: transparent;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
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
