<script lang="ts">
import {
	CONTENT_SOURCE_VALUES,
	DIFFICULTY_LABELS,
	DIFFICULTY_VALUES,
	type Difficulty,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	type Domain,
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
import { buildQuery, humanize } from '@ab/utils';
import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const scenarios = $derived(data.scenarios);
const filters = $derived(data.filters);
const currentPage = $derived(data.page);
const hasMore = $derived(data.hasMore);
const total = $derived(data.total);
const totalPages = $derived(data.totalPages);
const pageSize = $derived(data.pageSize);
const createdScenario = $derived(data.createdScenario);

// Range "Showing 21-40 of 137" -- computed client-side so list + pager align.
const rangeStart = $derived(scenarios.length === 0 ? 0 : (currentPage - 1) * pageSize + 1);
const rangeEnd = $derived(scenarios.length === 0 ? 0 : (currentPage - 1) * pageSize + scenarios.length);

const hasActiveFilters = $derived(
	Boolean(filters.domain || filters.difficulty || filters.phaseOfFlight || filters.sourceType) ||
		filters.status !== SCENARIO_STATUSES.ACTIVE,
);

// The newly-created scenario (when redirected from /reps/new?created=<id>)
// gets a dismissible banner plus an auto-scroll+highlight on the row.
$effect(() => {
	const current = createdScenario;
	if (!current) return;
	void tick().then(() => {
		const el = document.getElementById(`scenario-${current.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
});

function dismissCreatedBanner(): void {
	// Clear `?created=...` from the URL so the banner doesn't re-appear on
	// navigation and the scroll effect doesn't re-fire. `noScroll` keeps the
	// viewport where the user left it.
	const next = new URL(page.url);
	next.searchParams.delete(QUERY_PARAMS.CREATED);
	void goto(next, { replaceState: true, keepFocus: true, noScroll: true });
}

type ChipFilterKey =
	| typeof QUERY_PARAMS.DOMAIN
	| typeof QUERY_PARAMS.DIFFICULTY
	| typeof QUERY_PARAMS.FLIGHT_PHASE
	| typeof QUERY_PARAMS.SOURCE
	| typeof QUERY_PARAMS.STATUS;

interface FilterChip {
	key: ChipFilterKey;
	label: string;
	value: string;
}

const chips = $derived.by<FilterChip[]>(() => {
	const out: FilterChip[] = [];
	if (filters.domain) out.push({ key: QUERY_PARAMS.DOMAIN, label: 'Domain', value: domainLabel(filters.domain) });
	if (filters.difficulty)
		out.push({ key: QUERY_PARAMS.DIFFICULTY, label: 'Difficulty', value: difficultyLabel(filters.difficulty) });
	if (filters.phaseOfFlight)
		out.push({ key: QUERY_PARAMS.FLIGHT_PHASE, label: 'Phase', value: phaseLabel(filters.phaseOfFlight) });
	if (filters.sourceType) out.push({ key: QUERY_PARAMS.SOURCE, label: 'Source', value: humanize(filters.sourceType) });
	if (filters.status !== SCENARIO_STATUSES.ACTIVE)
		out.push({ key: QUERY_PARAMS.STATUS, label: 'Status', value: humanize(filters.status) });
	return out;
});

function removeChipHref(key: ChipFilterKey): string {
	// Build a fresh href that keeps every other active filter but drops `key`.
	return buildHref({ [key]: undefined });
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
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
		...next,
	};
	return `${ROUTES.REPS_BROWSE}${buildQuery(full)}`;
}

function pageHref(n: number): string {
	return buildHref({ [QUERY_PARAMS.PAGE]: n > 1 ? String(n) : undefined });
}
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
			<p class="sub">Your decision-rep scenarios. Filter by domain, difficulty, or phase.</p>
		</div>
		<a class="btn primary" href={ROUTES.REPS_NEW}>New scenario</a>
	</header>

	{#if createdScenario}
		<Banner variant="success" dismissible onDismiss={dismissCreatedBanner}>
			Scenario <strong>&ldquo;{createdScenario.title}&rdquo;</strong> saved.
		</Banner>
	{/if}

	<form class="filters" method="GET" role="search" aria-label="Filter scenarios">
		<input type="hidden" name={QUERY_PARAMS.PAGE} value="1" />
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
			<label for="f-difficulty">Difficulty</label>
			<select id="f-difficulty" name={QUERY_PARAMS.DIFFICULTY} value={filters.difficulty ?? ''}>
				<option value="">All</option>
				{#each DIFFICULTY_VALUES as d (d)}
					<option value={d}>{difficultyLabel(d)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-phase">Phase</label>
			<select id="f-phase" name={QUERY_PARAMS.FLIGHT_PHASE} value={filters.phaseOfFlight ?? ''}>
				<option value="">All</option>
				{#each PHASE_OF_FLIGHT_VALUES as p (p)}
					<option value={p}>{phaseLabel(p)}</option>
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
			<select id="f-status" name={QUERY_PARAMS.STATUS} value={filters.status ?? SCENARIO_STATUSES.ACTIVE}>
				{#each SCENARIO_STATUS_VALUES as s (s)}
					<option value={s}>{humanize(s)}</option>
				{/each}
			</select>
		</div>
		<div class="filter-actions">
			<button type="submit" class="btn secondary">Apply</button>
			<a class="btn ghost" href={ROUTES.REPS_BROWSE}>Reset</a>
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
			<a class="chip-clear" href={ROUTES.REPS_BROWSE}>Clear all</a>
		</div>
	{/if}

	{#if total > 0}
		<p class="result-summary">
			{#if total > pageSize}
				Showing {rangeStart}&ndash;{rangeEnd} of {total} scenario{total === 1 ? '' : 's'}{hasActiveFilters
					? ' matching your filters'
					: ''}.
			{:else}
				Showing {total} scenario{total === 1 ? '' : 's'}{hasActiveFilters ? ' matching your filters' : ''}.
			{/if}
		</p>
	{/if}

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
		<ul class="list">
			{#each scenarios as s (s.id)}
				<li id={`scenario-${s.id}`} class="card" class:just-created={createdScenario?.id === s.id}>
					<div class="card-head">
						<h2 class="card-title">{s.title}</h2>
						<span class="count">{s.optionsCount} options</span>
					</div>
					<p class="card-situation">{shorten(s.situation)}</p>
					<div class="card-meta">
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
					</div>
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
	}

	.filters {
		display: grid;
		grid-template-columns: repeat(5, 1fr) auto;
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

	.filter select {
		font: inherit;
		padding: var(--space-sm) var(--space-sm);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}

	.filter select:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}

	.filter-actions {
		display: flex;
		gap: var(--space-xs);
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
		padding: var(--space-lg) var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
	}

	.card:hover {
		border-color: var(--action-default-edge);
		box-shadow: var(--shadow-sm);
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.card-title {
		margin: 0;
		font-size: var(--type-reading-body-size);
		color: var(--ink-body);
	}

	.count {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
	}

	.card-situation {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-definition-body-size);
		line-height: 1.45;
	}

	.card-meta {
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
