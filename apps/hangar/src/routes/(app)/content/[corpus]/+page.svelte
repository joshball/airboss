<script lang="ts">
/**
 * `/content/[corpus]` -- generic per-corpus census drill-down
 * (hangar-content-census WP, Phase 1).
 *
 * ONE component renders every corpus. The server passes a `CorpusCensus`;
 * this page renders, in order: overview prose (what the corpus is, why it
 * exists, governing docs), the inventory, the gap view, the intent view, and
 * the value-ranked "next" list.
 *
 * For a stub corpus (`mode === 'stub'`) the page renders the honest
 * "drill-down pending" placeholder instead of inventory / gaps / next --
 * never fabricated data.
 *
 * Every metric and gap is rendered with its what-it-measures /
 * why-it-matters / what-to-do triad: the explanatory-surface requirement.
 * This component is a dumb renderer; the explanations are authored in the
 * adapter.
 */

import { ROUTES } from '@ab/constants';
import type { CorpusCensus } from '@ab/content-census';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const census: CorpusCensus = $derived(data.census);
const isStub = $derived(census.mode === 'stub');

/** Sort the next-list so `high`-value items lead. */
const valueRank: Record<string, number> = { high: 0, standard: 1, low: 2 };
const rankedNext = $derived(
	[...census.next].sort((a, b) => (valueRank[a.value] ?? 9) - (valueRank[b.value] ?? 9)),
);

/** Items carrying a Layer-2 intent block -- the intent view renders these. */
const itemsWithIntent = $derived(census.items.filter((item) => item.intent !== undefined));
</script>

<svelte:head>
	<title>{census.label} - Content census - Hangar</title>
</svelte:head>

