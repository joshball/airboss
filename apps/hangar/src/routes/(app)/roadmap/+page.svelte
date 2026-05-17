<script lang="ts">
/**
 * `/roadmap` -- read-only WP browser landing page (Phase 8 of
 * `tracking-system-overhaul`). The server load reads frontmatter via
 * `wp-loader.ts` and applies URL-shareable filters; this component renders
 * the chip / search / table UI.
 *
 * Filter state is persisted in the URL by emitting plain `<a>` links for
 * each chip rather than mutating state client-side. That keeps the page
 * usable with JS disabled and makes every view bookmarkable.
 *
 * Search is client-side: the loader returns the full filtered set and we
 * narrow it further by id + title substring. The total set (102 today, ~200
 * before the WP corpus is fully migrated) is small enough that an in-memory
 * substring filter is faster + simpler than a server round-trip per
 * keystroke.
 */

import {
	ROADMAP_QUERY_PARAMS,
	ROUTES,
	WP_CATEGORIES,
	WP_HUMAN_REVIEW_STATUSES,
	WP_PRODUCTS,
	WP_STATUSES,
	type WPStatus,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// `searchTerm` is seeded from the URL-synced filter state on first mount;
// after that the user types freely. Reading `data.filters.search` once at
// init (not via `$derived`) is intentional -- subsequent navigations land
// the new server-rendered value as the initial state of a fresh component
// instance. Svelte's "state_referenced_locally" warning flags the read,
// silenced via the standard `untrack`-equivalent: an immediately-invoked
// init expression that the compiler can prove runs once.
let searchTerm = $state(initialSearch());
function initialSearch(): string {
	return data.filters.search;
}

const filteredRows = $derived.by(() => {
	const term = searchTerm.trim().toLowerCase();
	if (term === '') return data.rows;
	return data.rows.filter((row) => `${row.id} ${row.title}`.toLowerCase().includes(term));
});

/** Group rows by status; unparseable WPs go in a synthetic `unparseable`
 * bucket that surfaces above the lifecycle ones so they're not lost. */
const groupedRows = $derived.by(() => {
	type Group = { key: string; label: string; rows: typeof filteredRows };
	const groups: Group[] = [];
	const buckets = new Map<string, Group>();
	function ensure(key: string, label: string): Group {
		const existing = buckets.get(key);
		if (existing) return existing;
		const group: Group = { key, label, rows: [] };
		buckets.set(key, group);
		groups.push(group);
		return group;
	}
	// Stable, intentional order: unparseable first (visible problems),
	// then lifecycle in the order ADR 025 documents.
	ensure('unparseable', 'Unparseable');
	for (const status of WP_STATUSES) ensure(status, statusLabel(status));
	for (const row of filteredRows) {
		const key = row.status ?? 'unparseable';
		ensure(key, key === 'unparseable' ? 'Unparseable' : statusLabel(key as WPStatus)).rows.push(row);
	}
	return groups.filter((g) => g.rows.length > 0);
});

function statusLabel(s: WPStatus): string {
	switch (s) {
		case 'draft':
			return 'Draft';
		case 'signed-off':
			return 'Signed off';
		case 'in-flight':
			return 'In flight';
		case 'shipped':
			return 'Shipped';
		case 'abandoned':
			return 'Abandoned';
		case 'superseded':
			return 'Superseded';
	}
}

/** Build a URL that reflects a single facet selection while preserving
 * every other active filter. Passing `null` for `value` clears the filter. */
function urlFor(param: keyof typeof ROADMAP_QUERY_PARAMS, value: string | null): string {
	const params = new URLSearchParams();
	if (data.filters.product !== null) params.set(ROADMAP_QUERY_PARAMS.PRODUCT, data.filters.product);
	if (data.filters.category !== null) params.set(ROADMAP_QUERY_PARAMS.CATEGORY, data.filters.category);
	if (data.filters.status !== null) params.set(ROADMAP_QUERY_PARAMS.STATUS, data.filters.status);
	if (data.filters.humanReview !== null) params.set(ROADMAP_QUERY_PARAMS.HUMAN_REVIEW, data.filters.humanReview);
	if (data.filters.tag !== null) params.set(ROADMAP_QUERY_PARAMS.TAG, data.filters.tag);
	if (data.filters.search !== '') params.set(ROADMAP_QUERY_PARAMS.SEARCH, data.filters.search);
	const target = ROADMAP_QUERY_PARAMS[param];
	if (value === null || value === '') {
		params.delete(target);
	} else {
		params.set(target, value);
	}
	const qs = params.toString();
	return qs === '' ? ROUTES.HANGAR_ROADMAP : `${ROUTES.HANGAR_ROADMAP}?${qs}`;
}

function isActive(param: keyof typeof ROADMAP_QUERY_PARAMS, value: string | null): boolean {
	switch (param) {
		case 'PRODUCT':
			return data.filters.product === value;
		case 'CATEGORY':
			return data.filters.category === value;
		case 'STATUS':
			return data.filters.status === value;
		case 'HUMAN_REVIEW':
			return data.filters.humanReview === value;
		case 'TAG':
			return data.filters.tag === value;
		default:
			return false;
	}
}

const anyFilterActive = $derived(
	data.filters.product !== null ||
		data.filters.category !== null ||
		data.filters.status !== null ||
		data.filters.humanReview !== null ||
		data.filters.tag !== null ||
		data.filters.search !== '',
);
</script>

<svelte:head>
	<title>Roadmap - Hangar</title>
</svelte:head>

<div class="roadmap">
	<header class="page-header">
		<div>
			<h1>Roadmap</h1>
			<p class="hint">
				Read-only browser of every <code>docs/work-packages/&lt;slug&gt;/spec.md</code> frontmatter. Mutate via
				<code>bun run wp set</code>; see the
				<a href={ROUTES.HANGAR_DOCS_PATH('docs/decisions/025-wp-frontmatter-contract/decision.md')}>
					ADR 025 contract
				</a>. This dashboard tracks <em>process</em> -- where work packages stand. For <em>content</em> --
				what learning material exists and what is missing -- see the
				<a href={ROUTES.CONTENT_CENSUS}>Content census</a>.
			</p>
		</div>
		<div class="counts" aria-label="Counts">
			<span class="count">
				<strong>{data.filteredCount}</strong> shown
			</span>
			<span class="count">
				<strong>{data.totalCount}</strong> total
			</span>
			<PageHelp pageId="roadmap" />
		</div>
	</header>

	<section class="search" aria-label="Search">
		<label for="roadmap-search">Search id or title</label>
		<input
			id="roadmap-search"
			type="search"
			bind:value={searchTerm}
			placeholder="e.g. cert-dashboard"
			autocomplete="off"
		/>
	</section>

	<section class="facets" aria-label="Filters">
		<details open>
			<summary>Product</summary>
			<ul class="chips">
				{#each WP_PRODUCTS as product (product)}
					{@const facet = data.facets.products.find((f) => f.value === product)}
					{@const count = facet?.count ?? 0}
					{#if count > 0 || isActive('PRODUCT', product)}
						<li>
							<a
								class="chip"
								class:active={isActive('PRODUCT', product)}
								href={urlFor('PRODUCT', isActive('PRODUCT', product) ? null : product)}
								aria-current={isActive('PRODUCT', product) ? 'true' : undefined}
							>
								{product} <span class="chip-count">{count}</span>
							</a>
						</li>
					{/if}
				{/each}
			</ul>
		</details>
		<details open>
			<summary>Category</summary>
			<ul class="chips">
				{#each WP_CATEGORIES as category (category)}
					{@const facet = data.facets.categories.find((f) => f.value === category)}
					{@const count = facet?.count ?? 0}
					{#if count > 0 || isActive('CATEGORY', category)}
						<li>
							<a
								class="chip"
								class:active={isActive('CATEGORY', category)}
								href={urlFor('CATEGORY', isActive('CATEGORY', category) ? null : category)}
								aria-current={isActive('CATEGORY', category) ? 'true' : undefined}
							>
								{category} <span class="chip-count">{count}</span>
							</a>
						</li>
					{/if}
				{/each}
			</ul>
		</details>
		<details>
			<summary>Status</summary>
			<ul class="chips">
				{#each WP_STATUSES as status (status)}
					{@const facet = data.facets.statuses.find((f) => f.value === status)}
					{@const count = facet?.count ?? 0}
					{#if count > 0 || isActive('STATUS', status)}
						<li>
							<a
								class="chip"
								class:active={isActive('STATUS', status)}
								href={urlFor('STATUS', isActive('STATUS', status) ? null : status)}
								aria-current={isActive('STATUS', status) ? 'true' : undefined}
							>
								{status} <span class="chip-count">{count}</span>
							</a>
						</li>
					{/if}
				{/each}
			</ul>
		</details>
		<details>
			<summary>Human review</summary>
			<ul class="chips">
				{#each WP_HUMAN_REVIEW_STATUSES as state (state)}
					{@const facet = data.facets.humanReviews.find((f) => f.value === state)}
					{@const count = facet?.count ?? 0}
					{#if count > 0 || isActive('HUMAN_REVIEW', state)}
						<li>
							<a
								class="chip"
								class:active={isActive('HUMAN_REVIEW', state)}
								href={urlFor('HUMAN_REVIEW', isActive('HUMAN_REVIEW', state) ? null : state)}
								aria-current={isActive('HUMAN_REVIEW', state) ? 'true' : undefined}
							>
								{state} <span class="chip-count">{count}</span>
							</a>
						</li>
					{/if}
				{/each}
			</ul>
		</details>
		{#if data.allTags.length > 0}
			<details>
				<summary>Tags</summary>
				<ul class="chips">
					{#each data.allTags as tag (tag)}
						<li>
							<a
								class="chip"
								class:active={isActive('TAG', tag)}
								href={urlFor('TAG', isActive('TAG', tag) ? null : tag)}
								aria-current={isActive('TAG', tag) ? 'true' : undefined}
							>
								{tag}
							</a>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
		{#if anyFilterActive}
			<div class="clear">
				<a href={ROUTES.HANGAR_ROADMAP}>Clear all filters</a>
			</div>
		{/if}
	</section>

	{#if filteredRows.length === 0}
		<p class="empty">No work packages match these filters.</p>
	{/if}

	{#each groupedRows as group (group.key)}
		<section class="group" aria-label={group.label}>
			<h2>
				{group.label}
				<span class="group-count">({group.rows.length})</span>
			</h2>
			<table>
				<thead>
					<tr>
						<th scope="col">ID</th>
						<th scope="col">Title</th>
						<th scope="col">Product</th>
						<th scope="col">Category</th>
						<th scope="col">Agent</th>
						<th scope="col">Human</th>
						<th scope="col">Errors</th>
					</tr>
				</thead>
				<tbody>
					{#each group.rows as row (row.id)}
						<tr class:invalid={row.validationErrorCount > 0}>
							<td><a href={ROUTES.HANGAR_ROADMAP_DETAIL(row.id)}>{row.id}</a></td>
							<td>{row.title}</td>
							<td>{row.product ?? ''}</td>
							<td>{row.category ?? ''}</td>
							<td>
								{#if row.agentReview}
									<span class="pill" data-state={row.agentReview}>{row.agentReview}</span>
								{/if}
							</td>
							<td>
								{#if row.humanReview}
									<span class="pill" data-state={row.humanReview}>{row.humanReview}</span>
								{/if}
							</td>
							<td>
								{#if row.validationErrorCount > 0}
									<span class="pill" data-state="error">{row.validationErrorCount}</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/each}
</div>

<style>
	.roadmap {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		gap: var(--space-md);
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.page-header h1 {
		margin: 0;
	}

	.hint {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.hint code {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		background: var(--surface-sunken);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
	}

	.counts {
		display: flex;
		gap: var(--space-md);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.count strong {
		color: var(--ink-body);
		font-family: var(--font-family-mono);
	}

	.search {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.search label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.search input {
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		background: var(--surface-page);
		color: var(--ink-body);
		border-radius: var(--radius-sm);
		font: inherit;
	}

	.search input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.facets {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
	}

	.facets details summary {
		cursor: pointer;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		padding: var(--space-2xs) 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
		padding: var(--space-2xs) 0 0;
		margin: 0;
		list-style: none;
	}

	.chips li {
		list-style: none;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill, 999px);
		background: var(--surface-page);
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		text-decoration: none;
		border: 1px solid var(--edge-default);
	}

	.chip:hover {
		border-color: var(--action-default);
	}

	.chip.active {
		background: var(--action-default-wash);
		border-color: var(--action-default);
		color: var(--action-default-ink, var(--ink-body));
	}

	.chip:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.chip-count {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.chip.active .chip-count {
		color: inherit;
	}

	.clear a {
		color: var(--link-default);
		font-size: var(--type-ui-label-size);
	}

	.empty {
		color: var(--ink-muted);
		font-style: italic;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.group h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
		display: flex;
		gap: var(--space-2xs);
		align-items: baseline;
	}

	.group-count {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
	}

	table {
		border-collapse: collapse;
		width: 100%;
	}

	th,
	td {
		text-align: left;
		padding: var(--space-2xs) var(--space-sm);
		border-bottom: 1px solid var(--edge-default);
		vertical-align: top;
	}

	th {
		background: var(--surface-sunken);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	tr.invalid td:first-child::before {
		content: '! ';
		color: var(--signal-warning-ink);
	}

	td a {
		color: var(--link-default);
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		text-decoration: none;
	}

	td a:hover {
		text-decoration: underline;
	}

	.pill {
		display: inline-block;
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}

	.pill[data-state='done'],
	.pill[data-state='signed-off'] {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	.pill[data-state='walked'] {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}

	.pill[data-state='pending'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}

	.pill[data-state='error'] {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
	}
</style>
