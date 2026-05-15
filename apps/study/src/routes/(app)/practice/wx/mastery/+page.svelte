<script lang="ts">
import { QUERY_PARAMS, ROUTES } from '@ab/constants';
import type { WxPracticeProduct } from '$lib/types/wx-practice-mastery-contract';
import {
	relativeLastSeen,
	stateLabel,
	WX_MASTERY_PRODUCTS,
	WX_MASTERY_SORT_KEYS,
	WX_MASTERY_STATE_FILTERS,
	type WxMasteryDisplayState,
	type WxMasterySortKey,
} from './_lib/types';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const product = $derived(data.product);
const stateFilters = $derived(data.stateFilters);
const sort = $derived(data.sort);
const rows = $derived(data.rows);
const weakFamilies = $derived(data.weakFamilies);
const summary = $derived(data.summary);
const tabs = $derived(data.tabs);

/** True when the active product has zero attempted families. Drives the empty state. */
const isEmpty = $derived(summary.attemptedFamilies === 0);

/**
 * Build a `/practice/wx/mastery` URL preserving every filter except the
 * keys this caller wants to change. Used by every nav/tab/chip on the page
 * so the URL stays the single source of truth.
 */
function buildHref(overrides: {
	product?: WxPracticeProduct;
	state?: ReadonlyArray<WxMasteryDisplayState> | null;
	sort?: WxMasterySortKey;
}): string {
	const params = new URLSearchParams();
	const nextProduct = overrides.product ?? product;
	params.set(QUERY_PARAMS.PRODUCT, nextProduct);
	const nextStates = overrides.state === undefined ? stateFilters : overrides.state;
	if (nextStates !== null && nextStates.length > 0 && nextStates.length < WX_MASTERY_STATE_FILTERS.length) {
		params.set(QUERY_PARAMS.STATE, nextStates.join(','));
	} else if (nextStates !== null && nextStates.length === 0) {
		params.set(QUERY_PARAMS.STATE, '');
	}
	const nextSort = overrides.sort ?? sort;
	if (nextSort !== 'attempts') params.set(QUERY_PARAMS.SORT, nextSort);
	const qs = params.toString();
	return qs ? `${ROUTES.PRACTICE_WX_MASTERY}?${qs}` : ROUTES.PRACTICE_WX_MASTERY;
}

/** Toggle a state filter chip. Multi-select. */
function toggleStateHref(target: WxMasteryDisplayState): string {
	const set = new Set(stateFilters);
	if (set.has(target)) set.delete(target);
	else set.add(target);
	// Preserve the document order of WX_MASTERY_STATE_FILTERS for stable URLs.
	const next = WX_MASTERY_STATE_FILTERS.filter((s) => set.has(s));
	return buildHref({ state: next });
}

/** Drill-weak href: pre-seed the drill page with the worst families. */
const drillWeakHref = $derived.by(() => {
	const params = new URLSearchParams();
	params.set(QUERY_PARAMS.PRODUCT, product);
	if (weakFamilies.length > 0) params.set(QUERY_PARAMS.FAMILIES, weakFamilies.join(','));
	return `${ROUTES.PRACTICE_WX_DRILL}?${params.toString()}`;
});

/** Drill-current href used by the empty state. */
const drillCurrentHref = $derived(
	`${ROUTES.PRACTICE_WX_DRILL}?${new URLSearchParams({ [QUERY_PARAMS.PRODUCT]: product }).toString()}`,
);

/** Human-friendly sort labels. */
const SORT_LABELS: Record<WxMasterySortKey, string> = {
	attempts: 'Most attempts',
	ratio: 'Lowest ratio',
	'last-seen': 'Most recent',
	label: 'A-Z',
};

/** Format ratio as a percentage. Null ratios show as em-dash. */
function ratioLabel(r: number | null): string {
	if (r === null) return '--';
	return `${Math.round(r * 100)}%`;
}
</script>

<svelte:head>
	<title>Weather mastery -- Practice -- airboss</title>
</svelte:head>