<div class="drilldown">
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<a href={ROUTES.CONTENT_CENSUS}>Content census</a>
		<span aria-hidden="true">/</span>
		<span class="current">{census.label}</span>
	</nav>

	<header class="page-header">
		<h1>{census.label}</h1>
		{#if isStub}
			<span class="mode-tag mode-stub">Census pending</span>
		{:else}
			<span class="mode-tag mode-full">Full census</span>
		{/if}
	</header>

	<!-- Overview: what the corpus is, why it exists, where it lives, the docs. -->
	<section class="overview" aria-label="Overview">
		<p class="lead">{census.whatItIs}</p>
		<p class="why"><strong>Why it exists.</strong> {census.whyItExists}</p>
		<dl class="facts">
			<div>
				<dt>Location</dt>
				<dd><code>{census.location}</code></dd>
			</div>
			<div>
				<dt>Derived-state rule</dt>
				<dd>{census.stateRule}</dd>
			</div>
		</dl>
		{#if census.docs.length > 0}
			<div class="docs">
				<h2>Governing documents</h2>
				<ul>
					{#each census.docs as doc (doc.href)}
						<li>
							<a href={doc.href}>{doc.label}</a>
							<span class="doc-role">{doc.role}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	{#if isStub && census.pending}
		<!-- Honest placeholder: no fabricated inventory / metrics / gaps. -->
		<section class="pending" aria-label="Census pending">
			<h2>Drill-down pending</h2>
			<p>{census.pending.message}</p>
			<p>
				<a href={census.pending.href}>See the content-census Phase 2 tasks</a> for the schedule of this
				corpus's real adapter.
			</p>
		</section>
	{:else}
		<!-- Metrics: every number carries the what / why / do triad. -->
		{#if census.metrics.length > 0}
			<section class="metrics" aria-label="Metrics">
				<h2>Metrics</h2>
				<div class="metric-grid">
					{#each census.metrics as metric (metric.key)}
						<article class="metric">
							<header>
								<span class="metric-label">{metric.label}</span>
								<span class="metric-value">{metric.value}</span>
							</header>
							<p class="explain">
								<span class="explain-label">What it measures.</span>
								{metric.whatItMeasures}
							</p>
							<p class="explain">
								<span class="explain-label">Why it matters.</span>
								{metric.whyItMatters}
							</p>
							{#if metric.whatToDo}
								<p class="explain">
									<span class="explain-label">What to do.</span>
									{#if metric.whatToDo.href}
										<a href={metric.whatToDo.href}>{metric.whatToDo.text}</a>
									{:else}
										{metric.whatToDo.text}
									{/if}
								</p>
							{/if}
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Gap view: each gap fully explained, severity-tagged. -->
		{#if census.gaps.length > 0}
			<section class="gaps" aria-label="Gap view">
				<h2>Gap view</h2>
				<div class="gap-list">
					{#each census.gaps as gap (gap.title)}
						<article class="gap">
							<header>
								<span class="gap-title">{gap.title}</span>
								<span class="severity" data-severity={gap.severity}>{gap.severity}</span>
							</header>
							<p class="explain">
								<span class="explain-label">What it is.</span>
								{gap.whatItMeasures}
							</p>
							<p class="explain">
								<span class="explain-label">Why it matters.</span>
								{gap.whyItMatters}
							</p>
							<p class="explain">
								<span class="explain-label">What to do.</span>
								{#if gap.whatToDo.href}
									<a href={gap.whatToDo.href}>{gap.whatToDo.text}</a>
								{:else}
									{gap.whatToDo.text}
								{/if}
							</p>
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Intent view: Layer-2 frontmatter, where present. -->
		<section class="intent" aria-label="Intent view">
			<h2>Intent view</h2>
			{#if itemsWithIntent.length === 0}
				<p class="empty">
					No content-intent (Layer 2) is captured for this corpus yet. Once the content-intent ADR is
					approved, items carry a <code>planned</code> / <code>wanted</code> / <code>value</code> block in
					their frontmatter, and it surfaces here. An item with no block shows as "no plan captured" -- the
					absence is itself a triage signal.
				</p>
			{:else}
				<ul class="intent-list">
					{#each itemsWithIntent as item (item.id)}
						{@const intent = item.intent}
						{#if intent}
							<li>
								<span class="intent-item">{item.label}</span>
								<span class="intent-status" data-status={intent.contentStatus}>{intent.contentStatus}</span>
								<span class="intent-value">value: {intent.value}</span>
								{#if intent.planned.length > 0}
									<ul class="intent-sub">
										{#each intent.planned as plan (plan)}
											<li>planned: {plan}</li>
										{/each}
									</ul>
								{/if}
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Next: synthesised, value-ranked "what to do next". -->
		{#if rankedNext.length > 0}
			<section class="next" aria-label="What to do next">
				<h2>Next</h2>
				<ol class="next-list">
					{#each rankedNext as item (item.text)}
						<li>
							<span class="next-value" data-value={item.value}>{item.value}</span>
							<div class="next-body">
								{#if item.href}
									<a class="next-text" href={item.href}>{item.text}</a>
								{:else}
									<span class="next-text">{item.text}</span>
								{/if}
								<span class="next-rationale">{item.rationale}</span>
							</div>
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<!-- Inventory: the item list with derived state. -->
		{#if census.items.length > 0}
			<section class="inventory" aria-label="Inventory">
				<h2>Inventory <span class="count">({census.items.length})</span></h2>
				<table>
					<thead>
						<tr>
							<th scope="col">Item</th>
							<th scope="col">State</th>
							<th scope="col">Detail</th>
						</tr>
					</thead>
					<tbody>
						{#each census.items as item (item.id)}
							<tr>
								<td class="item-id">
									{#if item.href}
										<a href={item.href}>{item.label}</a>
									{:else}
										{item.label}
									{/if}
								</td>
								<td>
									<span class="state" data-state={item.derivedState}>{item.derivedState}</span>
								</td>
								<td class="item-detail">{item.detail ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	{/if}
</div>

<style>
	.drilldown {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.breadcrumb {
		display: flex;
		gap: var(--space-2xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		align-items: baseline;
	}

	.breadcrumb a {
		color: var(--link-default);
		text-decoration: none;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
	}

	.breadcrumb .current {
		color: var(--ink-body);
	}

	.page-header {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
		flex-wrap: wrap;
	}

	.page-header h1 {
		margin: 0;
	}

	.mode-tag {
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.mode-full {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	.mode-stub {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	h2 {
		margin: 0;
		font-size: var(--type-ui-section-size, 1.25rem);
	}

	.count {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
	}

	.overview {
		padding: var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
	}

	.lead {
		margin: 0;
		font-size: var(--type-ui-section-size, 1.1rem);
		color: var(--ink-body);
		max-width: 72ch;
	}

	.why {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		max-width: 72ch;
	}

	.facts {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.facts div {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.facts dt {
		min-width: 12rem;
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.facts dd {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
		max-width: 60ch;
	}

	code {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		background: var(--surface-page);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
	}

	.docs ul,
	.intent-list,
	.next-list {
		margin: 0;
		padding-left: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.docs li {
		font-size: var(--type-ui-label-size);
	}

	.docs a {
		color: var(--link-default);
	}

	.doc-role {
		display: block;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.pending {
		padding: var(--space-md);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
	}

	.pending p {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		max-width: 72ch;
	}

	.pending a {
		color: var(--link-default);
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: var(--space-sm);
	}

	.metric,
	.gap {
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-page);
		padding: var(--space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.metric header,
	.gap header {
		display: flex;
		justify-content: space-between;
		gap: var(--space-sm);
		align-items: baseline;
	}

	.metric-label,
	.gap-title {
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-body);
	}

	.metric-value {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-section-size, 1.25rem);
		color: var(--ink-body);
	}

	.explain {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
		max-width: 72ch;
	}

	.explain-label {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
		margin-right: var(--space-3xs);
	}

	.explain a {
		color: var(--link-default);
	}

	.gap-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.severity {
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		white-space: nowrap;
	}

	.severity[data-severity='structural'] {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
	}

	.severity[data-severity='thin'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}

	.severity[data-severity='nice-to-have'] {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}

	.empty {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		font-style: italic;
		max-width: 72ch;
	}

	.intent-item {
		font-weight: var(--type-ui-control-weight);
	}

	.intent-status,
	.intent-value {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		margin-left: var(--space-2xs);
	}

	.intent-sub {
		margin: var(--space-3xs) 0 0;
		padding-left: var(--space-lg);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.next-list li {
		display: flex;
		gap: var(--space-sm);
		align-items: flex-start;
	}

	.next-value {
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		white-space: nowrap;
	}

	.next-value[data-value='high'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}

	.next-value[data-value='standard'] {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.next-value[data-value='low'] {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.next-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.next-text {
		color: var(--ink-body);
		font-weight: var(--type-ui-control-weight);
	}

	a.next-text {
		color: var(--link-default);
	}

	.next-rationale {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		max-width: 72ch;
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

	.item-id {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		white-space: nowrap;
	}

	.item-id a {
		color: var(--link-default);
		text-decoration: none;
	}

	.item-detail {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		color: var(--ink-muted);
	}

	.state {
		display: inline-block;
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-caption-size);
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.state[data-state='matched'] {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
