<script lang="ts">
import {
	BROWSE_PAGE_SIZE,
	BROWSE_PAGE_SIZE_VALUES,
	CONTENT_SOURCE_VALUES,
	DIFFICULTY_LABELS,
	DIFFICULTY_VALUES,
	type Difficulty,
	DOMAIN_VALUES,
	domainLabel,
	PHASE_OF_FLIGHT_LABELS,
	PHASE_OF_FLIGHT_VALUES,
	type PhaseOfFlight,
	QUERY_PARAMS,
	ROUTES,
	SCENARIO_STATUS_VALUES,
	SCENARIO_STATUSES,
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
import Pager from '@ab/ui/components/Pager.svelte';
import ResultSummary from '@ab/ui/components/ResultSummary.svelte';
import { buildQuery, humanize } from '@ab/utils';
import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { REPS_GROUP_BY_OPTIONS, type RepsGroupByValue } from './+page.server';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const scenarios = $derived(data.scenarios);
const filters = $derived(data.filters);
const currentPage = $derived(data.page);
const hasMore = $derived(data.hasMore);
const total = $derived(data.total);
const totalPages = $derived(data.totalPages);
const pageSize = $derived(data.pageSize);
const groupBy = $derived(data.groupBy);
const facets = $derived(data.facets);
const createdScenario = $derived(data.createdScenario);

const hasActiveFilters = $derived(
	Boolean(filters.domain || filters.difficulty || filters.phaseOfFlight || filters.sourceType || filters.search) ||
		filters.status !== SCENARIO_STATUSES.ACTIVE,
);

$effect(() => {
	const current = createdScenario;
	if (!current) return;
	void tick().then(() => {
		const el = document.getElementById(`scenario-${current.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
});

function dismissCreatedBanner(): void {
	const next = new URL(page.url);
	next.searchParams.delete(QUERY_PARAMS.CREATED);
	void goto(next, { replaceState: true, keepFocus: true, noScroll: true });
}

function difficultyLabel(slug: string): string {
	return (DIFFICULTY_LABELS as Record<Difficulty, string>)[slug as Difficulty] ?? humanize(slug);
}

function phaseLabel(slug: string): string {
	return (PHASE_OF_FLIGHT_LABELS as Record<PhaseOfFlight, string>)[slug as PhaseOfFlight] ?? humanize(slug);
}

function shorten(text: string, max = 160): string {
	const trimmed = text.trim();
	if (trimmed.length <= max) return trimmed;
	return `${trimmed.slice(0, max).trimEnd()}...`;
}

function buildHref(next: Record<string, string | undefined>): string {
	const full: Record<string, string | number | null | undefined> = {
		[QUERY_PARAMS.DOMAIN]: filters.domain,
		[QUERY_PARAMS.DIFFICULTY]: filters.difficulty,
		[QUERY_PARAMS.FLIGHT_PHASE]: filters.phaseOfFlight,
		[QUERY_PARAMS.SOURCE]: filters.sourceType,
		[QUERY_PARAMS.STATUS]: filters.status === SCENARIO_STATUSES.ACTIVE ? undefined : filters.status,
		[QUERY_PARAMS.SEARCH]: filters.search || undefined,
		[QUERY_PARAMS.PAGE_SIZE]: pageSize === BROWSE_PAGE_SIZE ? undefined : String(pageSize),
		[QUERY_PARAMS.GROUP_BY]: groupBy === 'none' ? undefined : groupBy,
		...next,
	};
	return `${ROUTES.REPS_BROWSE}${buildQuery(full)}`;
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
			value: `"${shorten(filters.search, 40)}"`,
			removeHref: buildHref({ [QUERY_PARAMS.SEARCH]: undefined }),
		});
	if (filters.domain)
		out.push({
			key: QUERY_PARAMS.DOMAIN,
			label: 'Domain',
			value: domainLabel(filters.domain),
			removeHref: buildHref({ [QUERY_PARAMS.DOMAIN]: undefined }),
		});
	if (filters.difficulty)
		out.push({
			key: QUERY_PARAMS.DIFFICULTY,
			label: 'Difficulty',
			value: difficultyLabel(filters.difficulty),
			removeHref: buildHref({ [QUERY_PARAMS.DIFFICULTY]: undefined }),
		});
	if (filters.phaseOfFlight)
		out.push({
			key: QUERY_PARAMS.FLIGHT_PHASE,
			label: 'Phase',
			value: phaseLabel(filters.phaseOfFlight),
			removeHref: buildHref({ [QUERY_PARAMS.FLIGHT_PHASE]: undefined }),
		});
	if (filters.sourceType)
		out.push({
			key: QUERY_PARAMS.SOURCE,
			label: 'Source',
			value: humanize(filters.sourceType),
			removeHref: buildHref({ [QUERY_PARAMS.SOURCE]: undefined }),
		});
	if (filters.status !== SCENARIO_STATUSES.ACTIVE)
		out.push({
			key: QUERY_PARAMS.STATUS,
			label: 'Status',
			value: humanize(filters.status),
			removeHref: buildHref({ [QUERY_PARAMS.STATUS]: undefined }),
		});
	return out;
});

function fmtCount(n: number | undefined): string {
	return n === undefined ? '' : ` (${n})`;
}

const groupByLabels: Record<RepsGroupByValue, string> = {
	none: 'No grouping',
	domain: 'Domain',
	difficulty: 'Difficulty',
	phaseOfFlight: 'Phase',
	source: 'Source',
	status: 'Status',
};

type ScenarioRow = (typeof scenarios)[number];

function groupKey(s: ScenarioRow, by: RepsGroupByValue): string {
	if (by === 'domain') return s.domain;
	if (by === 'difficulty') return s.difficulty;
	if (by === 'phaseOfFlight') return s.phaseOfFlight ?? '(none)';
	if (by === 'source') return s.sourceType;
	if (by === 'status') return s.status;
	return '';
}

function groupHeading(by: RepsGroupByValue, key: string): string {
	if (key === '(none)') return 'No phase';
	if (by === 'domain') return domainLabel(key);
	if (by === 'difficulty') return difficultyLabel(key);
	if (by === 'phaseOfFlight') return phaseLabel(key);
	if (by === 'source') return humanize(key);
	if (by === 'status') return humanize(key);
	return '';
}

const groups = $derived.by<BrowseListGroup<ScenarioRow>[]>(() => {
	if (groupBy === 'none' || scenarios.length === 0) {
		return [{ key: '', label: '', items: scenarios as ScenarioRow[] }];
	}
	const map = new Map<string, ScenarioRow[]>();
	for (const s of scenarios as ScenarioRow[]) {
		const k = groupKey(s, groupBy);
		const list = map.get(k) ?? [];
		list.push(s);
		map.set(k, list);
	}
	return [...map.entries()]
		.map(([k, items]) => ({ key: k, label: groupHeading(groupBy, k), items }))
		.sort((a, b) => a.label.localeCompare(b.label));
});
</script>

<svelte:head>
	<title>Browse scenarios -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<div class="title-row">
				<h1>Browse</h1>
				<PageHelp pageId="reps-browse" />
			</div>
			<p class="sub">Your decision-rep scenarios. Search, filter by domain, difficulty, or phase, and click to edit.</p>
		</div>
		<a class="btn primary" href={ROUTES.REPS_NEW}>New scenario</a>
	</header>

	{#if createdScenario}
		<Banner variant="success" dismissible onDismiss={dismissCreatedBanner}>
			Scenario <strong>&ldquo;{createdScenario.title}&rdquo;</strong> saved.
		</Banner>
	{/if}

	<FilterCard resetHref={ROUTES.REPS_BROWSE} ariaLabel="Filter scenarios">
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
				<label for="f-q">Search</label>
				<input
					id="f-q"
					type="search"
					name={QUERY_PARAMS.SEARCH}
					placeholder="title or situation..."
					value={filters.search ?? ''}
				/>
			</div>
			<div class="filter">
				<label for="f-domain">Domain</label>
				<select id="f-domain" name={QUERY_PARAMS.DOMAIN} value={filters.domain ?? ''}>
					<option value="">All</option>
					{#each DOMAIN_VALUES as d (d)}
						<option value={d}>{domainLabel(d)}{fmtCount(facets?.domain?.[d])}</option>
					{/each}
				</select>
			</div>
			<div class="filter">
				<label for="f-difficulty">Difficulty</label>
				<select id="f-difficulty" name={QUERY_PARAMS.DIFFICULTY} value={filters.difficulty ?? ''}>
					<option value="">All</option>
					{#each DIFFICULTY_VALUES as d (d)}
						<option value={d}>{difficultyLabel(d)}{fmtCount(facets?.difficulty?.[d])}</option>
					{/each}
				</select>
			</div>
			<div class="filter">
				<label for="f-phase">Phase</label>
				<select id="f-phase" name={QUERY_PARAMS.FLIGHT_PHASE} value={filters.phaseOfFlight ?? ''}>
					<option value="">All</option>
					{#each PHASE_OF_FLIGHT_VALUES as p (p)}
						<option value={p}>{phaseLabel(p)}{fmtCount(facets?.phaseOfFlight?.[p])}</option>
					{/each}
				</select>
			</div>
			<div class="filter">
				<label for="f-source">Source</label>
				<select id="f-source" name={QUERY_PARAMS.SOURCE} value={filters.sourceType ?? ''}>
					<option value="">All</option>
					{#each CONTENT_SOURCE_VALUES as s (s)}
						<option value={s}>{humanize(s)}{fmtCount(facets?.sourceType?.[s])}</option>
					{/each}
				</select>
			</div>
			<div class="filter">
				<label for="f-status">Status</label>
				<select id="f-status" name={QUERY_PARAMS.STATUS} value={filters.status ?? SCENARIO_STATUSES.ACTIVE}>
					{#each SCENARIO_STATUS_VALUES as s (s)}
						<option value={s}>{humanize(s)}{fmtCount(facets?.status?.[s])}</option>
					{/each}
				</select>
			</div>
		{/snippet}
	</FilterCard>

	<BrowseViewControls
		{groupBy}
		groupByOptions={REPS_GROUP_BY_OPTIONS.map((g) => ({ value: g, label: groupByLabels[g] }))}
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

	<FilterChips {chips} clearHref={ROUTES.REPS_BROWSE} />

	<ResultSummary
		{total}
		pageCount={scenarios.length}
		{currentPage}
		{pageSize}
		noun="scenario"
		filtersActive={hasActiveFilters}
	/>

	{#if scenarios.length === 0}
		<div class="empty">
			{#if hasActiveFilters}
				<p>No scenarios match these filters.</p>
				<a class="btn ghost" href={ROUTES.REPS_BROWSE}>Clear filters</a>
			{:else}
				<p>No scenarios yet. Write your first one and the rep flow will start picking it up.</p>
				<a class="btn primary" href={ROUTES.REPS_NEW}>Create your first scenario</a>
			{/if}
		</div>
	{:else}
		<BrowseList {groups}>
			{#snippet item(s)}
				<BrowseListItem
					href={ROUTES.REP_DETAIL(s.id)}
					id={`scenario-${s.id}`}
					justCreated={createdScenario?.id === s.id}
				>
					{#snippet title()}
						<div class="card-head">
							<span class="card-title">{s.title}</span>
							<span class="count">{s.optionsCount} options</span>
						</div>
						<p class="card-situation">{shorten(s.situation)}</p>
					{/snippet}
					{#snippet meta()}
						<span class="badge domain">{domainLabel(s.domain)}</span>
						<span class="badge difficulty difficulty-{s.difficulty}">{difficultyLabel(s.difficulty)}</span>
						{#if s.phaseOfFlight}
							<span class="badge phase">{phaseLabel(s.phaseOfFlight)}</span>
						{/if}
						{#if s.status !== SCENARIO_STATUSES.ACTIVE}
							<span class="badge status-{s.status}">{humanize(s.status)}</span>
						{/if}
						{#if s.sourceType !== 'personal'}
							<span class="badge source">{humanize(s.sourceType)}</span>
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
		flex-wrap: wrap;
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

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.card-title {
		font-size: var(--type-reading-body-size);
		color: var(--ink-body);
	}

	.count {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
	}

	.card-situation {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-definition-body-size);
		line-height: 1.45;
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

	.badge.phase {
		color: var(--accent-code);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.difficulty-beginner {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.badge.difficulty-intermediate {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.difficulty-advanced {
		color: var(--action-hazard-hover);
		background: var(--action-hazard-wash);
		border-color: var(--action-hazard-edge);
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
