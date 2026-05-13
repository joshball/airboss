<!--
ScenarioPanel -- the briefing-pack panel that mounts behind every
`:::scenario slug="..."` directive in a course-step body.

Reads its data from `/api/scenarios/<slug>/bundle.json` (the server-only
route that hydrates `data/wx-scenarios/<slug>/{truth,commentary,products}`
into one JSON blob). The layout is intentionally minimal for v1:

	1. Header  -- scenario title (label) + validAt timestamp + narrative paragraph
	2. Charts  -- every chart slug the engine has built for this scenario,
	              one `<CourseStepChart>` per slug
	3. Products -- five product columns (METARs, TAFs, AIRMETs, PIREPs,
	              FB bulletin) rendered as raw JSON `<pre>` tabs. Polish
	              ships in a follow-on; the directive contract + panel
	              structure are the load-bearing pieces today.
	4. Commentary -- the truth-anchored Socratic callouts, grouped by
	              `target.kind` per CONSUMER-CONTRACT.md.

If the fetch fails (404 / 500) the panel renders an error card with the
slug + message so the missing wire-up is visible.
-->
<script lang="ts">
import { WX_SCENARIO_LABELS, type WxScenario } from '@ab/constants';
import CourseStepChart from './CourseStepChart.svelte';

interface Props {
	slug: WxScenario;
}

let { slug }: Props = $props();

/** Shape we read from `/api/scenarios/<slug>/bundle.json`. */
interface TruthHeader {
	scenarioId: string;
	validAt: string;
	primaryTimeZone: string;
	narrative: string;
}

interface CommentaryCallout {
	id: string;
	target: { kind: string; chartSlug?: string; elementId?: string };
	question: string;
	observation: string;
	reason: string;
	knowledgeNodeIds: string[];
	mode: 'socratic' | 'glance';
}

interface BundleShape {
	scenarioId: WxScenario;
	truth: TruthHeader | null;
	commentary: CommentaryCallout[] | null;
	products: Record<string, unknown | null>;
	chartSlugs: string[];
}

type LoadState = { kind: 'loading' } | { kind: 'ready'; bundle: BundleShape } | { kind: 'error'; message: string };

let state = $state<LoadState>({ kind: 'loading' });

const scenarioLabel = $derived(WX_SCENARIO_LABELS[slug] ?? slug);

async function loadBundle(targetSlug: WxScenario): Promise<void> {
	state = { kind: 'loading' };
	try {
		const res = await fetch(`/api/scenarios/${encodeURIComponent(targetSlug)}/bundle.json`);
		if (!res.ok) {
			state = { kind: 'error', message: `Failed to load scenario '${targetSlug}': ${res.status} ${res.statusText}` };
			return;
		}
		const bundle = (await res.json()) as BundleShape;
		state = { kind: 'ready', bundle };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		state = { kind: 'error', message: `Failed to load scenario '${targetSlug}': ${message}` };
	}
}

$effect(() => {
	void loadBundle(slug);
});

function chartKindFromSlug(chartSlug: string): string {
	// `wx-scenarios/<id>/<kind>` -> `<kind>`
	const parts = chartSlug.split('/');
	return parts[parts.length - 1] ?? chartSlug;
}

function groupCommentary(callouts: CommentaryCallout[]): Map<string, CommentaryCallout[]> {
	const groups = new Map<string, CommentaryCallout[]>();
	for (const c of callouts) {
		const key = c.target.kind;
		const bucket = groups.get(key);
		if (bucket) bucket.push(c);
		else groups.set(key, [c]);
	}
	return groups;
}

function formatValidAt(iso: string, timeZone: string): string {
	try {
		const date = new Date(iso);
		const formatter = new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone,
		});
		return `${formatter.format(date)} (${timeZone})`;
	} catch {
		return iso;
	}
}
</script>

