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
		gap: var(--ab-space-xl-alt);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--ab-space-lg);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.sub {
		margin: var(--ab-space-2xs) 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-body);
	}

	.quick {
		display: flex;
		gap: var(--ab-space-sm);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--ab-space-md);
	}

	.tile {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-lg) var(--ab-space-xl-alt);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-2xs);
	}

	.tile-label {
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.tile-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--ab-color-fg);
		line-height: 1;
	}

	.tile-sub {
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
	}

	.tile-sub-list {
		margin: var(--ab-space-2xs) 0 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--ab-space-3xs) var(--ab-space-sm);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
	}

	.tile-sub-list > div {
		display: contents;
	}

	.tile-sub-list dt {
		color: var(--ab-color-fg-subtle);
	}

	.tile-sub-list dd {
		margin: 0;
		color: var(--ab-color-fg);
		font-variant-numeric: tabular-nums;
	}

	.card {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-xl-alt) var(--ab-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md-alt);
	}

	.card h2 {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.slices {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xs);
	}

	.slices li {
		display: flex;
		gap: var(--ab-space-md);
		align-items: baseline;
		padding: var(--ab-space-xs) var(--ab-space-sm-alt);
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
	}

	.slice-name {
		flex: 1;
		color: var(--ab-color-fg);
		font-weight: 500;
	}

	.slice-num {
		color: var(--ab-color-primary-hover);
		font-weight: 600;
	}

	.skip-chip {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-warning-active);
		background: var(--ab-color-warning-subtle);
		padding: var(--ab-space-3xs) var(--ab-space-sm);
		border-radius: var(--ab-radius-pill);
	}

	.pills {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		gap: var(--ab-space-xs);
		flex-wrap: wrap;
	}

	.pills li {
		background: var(--ab-color-surface-sunken);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-pill);
		padding: var(--ab-space-2xs) var(--ab-space-sm-alt);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg);
	}

	.suggestion-actions {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--ab-space-sm);
	}

	.suggestion-actions li {
		display: contents;
	}

	.btn.suggestion {
		padding: var(--ab-space-sm-alt) var(--ab-space-lg);
		font-size: var(--ab-font-size-body);
		text-align: left;
		justify-content: flex-start;
		border-radius: var(--ab-radius-md);
	}

	.btn.suggestion.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.suggestion.primary:hover {
		background: var(--ab-color-primary-hover);
	}

	.btn.suggestion.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border: 1px solid var(--ab-color-border-strong);
	}

	.btn.suggestion.secondary:hover {
		background: var(--ab-color-border);
	}

	.muted {
		color: var(--ab-color-fg-muted);
		margin: 0;
		font-size: var(--ab-font-size-body);
	}

	.btn {
		padding: var(--ab-space-sm) var(--ab-space-lg);
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover {
		background: var(--ab-color-primary-hover);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}

	.btn.ghost:hover {
		background: var(--ab-color-surface-sunken);
	}
</style>
