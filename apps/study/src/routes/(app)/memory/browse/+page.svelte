<script lang="ts">
import {
	BROWSE_STATUS_FILTER_LABELS,
	BROWSE_STATUS_FILTER_VALUES,
	BROWSE_STATUS_REMOVED,
	type BrowseStatusFilter,
	CARD_STATUSES,
	CARD_TYPE_LABELS,
	CARD_TYPE_VALUES,
	type CardType,
	CONTENT_SOURCE_LABELS,
	CONTENT_SOURCE_VALUES,
	type ContentSource,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	type Domain,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { buildQuery, humanize } from '@ab/utils';
import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
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

$effect(() => {
	const current = createdCard;
	if (!current) return;
	void tick().then(() => {
		const el = document.getElementById(`card-${current.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
});

function dismissCreatedBanner(): void {
	// Clear the `?created=...` param so the banner doesn't re-appear on
	// navigation and the scroll effect doesn't re-fire. `noScroll` keeps the
	// viewport where the user left it.
	const next = new URL(page.url);
	next.searchParams.delete(QUERY_PARAMS.CREATED);
	void goto(next, { replaceState: true, keepFocus: true, noScroll: true });
}

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

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
}

function cardTypeLabel(slug: string): string {
	return (CARD_TYPE_LABELS as Record<CardType, string>)[slug as CardType] ?? humanize(slug);
}

function statusLabel(slug: string): string {
	return (
		(BROWSE_STATUS_FILTER_LABELS as Record<BrowseStatusFilter, string>)[slug as BrowseStatusFilter] ?? humanize(slug)
	);
}

function sourceLabel(slug: string): string {
	return (CONTENT_SOURCE_LABELS as Record<ContentSource, string>)[slug as ContentSource] ?? humanize(slug);
}

function cardStateLabel(slug: string): string {
	return humanize(slug);
}

function formatRelative(ms: number): string {
	const abs = Math.abs(ms);
	const minutes = abs / 60_000;
	const hours = minutes / 60;
	const days = hours / 24;
	const future = ms >= 0;
	let value: string;
	if (abs < 60_000) value = `${Math.round(abs / 1000)}s`;
	else if (minutes < 60) value = `${Math.round(minutes)}m`;
	else if (hours < 48) value = `${Math.round(hours)}h`;
	else if (days < 60) value = `${Math.round(days)}d`;
	else value = `${Math.round(days / 30)}mo`;
	return future ? `in ${value}` : `${value} ago`;
}

function dueLabel(dueAt: Date | string): string {
	const t = (typeof dueAt === 'string' ? new Date(dueAt) : dueAt).getTime();
	return formatRelative(t - Date.now());
}

function lastReviewedLabel(lastReviewedAt: Date | string | null): string {
	if (!lastReviewedAt) return 'Never';
	const t = (typeof lastReviewedAt === 'string' ? new Date(lastReviewedAt) : lastReviewedAt).getTime();
	return formatRelative(t - Date.now());
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
	if (filters.sourceType)
		out.push({ key: QUERY_PARAMS.SOURCE, label: 'Source', value: sourceLabel(filters.sourceType) });
	if (filters.status !== CARD_STATUSES.ACTIVE)
		out.push({ key: QUERY_PARAMS.STATUS, label: 'Status', value: statusLabel(filters.status) });
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
			<div class="title-row">
				<h1>Browse</h1>
				<PageHelp pageId="memory-browse" />
			</div>
			<p class="sub">Your deck of memory items. Filter, search, or click a card to edit.</p>
		</div>
		<a class="btn primary" href={ROUTES.MEMORY_NEW}>New card</a>
	</header>

	{#if createdCard}
		<Banner variant="success" dismissible onDismiss={dismissCreatedBanner}>
			Card saved.
			<a class="banner-link" href={ROUTES.MEMORY_CARD(createdCard.id)}>View &ldquo;{shortenFront(createdCard.front)}&rdquo;</a>
		</Banner>
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
			<div class="filter-label-row">
				<label for="f-domain">Domain</label>
				<InfoTip
					term="Domain filter"
					definition="Narrow to a single topic bucket. Domains map to the curriculum areas each card belongs to."
					helpId="memory-browse"
					helpSection="filters"
				/>
			</div>
			<select id="f-domain" name={QUERY_PARAMS.DOMAIN} value={filters.domain ?? ''}>
				<option value="">All</option>
				{#each DOMAIN_VALUES as d (d)}
					<option value={d}>{domainLabel(d)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<div class="filter-label-row">
				<label for="f-type">Type</label>
				<InfoTip
					term="Type filter"
					definition="Narrow to a card format. Basic is the default front/back question-and-answer shape."
					helpId="memory-browse"
					helpSection="filters"
				/>
			</div>
			<select id="f-type" name={QUERY_PARAMS.CARD_TYPE} value={filters.cardType ?? ''}>
				<option value="">All</option>
				{#each CARD_TYPE_VALUES as t (t)}
					<option value={t}>{cardTypeLabel(t)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<div class="filter-label-row">
				<label for="f-source">Source</label>
				<InfoTip
					term="Source filter"
					definition="Separate cards you authored from cards ported from course material. Course cards are read-only."
					helpId="memory-browse"
					helpSection="filters"
				/>
			</div>
			<select id="f-source" name={QUERY_PARAMS.SOURCE} value={filters.sourceType ?? ''}>
				<option value="">All</option>
				{#each CONTENT_SOURCE_VALUES as s (s)}
					<option value={s}>{sourceLabel(s)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<div class="filter-label-row">
				<label for="f-status">Status</label>
				<InfoTip
					term="Status filter"
					definition="Active cards are in rotation. Suspended cards pause scheduling. Archived cards leave the deck."
					helpId="memory-browse"
					helpSection="status-lifecycle"
				/>
			</div>
			<select id="f-status" name={QUERY_PARAMS.STATUS} value={filters.status ?? CARD_STATUSES.ACTIVE}>
				{#each BROWSE_STATUS_FILTER_VALUES as s (s)}
					<option value={s}>{statusLabel(s)}</option>
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
							{#if c.removed}
								<span class="badge status-removed">Removed</span>
							{:else}
								<span class="badge status-{c.status}">{statusLabel(c.status)}</span>
							{/if}
							<span class="badge source">{sourceLabel(c.sourceType)}</span>
						</div>
						<dl class="card-stats" aria-label="Schedule">
							<div><dt>State</dt><dd>{cardStateLabel(c.scheduleState)}</dd></div>
							<div><dt>Due</dt><dd>{dueLabel(c.dueAt)}</dd></div>
							<div><dt>Stability</dt><dd>{c.stabilityDays.toFixed(1)} d</dd></div>
							<div><dt>Last reviewed</dt><dd>{lastReviewedLabel(c.lastReviewedAt)}</dd></div>
						</dl>
						{#if c.removed?.comment}
							<p class="removed-comment">Removed comment: {c.removed.comment}</p>
						{/if}
					</a>
					{#if c.removed}
						<form method="POST" action="?/restore" class="restore-form">
							<input type="hidden" name="cardId" value={c.id} />
							<button type="submit" class="btn ghost restore-btn">Restore</button>
						</form>
					{/if}
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
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--type-definition-body-size);
	}

	.filters {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto;
		gap: var(--space-md);
		align-items: end;
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
	}

	.filter {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.filter label {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.filter-label-row {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.filter input,
	.filter select {
		font: inherit;
		padding: var(--space-sm) var(--space-sm);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}

	.filter input:focus,
	.filter select:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}

	.filter-actions {
		display: flex;
		gap: var(--space-xs);
	}

	.banner-link {
		color: var(--action-default-hover);
		font-weight: 600;
		text-decoration: none;
		margin-left: var(--space-2xs);
	}

	.banner-link:hover {
		text-decoration: underline;
	}

	.chip-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-xs);
		padding: 0 var(--space-2xs);
	}

	.chip-label {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
		font-weight: 600;
		margin-right: var(--space-2xs);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-pill);
		color: var(--action-default-hover);
		font-size: var(--type-ui-label-size);
		text-decoration: none;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.chip:hover {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.chip:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.chip-name {
		color: var(--action-default-active);
		font-weight: 600;
	}

	.chip-value {
		color: var(--ink-body);
	}

	.chip-x {
		color: var(--action-default);
		font-size: var(--type-reading-body-size);
		line-height: 1;
	}

	.chip-clear {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-decoration: underline;
		margin-left: var(--space-2xs);
	}

	.chip-clear:hover {
		color: var(--ink-body);
	}

	.result-summary {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
	}

	.card.just-created {
		border-color: var(--signal-success-edge);
		box-shadow: 0 0 0 3px var(--signal-success);
	}

	.empty {
		background: var(--ink-inverse);
		border: 1px dashed var(--edge-strong);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl) var(--space-xl);
		text-align: center;
		color: var(--ink-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
	}

	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
	}

	.card:hover {
		border-color: var(--action-default-edge);
		box-shadow: var(--shadow-sm);
	}

	.card-link {
		display: block;
		padding: var(--space-md) var(--space-lg);
		text-decoration: none;
		color: inherit;
	}

	.card-front {
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
		line-height: 1.4;
	}

	.card-meta {
		margin-top: var(--space-sm);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		background: var(--surface-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badge.domain {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.status-suspended {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.status-archived {
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-color: var(--edge-default);
	}

	.badge.source {
		color: var(--accent-code);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.pager {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) 0;
	}

	.pager > :first-child {
		justify-self: start;
	}

	.pager > :last-child {
		justify-self: end;
	}

	.page-num {
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover {
		background: var(--edge-default);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
		border-color: transparent;
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
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
