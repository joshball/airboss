<script lang="ts">
import {
	CERT_LABELS,
	CERT_VALUES,
	type Cert,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	type Domain,
	NODE_LIFECYCLE_LABELS,
	NODE_LIFECYCLE_VALUES,
	type NodeLifecycle,
	QUERY_PARAMS,
	RELEVANCE_PRIORITY_LABELS,
	RELEVANCE_PRIORITY_VALUES,
	type RelevancePriority,
	ROUTES,
} from '@ab/constants';
import { humanize } from '@ab/utils';
import { page } from '$app/state';
import type { PageData } from './$types';

// Filter params this page owns. Reset strips only these so any unrelated future
// query params (sort, view, etc.) that happen to be on the URL survive.
const FILTER_PARAM_KEYS = [
	QUERY_PARAMS.DOMAIN,
	QUERY_PARAMS.CERT,
	QUERY_PARAMS.PRIORITY,
	QUERY_PARAMS.LIFECYCLE,
] as const;

let { data }: { data: PageData } = $props();

const groups = $derived(data.groups);
const filters = $derived(data.filters);
const totalNodes = $derived(data.totalNodes);

const hasActiveFilters = $derived(Boolean(filters.domain || filters.cert || filters.priority || filters.lifecycle));

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
}

function lifecycleLabel(slug: string): string {
	return (NODE_LIFECYCLE_LABELS as Record<NodeLifecycle, string>)[slug as NodeLifecycle] ?? humanize(slug);
}

function certLabel(slug: string): string {
	return (CERT_LABELS as Record<Cert, string>)[slug as Cert] ?? slug;
}

function priorityLabel(slug: string): string {
	return (RELEVANCE_PRIORITY_LABELS as Record<RelevancePriority, string>)[slug as RelevancePriority] ?? humanize(slug);
}

function masteryPct(score: number): number {
	return Math.round(score * 100);
}

// Reset href: drops only filter params, keeps anything unrelated currently on
// the URL. Uses the page's current URL so SSR and client paths stay consistent.
const resetHref = $derived.by(() => {
	const params = new URLSearchParams(page.url.searchParams);
	for (const key of FILTER_PARAM_KEYS) params.delete(key);
	const qs = params.toString();
	return qs.length > 0 ? `${ROUTES.KNOWLEDGE}?${qs}` : ROUTES.KNOWLEDGE;
});
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
			<a class="btn ghost" href={resetHref}>Reset</a>
		</div>
	</form>

	{#if groups.length === 0}
		<div class="empty">
			{#if hasActiveFilters}
				<p>No knowledge nodes match these filters.</p>
				<a class="btn ghost" href={resetHref}>Clear filters</a>
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
		gap: var(--space-xl);
	}

	.hd h1 {
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
		grid-template-columns: repeat(4, 1fr) auto;
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

	.domain {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.domain-title {
		margin: 0;
		font-size: var(--type-ui-label-size);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
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
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg) var(--space-lg);
		text-decoration: none;
		color: inherit;
		transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
	}

	.card:hover {
		border-color: var(--action-default-edge);
		box-shadow: var(--shadow-sm);
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.card-title {
		margin: 0;
		font-size: var(--type-reading-body-size);
		color: var(--ink-body);
	}

	.mastery {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		flex-shrink: 0;
	}

	.mastery-bar {
		display: inline-block;
		width: 80px;
		height: 6px;
		background: var(--edge-default);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
	}

	.mastery-pct {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
		min-width: 2.25rem;
		text-align: right;
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

	.badge.cert {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.priority-core {
		color: var(--action-hazard-hover);
		background: var(--action-hazard-wash);
		border-color: var(--action-hazard-edge);
	}

	.badge.priority-supporting {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.priority-elective {
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-color: var(--edge-default);
	}

	.badge.lifecycle-skeleton {
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.badge.lifecycle-started {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.lifecycle-complete {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.badge.mastered {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.badge.time {
		color: var(--ink-subtle);
		background: var(--surface-muted);
		border-color: var(--edge-default);
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
