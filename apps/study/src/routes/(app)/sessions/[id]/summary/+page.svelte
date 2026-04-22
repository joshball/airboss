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
			<div class="tile-sub">
				{summary.skippedByKind.today} today · {summary.skippedByKind.topic} topic · {summary.skippedByKind.permanent} permanent
			</div>
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
			<ul>
				{#each summary.suggestedNext as hint (hint)}
					<li>{hint}</li>
				{/each}
			</ul>
		</article>
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
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}

	.quick {
		display: flex;
		gap: 0.5rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.tile {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.tile-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.tile-value {
		font-size: 2rem;
		font-weight: 700;
		color: #0f172a;
		line-height: 1;
	}

	.tile-sub {
		font-size: 0.8125rem;
		color: #64748b;
	}

	.card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.card h2 {
		margin: 0;
		font-size: 0.8125rem;
		color: #64748b;
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
		gap: 0.375rem;
	}

	.slices li {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.375rem 0.625rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.slice-name {
		flex: 1;
		color: #0f172a;
		font-weight: 500;
	}

	.slice-num {
		color: #1d4ed8;
		font-weight: 600;
	}

	.skip-chip {
		font-size: 0.75rem;
		color: #92400e;
		background: #fef3c7;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}

	.pills {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.pills li {
		background: #f1f5f9;
		border: 1px solid #e2e8f0;
		border-radius: 999px;
		padding: 0.25rem 0.625rem;
		font-size: 0.8125rem;
		color: #0f172a;
	}

	.suggestions ul {
		list-style: disc;
		padding-left: 1.25rem;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.suggestions li {
		color: #0f172a;
		font-size: 0.9375rem;
	}

	.muted {
		color: #475569;
		margin: 0;
		font-size: 0.9375rem;
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
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover {
		background: #1d4ed8;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
	}
</style>
