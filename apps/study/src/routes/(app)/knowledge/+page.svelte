<script lang="ts">
import {
	BROWSE_PAGE_SIZE,
	BROWSE_PAGE_SIZE_VALUES,
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
	ROUTES,
	STUDY_PRIORITY_LABELS,
	STUDY_PRIORITY_VALUES,
	type StudyPriority,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
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
import { goto } from '$app/navigation';
import type { PageData } from './$types';
import { KNOWLEDGE_GROUP_BY_VALUES, type KnowledgeGroupByValue } from './group-by';

let { data }: { data: PageData } = $props();

const nodes = $derived(data.nodes);
const filters = $derived(data.filters);
const currentPage = $derived(data.page);
const hasMore = $derived(data.hasMore);
const total = $derived(data.total);
const totalPages = $derived(data.totalPages);
const pageSize = $derived(data.pageSize);
const groupBy = $derived(data.groupBy);
const facets = $derived(data.facets);

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
	return (STUDY_PRIORITY_LABELS as Record<StudyPriority, string>)[slug as StudyPriority] ?? humanize(slug);
}
function masteryPct(score: number): number {
	return Math.round(score * 100);
}
function fmtCount(n: number | undefined): string {
	return n === undefined ? '' : ` (${n})`;
}

function buildHref(next: Record<string, string | undefined>): string {
	const full: Record<string, string | number | null | undefined> = {
		[QUERY_PARAMS.DOMAIN]: filters.domain,
		[QUERY_PARAMS.CERT]: filters.cert,
		[QUERY_PARAMS.PRIORITY]: filters.priority,
		[QUERY_PARAMS.LIFECYCLE]: filters.lifecycle,
		[QUERY_PARAMS.PAGE_SIZE]: pageSize === BROWSE_PAGE_SIZE ? undefined : String(pageSize),
		[QUERY_PARAMS.GROUP_BY]: groupBy === 'domain' ? undefined : groupBy,
		...next,
	};
	return `${ROUTES.KNOWLEDGE}${buildQuery(full)}`;
}

function pageHref(n: number): string {
	return buildHref({ [QUERY_PARAMS.PAGE]: n > 1 ? String(n) : undefined });
}

const chips = $derived.by<FilterChipDef[]>(() => {
	const out: FilterChipDef[] = [];
	if (filters.domain)
		out.push({
			key: QUERY_PARAMS.DOMAIN,
			label: 'Domain',
			value: domainLabel(filters.domain),
			removeHref: buildHref({ [QUERY_PARAMS.DOMAIN]: undefined }),
		});
	if (filters.cert)
		out.push({
			key: QUERY_PARAMS.CERT,
			label: 'Cert',
			value: certLabel(filters.cert),
			removeHref: buildHref({ [QUERY_PARAMS.CERT]: undefined }),
		});
	if (filters.priority)
		out.push({
			key: QUERY_PARAMS.PRIORITY,
			label: 'Priority',
			value: priorityLabel(filters.priority),
			removeHref: buildHref({ [QUERY_PARAMS.PRIORITY]: undefined }),
		});
	if (filters.lifecycle)
		out.push({
			key: QUERY_PARAMS.LIFECYCLE,
			label: 'Lifecycle',
			value: lifecycleLabel(filters.lifecycle),
			removeHref: buildHref({ [QUERY_PARAMS.LIFECYCLE]: undefined }),
		});
	return out;
});

const groupByLabels: Record<KnowledgeGroupByValue, string> = {
	domain: 'Domain',
	cert: 'Cert',
	priority: 'Priority',
	lifecycle: 'Lifecycle',
	none: 'No grouping',
};

type NodeRow = (typeof nodes)[number];

// Sentinels for nodes that haven't been tagged yet (`minimumCert` /
// `studyPriority` are nullable until the author fills them in). Distinct
// per dimension so the heading reads naturally.
const UNTAGGED_CERT = '__untagged-cert__';
const UNTAGGED_PRIORITY = '__untagged-priority__';

function groupKey(n: NodeRow, by: KnowledgeGroupByValue): string {
	if (by === 'domain') return n.domain;
	if (by === 'cert') return n.minimumCert ?? UNTAGGED_CERT;
	if (by === 'priority') return n.studyPriority ?? UNTAGGED_PRIORITY;
	if (by === 'lifecycle') return n.lifecycle;
	return '';
}

function groupHeading(by: KnowledgeGroupByValue, key: string): string {
	if (key === UNTAGGED_CERT) return 'No minimum cert';
	if (key === UNTAGGED_PRIORITY) return 'No study priority';
	if (by === 'domain') return domainLabel(key);
	if (by === 'cert') return certLabel(key);
	if (by === 'priority') return priorityLabel(key);
	if (by === 'lifecycle') return lifecycleLabel(key);
	return '';
}

const groups = $derived.by<BrowseListGroup<NodeRow>[]>(() => {
	if (groupBy === 'none' || nodes.length === 0) {
		return [{ key: '', label: '', items: nodes as NodeRow[] }];
	}
	const map = new Map<string, NodeRow[]>();
	for (const n of nodes as NodeRow[]) {
		const k = groupKey(n, groupBy);
		const list = map.get(k) ?? [];
		list.push(n);
		map.set(k, list);
	}
	return [...map.entries()]
		.map(([k, items]) => ({ key: k, label: groupHeading(groupBy, k), items }))
		.sort((a, b) => a.label.localeCompare(b.label));
});
</script>