<section class="page" data-testid="wx-mastery-page">
	<nav aria-label="Breadcrumb">
		<ol class="crumb">
			<li><a href={ROUTES.STUDY}>Study</a></li>
			<li><a href={ROUTES.PRACTICE_WX_DRILL}>Practice</a></li>
			<li aria-current="page">Weather mastery</li>
		</ol>
	</nav>

	<header class="hd">
		<div class="title-row">
			<div>
				<h1 data-testid="page-anchor">Weather mastery</h1>
				<p class="lede">
					Per-token-family fluency across the encoded weather products. Read across the heatmap to spot the
					families you have not been quizzed on; read down the grid to find the ones you keep missing.
				</p>
			</div>
			<a
				class="drill-weak"
				href={drillWeakHref}
				data-testid="drill-weak-button"
				aria-disabled={weakFamilies.length === 0 ? 'true' : undefined}
			>
				Drill my weak families
				{#if weakFamilies.length > 0}
					<span class="drill-weak-count">({weakFamilies.length})</span>
				{/if}
			</a>
		</div>
	</header>

	<!-- Product picker tabs -->
	<nav class="tabs" aria-label="Product">
		{#each tabs as tab (tab.product)}
			{@const isActive = tab.product === product}
			<a
				class="tab"
				class:active={isActive}
				href={buildHref({ product: tab.product })}
				aria-current={isActive ? 'page' : undefined}
				data-testid={`product-tab-${tab.product}`}
			>
				<span class="tab-label">{tab.label}</span>
				<span class="tab-meta">{tab.attemptedCount} / {tab.familyCount}</span>
			</a>
		{/each}
	</nav>

	<!-- Heatmap of every catalog family for the active product -->
	<section class="heatmap" aria-label="Mastery heatmap">
		<div class="heatmap-grid" role="list">
			{#each rows as row (row.family)}
				<span
					class="cell state-{row.state}"
					role="listitem"
					data-testid="heatmap-cell"
					data-state={row.state}
					title="{row.label} -- {stateLabel(row.state)}{row.ratio !== null
						? ' -- ' + ratioLabel(row.ratio)
						: ''}"
				>
					<span class="visually-hidden">{row.label} -- {stateLabel(row.state)}</span>
				</span>
			{/each}
		</div>
		<dl class="heatmap-legend" aria-label="State counts">
			<div class="legend-item state-active">
				<dt>Active</dt>
				<dd>{summary.activeCount}</dd>
			</div>
			<div class="legend-item state-passive">
				<dt>Passive</dt>
				<dd>{summary.passiveCount}</dd>
			</div>
			<div class="legend-item state-demoted">
				<dt>Demoted</dt>
				<dd>{summary.demotedCount}</dd>
			</div>
			<div class="legend-item state-never-seen">
				<dt>Never seen</dt>
				<dd>{summary.neverSeenCount}</dd>
			</div>
		</dl>
	</section>

	<!-- Filter + sort controls -->
	<section class="controls" aria-label="Filters">
		<div class="chip-row" role="group" aria-label="State filter">
			<span class="chip-label">State</span>
			{#each WX_MASTERY_STATE_FILTERS as filterState (filterState)}
				{@const active = stateFilters.includes(filterState)}
				<a
					class="chip state-{filterState}"
					class:chip-active={active}
					href={toggleStateHref(filterState)}
					aria-current={active ? 'true' : undefined}
					data-active={active ? 'true' : 'false'}
					data-testid={`state-chip-${filterState}`}
				>
					{stateLabel(filterState)}
				</a>
			{/each}
		</div>
		<div class="chip-row" role="group" aria-label="Sort">
			<span class="chip-label">Sort by</span>
			{#each WX_MASTERY_SORT_KEYS as sortKey (sortKey)}
				{@const active = sortKey === sort}
				<a
					class="chip"
					class:chip-active={active}
					href={buildHref({ sort: sortKey })}
					aria-current={active ? 'true' : undefined}
					data-active={active ? 'true' : 'false'}
					data-testid={`sort-chip-${sortKey}`}
				>
					{SORT_LABELS[sortKey]}
				</a>
			{/each}
		</div>
	</section>

	{#if isEmpty}
		<section class="empty" data-testid="mastery-empty">
			<h2>You have not been quizzed on these yet.</h2>
			<p>
				The mastery grid lights up as you drill encoded weather products. Run a short {tabs.find(
					(t) => t.product === product,
				)?.label} drill -- after a handful of items, you will see which token families are coming easily and which
				ones need another pass.
			</p>
			<a class="empty-cta" href={drillCurrentHref} data-testid="empty-start-drill">Start a drill</a>
		</section>
	{:else if rows.length === 0}
		<section class="empty empty-filtered" data-testid="mastery-empty-filtered">
			<h2>No families match the current filters.</h2>
			<p>Add a state filter back -- you have data for other states.</p>
			<a class="empty-cta empty-cta-secondary" href={buildHref({ state: null })}>Clear filters</a>
		</section>
	{:else}
		<table class="grid" data-testid="mastery-grid">
			<thead>
				<tr>
					<th scope="col" class="col-family">Family</th>
					<th scope="col" class="col-num">Attempts</th>
					<th scope="col" class="col-num">Ratio</th>
					<th scope="col" class="col-state">State</th>
					<th scope="col" class="col-time">Last seen</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.family)}
					<tr data-family={row.family} data-state={row.state} data-testid="mastery-row">
						<th scope="row" class="col-family">
							<span class="family-label">{row.label}</span>
							<code class="family-slug">{row.family}</code>
						</th>
						<td class="col-num">{row.attempts}</td>
						<td class="col-num ratio">
							<span class="ratio-value">{ratioLabel(row.ratio)}</span>
							{#if row.ratio !== null}
								<span class="ratio-detail">{row.correct} / {row.attempts}</span>
							{/if}
						</td>
						<td class="col-state">
							<span class="state-chip state-{row.state}">{stateLabel(row.state)}</span>
						</td>
						<td class="col-time">{relativeLastSeen(row.lastSeenAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.crumb {
		display: flex;
		gap: var(--space-sm);
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.crumb li + li::before {
		content: '/';
		margin-right: var(--space-sm);
		color: var(--ink-faint);
	}

	.crumb a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	.hd h1 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.lede {
		margin: 0;
		font-size: var(--type-reading-lead-size);
		color: var(--ink-muted);
		line-height: 1.5;
		max-width: 50rem;
	}

	.drill-weak {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-lg);
		background: var(--action-default);
		color: var(--action-default-ink);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		text-decoration: none;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.drill-weak:hover {
		background: var(--action-default-hover);
		color: var(--ink-inverse);
	}

	.drill-weak[aria-disabled='true'] {
		opacity: 0.45;
		pointer-events: none;
	}

	.drill-weak-count {
		font-variant-numeric: tabular-nums;
		color: var(--ink-muted);
	}

	.drill-weak:hover .drill-weak-count {
		color: var(--ink-inverse);
	}

	.tabs {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
		border-bottom: 1px solid var(--edge-default);
		padding-bottom: var(--space-xs);
	}

	.tab {
		display: inline-flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		text-decoration: none;
		color: var(--ink-muted);
		border: 1px solid transparent;
		border-bottom-color: transparent;
	}

	.tab:hover {
		background: var(--surface-muted);
		color: var(--ink-body);
	}

	.tab.active {
		color: var(--ink-body);
		border-color: var(--edge-default);
		border-bottom-color: var(--surface-panel);
		background: var(--surface-panel);
	}

	.tab-label {
		font-weight: 600;
		font-size: var(--type-ui-label-size);
	}

	.tab-meta {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}

	.heatmap {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-muted);
		border-radius: var(--radius-lg);
		border: 1px solid var(--edge-default);
	}

	.heatmap-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(1.5rem, 1fr));
		gap: var(--space-2xs);
	}

	.cell {
		display: block;
		aspect-ratio: 1;
		border-radius: var(--radius-xs);
		border: 1px solid transparent;
		cursor: help;
		transition: transform var(--motion-fast);
	}

	.cell:hover {
		transform: scale(1.15);
	}

	.cell.state-passive {
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.cell.state-active {
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.cell.state-demoted {
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.cell.state-never-seen {
		background: var(--surface-panel);
		border-color: var(--edge-default);
	}

	.heatmap-legend {
		display: flex;
		gap: var(--space-lg);
		flex-wrap: wrap;
		margin: 0;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--type-ui-caption-size);
	}

	.legend-item dt {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-weight: 600;
	}

	.legend-item dt::before {
		content: '';
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: var(--radius-xs);
		border: 1px solid var(--edge-strong);
	}

	.legend-item.state-passive dt::before {
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.legend-item.state-active dt::before {
		background: var(--surface-sunken);
	}

	.legend-item.state-demoted dt::before {
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.legend-item.state-never-seen dt::before {
		background: var(--surface-panel);
		border-color: var(--edge-default);
	}

	.legend-item dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--ink-body);
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.chip-row {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.chip-label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		margin-right: var(--space-sm);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		background: var(--surface-panel);
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		transition: background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast);
	}

	.chip:hover {
		border-color: var(--edge-strong);
		color: var(--ink-body);
	}

	.chip.chip-active {
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		border-color: var(--action-default-edge);
	}

	.chip.state-passive.chip-active {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
		border-color: var(--signal-success-edge);
	}

	.chip.state-demoted.chip-active {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
		border-color: var(--signal-warning-edge);
	}

	.chip.state-never-seen.chip-active {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-md);
		padding: var(--space-xl) var(--space-2xl);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-lg);
	}

	.empty.empty-filtered {
		background: var(--surface-muted);
		border-color: var(--edge-default);
	}

	.empty h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
		letter-spacing: -0.01em;
	}

	.empty p {
		margin: 0;
		color: var(--ink-muted);
		max-width: 42rem;
		line-height: 1.5;
	}

	.empty-cta {
		display: inline-flex;
		align-items: center;
		padding: var(--space-sm) var(--space-lg);
		background: var(--action-default);
		color: var(--action-default-ink);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
		font-weight: 600;
		text-decoration: none;
		transition: background var(--motion-fast);
	}

	.empty-cta:hover {
		background: var(--action-default-hover);
		color: var(--ink-inverse);
	}

	.empty-cta.empty-cta-secondary {
		background: var(--surface-panel);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.empty-cta.empty-cta-secondary:hover {
		background: var(--surface-muted);
		color: var(--ink-body);
	}

	.grid {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-definition-body-size);
	}

	.grid th,
	.grid td {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--edge-default);
		vertical-align: top;
	}

	.grid thead th {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
		font-weight: 600;
		border-bottom: 1px solid var(--edge-strong);
	}

	.col-num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.col-state {
		white-space: nowrap;
	}

	.col-time {
		white-space: nowrap;
		color: var(--ink-muted);
	}

	.family-label {
		display: block;
		color: var(--ink-body);
		font-weight: 600;
	}

	.family-slug {
		display: block;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
	}

	.ratio {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		align-items: flex-end;
	}

	.ratio-value {
		font-weight: 600;
		color: var(--ink-body);
	}

	.ratio-detail {
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
	}

	.state-chip {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.state-chip.state-active {
		background: var(--surface-sunken);
		color: var(--ink-muted);
		border-color: var(--edge-strong);
	}

	.state-chip.state-passive {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
		border-color: var(--signal-success-edge);
	}

	.state-chip.state-demoted {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
		border-color: var(--signal-warning-edge);
	}

	.state-chip.state-never-seen {
		background: var(--surface-panel);
		color: var(--ink-faint);
		border-color: var(--edge-default);
	}

	.visually-hidden {
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		height: 1px;
		overflow: hidden;
		position: absolute;
		white-space: nowrap;
		width: 1px;
	}
</style>