<section class="scenario-panel" aria-label={`Scenario briefing: ${scenarioLabel}`}>
	{#if state.kind === 'loading'}
		<div class="loading" aria-live="polite">Loading scenario {slug}...</div>
	{:else if state.kind === 'error'}
		<div class="error-card" role="alert">
			<strong>Scenario unavailable</strong>
			<p>{state.message}</p>
		</div>
	{:else}
		{@const bundle = state.bundle}
		<header class="hd">
			<div class="title-row">
				<h2 class="title">{scenarioLabel}</h2>
				<span class="slug-chip"><code>{bundle.scenarioId}</code></span>
			</div>
			{#if bundle.truth}
				<dl class="meta">
					<div>
						<dt>Valid at</dt>
						<dd>{formatValidAt(bundle.truth.validAt, bundle.truth.primaryTimeZone)}</dd>
					</div>
				</dl>
				<p class="narrative">{bundle.truth.narrative}</p>
			{/if}
		</header>

		{#if bundle.chartSlugs.length > 0}
			<section class="charts" aria-label="Scenario charts">
				<h3>Charts</h3>
				<div class="chart-grid">
					{#each bundle.chartSlugs as chartSlug (chartSlug)}
						<figure class="chart-tile">
							<figcaption class="chart-tile-caption">{chartKindFromSlug(chartSlug)}</figcaption>
							<CourseStepChart slug={chartSlug} />
						</figure>
					{/each}
				</div>
			</section>
		{/if}

		<section class="products" aria-label="Scenario products">
			<h3>Products</h3>
			<div class="product-grid">
				{#each Object.entries(bundle.products) as [name, value] (name)}
					<details class="product-card">
						<summary>{name.replace('.json', '')}</summary>
						{#if value === null}
							<p class="empty">No data emitted.</p>
						{:else}
							<pre class="product-json"><code>{JSON.stringify(value, null, 2)}</code></pre>
						{/if}
					</details>
				{/each}
			</div>
		</section>

		{#if bundle.commentary && bundle.commentary.length > 0}
			<section class="commentary" aria-label="Scenario commentary">
				<h3>Commentary</h3>
				{#each Array.from(groupCommentary(bundle.commentary).entries()) as [kind, callouts] (kind)}
					<div class="commentary-group">
						<h4 class="commentary-kind">{kind}</h4>
						<ol class="callout-list">
							{#each callouts as callout (callout.id)}
								<li class="callout" data-mode={callout.mode}>
									{#if callout.mode === 'socratic'}
										<p class="question">{callout.question}</p>
										<details>
											<summary>Observation + reason</summary>
											<p class="observation">{callout.observation}</p>
											<p class="reason">{callout.reason}</p>
										</details>
									{:else}
										<p class="glance">{callout.observation}</p>
									{/if}
								</li>
							{/each}
						</ol>
					</div>
				{/each}
			</section>
		{/if}
	{/if}
</section>

<style>
	.scenario-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-lg);
		margin: var(--space-md) 0;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		background: var(--surface-panel);
	}

	.loading {
		color: var(--ink-muted);
		font-style: italic;
	}

	.error-card {
		padding: var(--space-md);
		border: 1px solid var(--action-hazard);
		border-radius: var(--radius-md);
		background: var(--action-hazard-wash, var(--surface-sunken));
		color: var(--ink-body);
	}

	.error-card p {
		margin: var(--space-xs) 0 0;
	}

	.hd {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		border-bottom: 1px solid var(--edge-default);
		padding-bottom: var(--space-md);
	}

	.title-row {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
		flex-wrap: wrap;
	}

	.title {
		margin: 0;
		font-size: var(--type-heading-2-size, var(--font-size-lg));
		color: var(--ink-body);
	}

	.slug-chip code {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		background: var(--surface-sunken);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
	}

	.meta {
		display: flex;
		gap: var(--space-lg);
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}

	.meta div {
		display: flex;
		gap: var(--space-2xs);
	}

	.meta dt {
		font-weight: var(--font-weight-semibold);
	}

	.meta dd {
		margin: 0;
	}

	.narrative {
		margin: 0;
		line-height: 1.55;
		color: var(--ink-body);
	}

	.charts h3,
	.products h3,
	.commentary h3 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.chart-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-md);
	}

	.chart-tile {
		margin: 0;
		padding: var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
	}

	.chart-tile-caption {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		margin-bottom: var(--space-2xs);
	}

	.product-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-sm);
	}

	.product-card {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
	}

	.product-card summary {
		cursor: pointer;
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.product-json {
		margin: var(--space-sm) 0 0;
		max-height: 360px;
		overflow: auto;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		background: var(--surface-panel);
		padding: var(--space-sm);
		border-radius: var(--radius-xs);
	}

	.empty {
		color: var(--ink-muted);
		font-style: italic;
		margin: var(--space-xs) 0 0;
	}

	.commentary-group {
		margin-bottom: var(--space-md);
	}

	.commentary-kind {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps, 0.05em);
		color: var(--ink-muted);
	}

	.callout-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.callout {
		padding: var(--space-sm) var(--space-md);
		border-left: 3px solid var(--action-default);
		background: var(--surface-sunken);
		border-radius: var(--radius-xs);
	}

	.callout[data-mode='glance'] {
		border-left-color: var(--edge-default);
	}

	.callout .question {
		margin: 0;
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.callout details {
		margin-top: var(--space-2xs);
	}

	.callout .observation,
	.callout .reason {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-body);
	}

	.callout .glance {
		margin: 0;
		color: var(--ink-body);
	}
</style>
