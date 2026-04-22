<script lang="ts">
import {
	CERT_LABELS,
	CERT_VALUES,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	NODE_LIFECYCLE_LABELS,
	NODE_LIFECYCLE_VALUES,
	QUERY_PARAMS,
	RELEVANCE_PRIORITY_LABELS,
	RELEVANCE_PRIORITY_VALUES,
	ROUTES,
} from '@ab/constants';
import { humanize } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const groups = $derived(data.groups);
const filters = $derived(data.filters);
const totalNodes = $derived(data.totalNodes);

const hasActiveFilters = $derived(Boolean(filters.domain || filters.cert || filters.priority || filters.lifecycle));

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function lifecycleLabel(slug: string): string {
	return (NODE_LIFECYCLE_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function certLabel(slug: string): string {
	return (CERT_LABELS as Record<string, string>)[slug] ?? slug;
}

function priorityLabel(slug: string): string {
	return (RELEVANCE_PRIORITY_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function masteryPct(score: number): number {
	return Math.round(score * 100);
}
</script>

<svelte:head>
	<title>Knowledge -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Knowledge</h1>
			<p class="sub">
				The aviation knowledge graph. {totalNodes} node{totalNodes === 1 ? '' : 's'} grouped by domain.
			</p>
		</div>
	</header>

	<form class="filters" method="GET" role="search" aria-label="Filter nodes">
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
			<label for="f-cert">Cert</label>
			<select id="f-cert" name={QUERY_PARAMS.CERT} value={filters.cert ?? ''}>
				<option value="">All</option>
				{#each CERT_VALUES as c (c)}
					<option value={c}>{certLabel(c)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-priority">Priority</label>
			<select id="f-priority" name={QUERY_PARAMS.PRIORITY} value={filters.priority ?? ''}>
				<option value="">All</option>
				{#each RELEVANCE_PRIORITY_VALUES as p (p)}
					<option value={p}>{priorityLabel(p)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-lifecycle">Lifecycle</label>
			<select id="f-lifecycle" name={QUERY_PARAMS.LIFECYCLE} value={filters.lifecycle ?? ''}>
				<option value="">All</option>
				{#each NODE_LIFECYCLE_VALUES as l (l)}
					<option value={l}>{lifecycleLabel(l)}</option>
				{/each}
			</select>
		</div>
		<div class="filter-actions">
			<button type="submit" class="btn secondary">Apply</button>
			<a class="btn ghost" href={ROUTES.KNOWLEDGE}>Reset</a>
		</div>
	</form>

	{#if groups.length === 0}
		<div class="empty">
			{#if hasActiveFilters}
				<p>No knowledge nodes match these filters.</p>
				<a class="btn ghost" href={ROUTES.KNOWLEDGE}>Clear filters</a>
			{:else}
				<p>No knowledge nodes yet. Author one with <code>bun run knowledge:new</code>, then build.</p>
			{/if}
		</div>
	{:else}
		{#each groups as group (group.domain)}
			<section class="domain">
				<h2 class="domain-title">{domainLabel(group.domain)}</h2>
				<ul class="list">
					{#each group.nodes as node (node.id)}
						<li>
							<a class="card" href={ROUTES.KNOWLEDGE_SLUG(node.id)}>
								<div class="card-head">
									<h3 class="card-title">{node.title}</h3>
									<span class="mastery" aria-label="Mastery {masteryPct(node.displayScore)} percent">
										<span class="mastery-bar">
											<span class="mastery-fill" style:width="{masteryPct(node.displayScore)}%"></span>
										</span>
										<span class="mastery-pct">{masteryPct(node.displayScore)}%</span>
									</span>
								</div>
								<div class="card-meta">
									<span class="badge lifecycle lifecycle-{node.lifecycle}">{lifecycleLabel(node.lifecycle)}</span>
									{#each node.certs as c (c)}
										<span class="badge cert">{certLabel(c)}</span>
									{/each}
									{#each node.priorities as p (p)}
										<span class="badge priority priority-{p}">{priorityLabel(p)}</span>
									{/each}
									{#if node.estimatedTimeMinutes}
										<span class="badge time">{node.estimatedTimeMinutes}m</span>
									{/if}
									{#if node.mastered}
										<span class="badge mastered">Mastered</span>
									{/if}
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.hd h1 {
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
		grid-template-columns: repeat(4, 1fr) auto;
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

	.domain {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.domain-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #475569;
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
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 1rem 1.125rem;
		text-decoration: none;
		color: inherit;
		transition: border-color 120ms, box-shadow 120ms;
	}

	.card:hover {
		border-color: #bfdbfe;
		box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.card-title {
		margin: 0;
		font-size: 1rem;
		color: #0f172a;
	}

	.mastery {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.mastery-bar {
		display: inline-block;
		width: 80px;
		height: 6px;
		background: #e2e8f0;
		border-radius: 999px;
		overflow: hidden;
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: #2563eb;
	}

	.mastery-pct {
		font-size: 0.75rem;
		color: #64748b;
		min-width: 2.25rem;
		text-align: right;
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

	.badge.cert {
		color: #1d4ed8;
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.badge.priority-core {
		color: #b91c1c;
		background: #fef2f2;
		border-color: #fecaca;
	}

	.badge.priority-supporting {
		color: #a16207;
		background: #fefce8;
		border-color: #fde047;
	}

	.badge.priority-elective {
		color: #4b5563;
		background: #f3f4f6;
		border-color: #e5e7eb;
	}

	.badge.lifecycle-skeleton {
		color: #4b5563;
		background: #f3f4f6;
		border-color: #d1d5db;
	}

	.badge.lifecycle-started {
		color: #a16207;
		background: #fefce8;
		border-color: #fde047;
	}

	.badge.lifecycle-complete {
		color: #15803d;
		background: #f0fdf4;
		border-color: #86efac;
	}

	.badge.mastered {
		color: #15803d;
		background: #dcfce7;
		border-color: #86efac;
	}

	.badge.time {
		color: #6b7280;
		background: #f9fafb;
		border-color: #e5e7eb;
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