<svelte:head>
	<title>Knowledge -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<div class="title-row">
				<h1>Knowledge</h1>
				<PageHelp pageId="knowledge-graph" />
			</div>
			<p class="sub">
				The aviation knowledge graph. {total} node{total === 1 ? '' : 's'}; group by domain, cert, priority, or
				lifecycle, or browse flat.
			</p>
		</div>
	</header>

	<FilterCard resetHref={ROUTES.KNOWLEDGE} ariaLabel="Filter nodes">
		{#snippet hidden()}
			<input type="hidden" name={QUERY_PARAMS.PAGE} value="1" />
			<input
				type="hidden"
				name={QUERY_PARAMS.PAGE_SIZE}
				value={pageSize === BROWSE_PAGE_SIZE ? '' : String(pageSize)}
			/>
			<input type="hidden" name={QUERY_PARAMS.GROUP_BY} value={groupBy === 'domain' ? '' : groupBy} />
		{/snippet}
		{#snippet controls()}
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
				<label for="f-cert">Cert</label>
				<select id="f-cert" name={QUERY_PARAMS.CERT} value={filters.cert ?? ''}>
					<option value="">All</option>
					{#each CERT_VALUES as c (c)}
						<option value={c}>{certLabel(c)}{fmtCount(facets?.cert?.[c])}</option>
					{/each}
				</select>
			</div>
			<div class="filter">
				<label for="f-priority">Priority</label>
				<select id="f-priority" name={QUERY_PARAMS.PRIORITY} value={filters.priority ?? ''}>
					<option value="">All</option>
					{#each STUDY_PRIORITY_VALUES as p (p)}
						<option value={p}>{priorityLabel(p)}{fmtCount(facets?.priority?.[p])}</option>
					{/each}
				</select>
			</div>
			<div class="filter">
				<label for="f-lifecycle">Lifecycle</label>
				<select id="f-lifecycle" name={QUERY_PARAMS.LIFECYCLE} value={filters.lifecycle ?? ''}>
					<option value="">All</option>
					{#each NODE_LIFECYCLE_VALUES as l (l)}
						<option value={l}>{lifecycleLabel(l)}{fmtCount(facets?.lifecycle?.[l])}</option>
					{/each}
				</select>
			</div>
		{/snippet}
	</FilterCard>

	<BrowseViewControls
		{groupBy}
		groupByOptions={KNOWLEDGE_GROUP_BY_VALUES.map((g) => ({ value: g, label: groupByLabels[g] }))}
		onGroupBy={(v) => goto(buildHref({ [QUERY_PARAMS.GROUP_BY]: v === 'domain' ? undefined : v }))}
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

	<FilterChips {chips} clearHref={ROUTES.KNOWLEDGE} />

	<ResultSummary
		{total}
		pageCount={nodes.length}
		{currentPage}
		{pageSize}
		noun="node"
		filtersActive={hasActiveFilters}
	/>

	{#if nodes.length === 0}
		<div class="empty">
			{#if hasActiveFilters}
				<p>No knowledge nodes match these filters.</p>
				<a class="btn ghost" href={ROUTES.KNOWLEDGE}>Clear filters</a>
			{:else}
				<p>No knowledge nodes yet. Author one with <code>bun run knowledge:new</code>, then build.</p>
			{/if}
		</div>
	{:else}
		<BrowseList {groups}>
			{#snippet item(n)}
				<BrowseListItem href={ROUTES.KNOWLEDGE_SLUG(n.id)} id={`node-${n.id}`}>
					{#snippet title()}
						<div class="card-head">
							<span class="card-title">{n.title}</span>
							<span class="mastery" aria-label="Mastery {masteryPct(n.displayScore)} percent">
								<span class="mastery-bar">
									<span class="mastery-fill" style:width="{masteryPct(n.displayScore)}%"></span>
								</span>
								<span class="mastery-pct">{masteryPct(n.displayScore)}%</span>
							</span>
						</div>
					{/snippet}
					{#snippet meta()}
						<span class="badge lifecycle lifecycle-{n.lifecycle}">{lifecycleLabel(n.lifecycle)}</span>
						{#if n.minimumCert}
							<span class="badge cert">{certLabel(n.minimumCert)}+</span>
						{/if}
						{#if n.studyPriority}
							<span class="badge priority priority-{n.studyPriority}">{priorityLabel(n.studyPriority)}</span>
						{/if}
						{#if n.estimatedTimeMinutes}
							<span class="badge time">{n.estimatedTimeMinutes}m</span>
						{/if}
						{#if n.mastered}
							<span class="badge mastered">Mastered</span>
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

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
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
		font-weight: 600;
	}

	.mastery {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		min-width: 8rem;
	}

	.mastery-bar {
		flex: 1;
		height: 0.4rem;
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
		transition: width var(--motion-fast);
	}

	.mastery-pct {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
		font-variant-numeric: tabular-nums;
		min-width: 2.5em;
		text-align: right;
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
		color: var(--accent-code);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.lifecycle-skeleton {
		color: var(--ink-muted);
		background: var(--surface-sunken);
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

	.badge.priority-critical {
		color: var(--action-hazard-hover);
		background: var(--action-hazard-wash);
		border-color: var(--action-hazard-edge);
	}

	.badge.priority-standard {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.priority-stretch {
		color: var(--ink-muted);
		background: var(--surface-sunken);
	}

	.badge.mastered {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
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

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
		border-color: transparent;
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}
</style>
