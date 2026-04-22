<script lang="ts">
import {
	CONTENT_SOURCE_VALUES,
	DIFFICULTY_LABELS,
	DIFFICULTY_VALUES,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	PHASE_OF_FLIGHT_LABELS,
	PHASE_OF_FLIGHT_VALUES,
	QUERY_PARAMS,
	ROUTES,
	SCENARIO_STATUS_VALUES,
	SCENARIO_STATUSES,
} from '@ab/constants';
import { buildQuery, humanize } from '@ab/utils';
import { tick } from 'svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const scenarios = $derived(data.scenarios);
const filters = $derived(data.filters);
const currentPage = $derived(data.page);
const hasMore = $derived(data.hasMore);
const createdScenario = $derived(data.createdScenario);

const hasActiveFilters = $derived(
	Boolean(filters.domain || filters.difficulty || filters.phaseOfFlight || filters.sourceType) ||
		filters.status !== SCENARIO_STATUSES.ACTIVE,
);

// The newly-created scenario (when redirected from /reps/new?created=<id>)
// gets a dismissible banner plus an auto-scroll+highlight on the row.
let bannerDismissed = $state(false);
const bannerVisible = $derived(createdScenario !== null && !bannerDismissed);

$effect(() => {
	const current = createdScenario;
	if (!current) return;
	void tick().then(() => {
		const el = document.getElementById(`scenario-${current.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
});

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
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function difficultyLabel(slug: string): string {
	return (DIFFICULTY_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function phaseLabel(slug: string): string {
	return (PHASE_OF_FLIGHT_LABELS as Record<string, string>)[slug] ?? humanize(slug);
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
			<h1>Browse</h1>
			<p class="sub">Your decision-rep scenarios. Filter by domain, difficulty, or phase.</p>
		</div>
		<a class="btn primary" href={ROUTES.REPS_NEW}>New scenario</a>
	</header>

	{#if bannerVisible && createdScenario}
		<div class="banner" role="status">
			<span>Scenario <strong>&ldquo;{createdScenario.title}&rdquo;</strong> saved.</span>
			<button type="button" class="banner-dismiss" onclick={() => (bannerDismissed = true)} aria-label="Dismiss">
				×
			</button>
		</div>
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

	{#if hasActiveFilters && scenarios.length > 0}
		<p class="result-summary">
			Showing {scenarios.length} scenario{scenarios.length === 1 ? '' : 's'}{hasMore ? '+' : ''} matching your filters.
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
		grid-template-columns: repeat(5, 1fr) auto;
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

	.filter select {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-sm);
		background: white;
		color: var(--ab-color-fg);
	}

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
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: border-color 120ms, box-shadow 120ms;
	}

	.card:hover {
		border-color: var(--ab-color-primary-subtle-border);
		box-shadow: var(--ab-shadow-sm);
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.card-title {
		margin: 0;
		font-size: var(--ab-font-size-base);
		color: var(--ab-color-fg);
	}

	.count {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-faint);
	}

	.card-situation {
		margin: 0;
		color: var(--ab-color-fg-muted);
		font-size: var(--ab-font-size-body);
		line-height: 1.45;
	}

	.card-meta {
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

	.badge.phase {
		color: var(--ab-color-accent);
		background: var(--ab-color-accent-subtle);
		border-color: var(--ab-color-accent-subtle-border);
	}

	.badge.difficulty-beginner {
		color: var(--ab-color-success-hover);
		background: var(--ab-color-success-subtle);
		border-color: var(--ab-color-success-subtle-border);
	}

	.badge.difficulty-intermediate {
		color: var(--ab-color-warning-hover);
		background: var(--ab-color-warning-subtle);
		border-color: var(--ab-color-warning-subtle-border);
	}

	.badge.difficulty-advanced {
		color: var(--ab-color-danger-hover);
		background: var(--ab-color-danger-subtle);
		border-color: var(--ab-color-danger-subtle-border);
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
