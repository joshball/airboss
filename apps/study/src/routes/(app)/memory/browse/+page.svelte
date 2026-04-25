<script lang="ts">
import {
	BROWSE_GROUP_BY_LABELS,
	BROWSE_GROUP_BY_VALUES,
	BROWSE_PAGE_SIZE,
	BROWSE_PAGE_SIZE_VALUES,
	BROWSE_STATUS_FILTER_LABELS,
	BROWSE_STATUS_FILTER_VALUES,
	BROWSE_STATUS_REMOVED,
	type BrowseGroupBy,
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
import type { BrowseListGroup } from '@ab/ui/components/BrowseList.svelte';
import BrowseList from '@ab/ui/components/BrowseList.svelte';
import BrowseListItem from '@ab/ui/components/BrowseListItem.svelte';
import BrowseViewControls from '@ab/ui/components/BrowseViewControls.svelte';
import FilterCard from '@ab/ui/components/FilterCard.svelte';
import type { FilterChipDef } from '@ab/ui/components/FilterChips.svelte';
import FilterChips from '@ab/ui/components/FilterChips.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import Pager from '@ab/ui/components/Pager.svelte';
import ResultSummary from '@ab/ui/components/ResultSummary.svelte';
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
const groupBy = $derived(data.groupBy);
const facets = $derived(data.facets);
const createdCard = $derived(data.createdCard);

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
	const next = new URL(page.url);
	next.searchParams.delete(QUERY_PARAMS.CREATED);
	void goto(next, { replaceState: true, keepFocus: true, noScroll: true });
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

function buildHref(next: Record<string, string | undefined>): string {
	const full: Record<string, string | number | null | undefined> = {
		[QUERY_PARAMS.DOMAIN]: filters.domain,
		[QUERY_PARAMS.CARD_TYPE]: filters.cardType,
		[QUERY_PARAMS.SOURCE]: filters.sourceType,
		[QUERY_PARAMS.STATUS]: filters.status === CARD_STATUSES.ACTIVE ? undefined : filters.status,
		[QUERY_PARAMS.SEARCH]: filters.search || undefined,
		[QUERY_PARAMS.PAGE_SIZE]: pageSize === BROWSE_PAGE_SIZE ? undefined : String(pageSize),
		[QUERY_PARAMS.GROUP_BY]: groupBy === 'none' ? undefined : groupBy,
		...next,
	};
	return `${ROUTES.MEMORY_BROWSE}${buildQuery(full)}`;
}

function pageHref(n: number): string {
	return buildHref({ [QUERY_PARAMS.PAGE]: n > 1 ? String(n) : undefined });
}

const chips = $derived.by<FilterChipDef[]>(() => {
	const out: FilterChipDef[] = [];
	if (filters.search)
		out.push({
			key: QUERY_PARAMS.SEARCH,
			label: 'Search',
			value: `"${shortenFront(filters.search, 40)}"`,
			removeHref: buildHref({ [QUERY_PARAMS.SEARCH]: undefined }),
		});
	if (filters.domain)
		out.push({
			key: QUERY_PARAMS.DOMAIN,
			label: 'Domain',
			value: domainLabel(filters.domain),
			removeHref: buildHref({ [QUERY_PARAMS.DOMAIN]: undefined }),
		});
	if (filters.cardType)
		out.push({
			key: QUERY_PARAMS.CARD_TYPE,
			label: 'Type',
			value: cardTypeLabel(filters.cardType),
			removeHref: buildHref({ [QUERY_PARAMS.CARD_TYPE]: undefined }),
		});
	if (filters.sourceType)
		out.push({
			key: QUERY_PARAMS.SOURCE,
			label: 'Source',
			value: sourceLabel(filters.sourceType),
			removeHref: buildHref({ [QUERY_PARAMS.SOURCE]: undefined }),
		});
	if (filters.status !== CARD_STATUSES.ACTIVE)
		out.push({
			key: QUERY_PARAMS.STATUS,
			label: 'Status',
			value: statusLabel(filters.status),
			removeHref: buildHref({ [QUERY_PARAMS.STATUS]: undefined }),
		});
	return out;
});

function domainCount(slug: string): number | undefined {
	return facets?.domain?.[slug];
}
function typeCount(slug: string): number | undefined {
	return facets?.cardType?.[slug];
}
function sourceCount(slug: string): number | undefined {
	return facets?.sourceType?.[slug];
}
function statusCount(slug: string): number | undefined {
	if (slug === BROWSE_STATUS_REMOVED) return undefined;
	return facets?.status?.[slug];
}
function fmtCount(n: number | undefined): string {
	return n === undefined ? '' : ` (${n})`;
}

interface CardRow {
	id: string;
	front: string;
	domain: string;
	cardType: string;
	status: string;
	sourceType: string;
	scheduleState: string;
	stabilityDays: number;
	dueAt: Date;
	lastReviewedAt: Date | null;
	removed?: { snoozeId: string; removedAt: Date; comment: string | null };
}

function groupKeyFor(c: CardRow, by: BrowseGroupBy): string {
	if (by === 'domain') return c.domain;
	if (by === 'type') return c.cardType;
	if (by === 'source') return c.sourceType;
	if (by === 'status') return c.removed ? BROWSE_STATUS_REMOVED : c.status;
	if (by === 'state') return c.scheduleState;
	return '';
}

function groupLabelFor(by: BrowseGroupBy, key: string): string {
	if (by === 'domain') return domainLabel(key);
	if (by === 'type') return cardTypeLabel(key);
	if (by === 'source') return sourceLabel(key);
	if (by === 'status') return statusLabel(key);
	if (by === 'state') return cardStateLabel(key);
	return '';
}

const groups = $derived.by<BrowseListGroup<CardRow>[]>(() => {
	if (groupBy === 'none' || cards.length === 0) {
		return [{ key: '', label: '', items: cards as CardRow[] }];
	}
	const map = new Map<string, CardRow[]>();
	for (const c of cards as CardRow[]) {
		const k = groupKeyFor(c, groupBy);
		const list = map.get(k) ?? [];
		list.push(c);
		map.set(k, list);
	}
	return [...map.entries()]
		.map(([k, items]) => ({ key: k, label: groupLabelFor(groupBy, k), items }))
		.sort((a, b) => a.label.localeCompare(b.label));
});
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
			<p class="sub">
				Every memory card on your account -- the ones you've authored and the ones seeded from course material.
				Filter, search, and click any card to edit it.
			</p>
		</div>
		<a class="btn primary" href={ROUTES.MEMORY_NEW}>New card</a>
	</header>

	{#if createdCard}
		<Banner tone="success" dismissible onDismiss={dismissCreatedBanner}>
			Card saved.
			<a class="banner-link" href={ROUTES.MEMORY_CARD(createdCard.id)}>View &ldquo;{shortenFront(createdCard.front)}&rdquo;</a>
		</Banner>
	{/if}

	<FilterCard resetHref={ROUTES.MEMORY_BROWSE} ariaLabel="Filter cards">
		{#snippet hidden()}
			<input type="hidden" name={QUERY_PARAMS.PAGE} value="1" />
			<input
				type="hidden"
				name={QUERY_PARAMS.PAGE_SIZE}
				value={pageSize === BROWSE_PAGE_SIZE ? '' : String(pageSize)}
			/>
			<input type="hidden" name={QUERY_PARAMS.GROUP_BY} value={groupBy === 'none' ? '' : groupBy} />
		{/snippet}
		{#snippet controls()}
			<div class="filter">
				<div class="filter-label-row">
					<label for="f-q">Search</label>
				</div>
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
						<option value={d}>{domainLabel(d)}{fmtCount(domainCount(d))}</option>
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
						<option value={t}>{cardTypeLabel(t)}{fmtCount(typeCount(t))}</option>
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
						<option value={s}>{sourceLabel(s)}{fmtCount(sourceCount(s))}</option>
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
						<option value={s}>{statusLabel(s)}{fmtCount(statusCount(s))}</option>
					{/each}
				</select>
			</div>
		{/snippet}
	</FilterCard>

	<BrowseViewControls
		{groupBy}
		groupByOptions={BROWSE_GROUP_BY_VALUES.map((g) => ({ value: g, label: BROWSE_GROUP_BY_LABELS[g] }))}
		onGroupBy={(v) => goto(buildHref({ [QUERY_PARAMS.GROUP_BY]: v === 'none' ? undefined : v }))}
		{pageSize}
		pageSizeOptions={BROWSE_PAGE_SIZE_VALUES.map((n) => ({ value: n, label: String(n) }))}
		onPageSize={(v) =>
			goto(
				buildHref({
					[QUERY_PARAMS.PAGE_SIZE]: v === BROWSE_PAGE_SIZE ? undefined : String(v),
					[QUERY_PARAMS.PAGE]: undefined,
				}),
			)}
	/>

	<FilterChips {chips} clearHref={ROUTES.MEMORY_BROWSE} />

	<ResultSummary
		{total}
		pageCount={cards.length}
		{currentPage}
		{pageSize}
		noun="card"
		filtersActive={hasActiveFilters}
	/>

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
		<BrowseList {groups}>
			{#snippet item(c)}
				<BrowseListItem
					href={ROUTES.MEMORY_CARD(c.id)}
					id={`card-${c.id}`}
					justCreated={createdCard?.id === c.id}
				>
					{#snippet title()}
						<span class="card-front">{shorten(c.front)}</span>
					{/snippet}
					{#snippet meta()}
						<span class="badge domain">{domainLabel(c.domain)}</span>
						<span class="badge type">{cardTypeLabel(c.cardType)}</span>
						{#if c.removed}
							<span class="badge status-removed">Removed</span>
						{:else}
							<span class="badge status-{c.status}">{statusLabel(c.status)}</span>
						{/if}
						<span class="badge source">{sourceLabel(c.sourceType)}</span>
					{/snippet}
					{#snippet stats()}
						<span class="stat"><span class="stat-key">{cardStateLabel(c.scheduleState)}</span></span>
						<span class="stat"><span class="stat-key">Due</span> {dueLabel(c.dueAt)}</span>
						<span class="stat"><span class="stat-key">Stab</span> {c.stabilityDays.toFixed(1)}d</span>
						<span class="stat"><span class="stat-key">Last</span> {lastReviewedLabel(c.lastReviewedAt)}</span>
					{/snippet}
					{#snippet extra()}
						{#if c.removed?.comment}
							<p class="removed-comment">Removed comment: {c.removed.comment}</p>
						{/if}
					{/snippet}
					{#snippet trailing()}
						{#if c.removed}
							<form method="POST" action="?/restore" class="restore-form">
								<input type="hidden" name="cardId" value={c.id} />
								<button type="submit" class="btn ghost restore-btn">Restore</button>
							</form>
						{/if}
					{/snippet}
				</BrowseListItem>
			{/snippet}
		</BrowseList>

		<Pager {currentPage} {totalPages} {hasMore} {pageHref} />
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
		max-width: 70ch;
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

	.card-front {
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
		line-height: 1.4;
	}

	.stat {
		display: inline-flex;
		gap: var(--space-2xs);
		white-space: nowrap;
	}

	.stat-key {
		color: var(--ink-muted);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-size: var(--type-ui-caption-size);
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

	.removed-comment {
		margin: var(--space-2xs) 0 0;
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

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
		border-color: transparent;
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}

</style>
