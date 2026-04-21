<script lang="ts">
import {
	CONTENT_SOURCE_VALUES,
	DIFFICULTY_LABELS,
	DIFFICULTY_VALUES,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	PHASE_OF_FLIGHT_LABELS,
	PHASE_OF_FLIGHT_VALUES,
	ROUTES,
	SCENARIO_STATUS_VALUES,
	SCENARIO_STATUSES,
} from '@ab/constants';
import { humanize } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const scenarios = $derived(data.scenarios);
const filters = $derived(data.filters);
const currentPage = $derived(data.page);
const hasMore = $derived(data.hasMore);

const hasActiveFilters = $derived(
	Boolean(filters.domain || filters.difficulty || filters.phaseOfFlight || filters.sourceType) ||
		filters.status !== SCENARIO_STATUSES.ACTIVE,
);

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
	const params = new URLSearchParams();
	const full: Record<string, string | undefined> = {
		domain: filters.domain,
		difficulty: filters.difficulty,
		phase: filters.phaseOfFlight,
		source: filters.sourceType,
		status: filters.status === SCENARIO_STATUSES.ACTIVE ? undefined : filters.status,
		...next,
	};
	for (const [k, v] of Object.entries(full)) {
		if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
	}
	const qs = params.toString();
	return qs ? `${ROUTES.REPS_BROWSE}?${qs}` : ROUTES.REPS_BROWSE;
}

function pageHref(n: number): string {
	return buildHref({ page: n > 1 ? String(n) : undefined });
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

	<form class="filters" method="GET" role="search" aria-label="Filter scenarios">
		<input type="hidden" name="page" value="1" />
		<div class="filter">
			<label for="f-domain">Domain</label>
			<select id="f-domain" name="domain" value={filters.domain ?? ''}>
				<option value="">All</option>
				{#each DOMAIN_VALUES as d (d)}
					<option value={d}>{domainLabel(d)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-difficulty">Difficulty</label>
			<select id="f-difficulty" name="difficulty" value={filters.difficulty ?? ''}>
				<option value="">All</option>
				{#each DIFFICULTY_VALUES as d (d)}
					<option value={d}>{difficultyLabel(d)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-phase">Phase</label>
			<select id="f-phase" name="phase" value={filters.phaseOfFlight ?? ''}>
				<option value="">All</option>
				{#each PHASE_OF_FLIGHT_VALUES as p (p)}
					<option value={p}>{phaseLabel(p)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-source">Source</label>
			<select id="f-source" name="source" value={filters.sourceType ?? ''}>
				<option value="">All</option>
				{#each CONTENT_SOURCE_VALUES as s (s)}
					<option value={s}>{humanize(s)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-status">Status</label>
			<select id="f-status" name="status" value={filters.status ?? SCENARIO_STATUSES.ACTIVE}>
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
				<li class="card">
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
		grid-template-columns: repeat(5, 1fr) auto;
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

	.filter select {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		background: white;
		color: #0f172a;
	}

	.filter select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	.filter-actions {
		display: flex;
		gap: 0.375rem;
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
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: border-color 120ms, box-shadow 120ms;
	}

	.card:hover {
		border-color: #bfdbfe;
		box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.card-title {
		margin: 0;
		font-size: 1rem;
		color: #0f172a;
	}

	.count {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.card-situation {
		margin: 0;
		color: #475569;
		font-size: 0.9375rem;
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

	.badge.phase {
		color: #7c3aed;
		background: #f5f3ff;
		border-color: #ddd6fe;
	}

	.badge.difficulty-beginner {
		color: #15803d;
		background: #f0fdf4;
		border-color: #86efac;
	}

	.badge.difficulty-intermediate {
		color: #a16207;
		background: #fefce8;
		border-color: #fde047;
	}

	.badge.difficulty-advanced {
		color: #b91c1c;
		background: #fef2f2;
		border-color: #fecaca;
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
