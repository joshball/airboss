<script lang="ts">
import {
	DOMAIN_LABELS,
	type Domain,
	ROUTES,
	SESSION_MODE_LABELS,
	SESSION_SLICE_LABELS,
	type SessionMode,
	type SessionSlice,
} from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const summary = $derived(data.summary);
const accuracyPct = $derived(summary.attempted === 0 ? 0 : Math.round((summary.correct / summary.attempted) * 100));
const skipTotal = $derived(summary.skippedByKind.today + summary.skippedByKind.topic + summary.skippedByKind.permanent);

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}
</script>

<svelte:head>
	<title>Session summary -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Session complete</h1>
			<p class="sub">Mode: {SESSION_MODE_LABELS[summary.session.mode as SessionMode]}</p>
		</div>
		<nav class="quick">
			<a class="btn ghost" href={ROUTES.DASHBOARD}>Back to dashboard</a>
			<a class="btn primary" href={ROUTES.SESSION_START}>Another session</a>
		</nav>
	</header>

	<div class="grid">
		<article class="tile">
			<div class="tile-label">Attempted</div>
			<div class="tile-value">{summary.attempted}</div>
			<div class="tile-sub">of {summary.totalItems} items</div>
		</article>
		<article class="tile">
			<div class="tile-label">Correct</div>
			<div class="tile-value">{summary.correct}</div>
			<div class="tile-sub">{accuracyPct}% accuracy</div>
		</article>
		<article class="tile">
			<div class="tile-label">Skipped</div>
			<div class="tile-value">{skipTotal}</div>
			<dl class="tile-sub-list">
				<div>
					<dt>Today</dt>
					<dd>{summary.skippedByKind.today}</dd>
				</div>
				<div>
					<dt>Topic</dt>
					<dd>{summary.skippedByKind.topic}</dd>
				</div>
				<div>
					<dt>Permanent</dt>
					<dd>{summary.skippedByKind.permanent}</dd>
				</div>
			</dl>
		</article>
		<article class="tile">
			<div class="tile-label">Streak</div>
			<div class="tile-value">{summary.streakDays}</div>
			<div class="tile-sub">{summary.streakDays === 1 ? 'day' : 'days'}</div>
		</article>
	</div>

	{#if summary.bySlice.length > 0}
		<article class="card">
			<h2>By slice</h2>
			<ul class="slices">
				{#each summary.bySlice as s (s.slice)}
					<li>
						<span class="slice-name">{SESSION_SLICE_LABELS[s.slice as SessionSlice]}</span>
						<span class="slice-num">{s.correct}/{s.attempted}</span>
						{#if s.skipped > 0}<span class="skip-chip">{s.skipped} skipped</span>{/if}
					</li>
				{/each}
			</ul>
		</article>
	{/if}

	{#if summary.domainsTouched.length > 0}
		<article class="card">
			<h2>Domains touched</h2>
			<ul class="pills">
				{#each summary.domainsTouched as d (d)}
					<li>{domainLabel(d as Domain)}</li>
				{/each}
			</ul>
		</article>
	{/if}

	{#if summary.avgConfidence !== null}
		<article class="card">
			<h2>Confidence</h2>
			<p class="muted">Average pre-reveal confidence: <strong>{summary.avgConfidence.toFixed(2)}</strong> / 5</p>
		</article>
	{/if}

	{#if summary.nodesStarted > 0}
		<article class="card">
			<h2>Nodes started</h2>
			<p class="muted">
				{summary.nodesStarted}
				{summary.nodesStarted === 1 ? 'new node' : 'new nodes'} opened this session.
			</p>
		</article>
	{/if}

	{#if summary.suggestedNext.length > 0}
		<article class="card suggestions">
			<h2>Suggested next</h2>
			<ul class="suggestion-actions">
				{#each summary.suggestedNext as action (action.href + action.label)}
					<li>
						<a class="btn suggestion {action.variant}" href={action.href}>{action.label}</a>
					</li>
				{/each}
			</ul>
		</article>
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
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--type-definition-body-size);
	}

	.quick {
		display: flex;
		gap: var(--space-sm);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-md);
	}

	.tile {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.tile-label {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.tile-value {
		font-size: var(--font-size-2xl);
		font-weight: 700;
		color: var(--ink-body);
		line-height: 1;
	}

	.tile-sub {
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.tile-sub-list {
		margin: var(--space-2xs) 0 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.tile-sub-list > div {
		display: contents;
	}

	.tile-sub-list dt {
		color: var(--ink-subtle);
	}

	.tile-sub-list dd {
		margin: 0;
		color: var(--ink-body);
		font-variant-numeric: tabular-nums;
	}

	.card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.card h2 {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.slices {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.slices li {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
		padding: var(--space-xs) var(--space-sm);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
	}

	.slice-name {
		flex: 1;
		color: var(--ink-body);
		font-weight: 500;
	}

	.slice-num {
		color: var(--action-default-hover);
		font-weight: 600;
	}

	.skip-chip {
		font-size: var(--type-ui-caption-size);
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
	}

	.pills {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.pills li {
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	.suggestion-actions {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.suggestion-actions li {
		display: contents;
	}

	.btn.suggestion {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		text-align: left;
		justify-content: flex-start;
		border-radius: var(--radius-md);
	}

	.btn.suggestion.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.suggestion.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.suggestion.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border: 1px solid var(--edge-strong);
	}

	.btn.suggestion.secondary:hover {
		background: var(--edge-default);
	}

	.muted {
		color: var(--ink-muted);
		margin: 0;
		font-size: var(--type-definition-body-size);
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
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}
</style>
