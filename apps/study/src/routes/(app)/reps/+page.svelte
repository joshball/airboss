<script lang="ts">
import { DOMAIN_LABELS, REP_DASHBOARD_WINDOW_DAYS, ROUTES } from '@ab/constants';
import StatTile from '@ab/ui/components/StatTile.svelte';
import { humanize } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const stats = $derived(data.stats);
const hasScenarios = $derived(stats.scenarioCount > 0);

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function percent(value: number): number {
	return Math.round(value * 100);
}

function bar(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value * 100)));
}
</script>

<svelte:head>
	<title>Reps -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Decision Reps</h1>
			<p class="sub">Read a situation. Pick a call. See what happens. 60 seconds at a time.</p>
		</div>
		<nav class="quick" aria-label="Quick actions">
			<a class="btn ghost" href={ROUTES.REPS_BROWSE}>Browse</a>
			<a class="btn secondary" href={ROUTES.REPS_NEW}>New scenario</a>
			{#if hasScenarios}
				<a class="btn primary" href={ROUTES.SESSION_START}>Start session</a>
			{:else}
				<button
					class="btn primary"
					type="button"
					disabled
					title="Write a scenario first to enable sessions."
					aria-describedby="start-session-hint"
				>
					Start session
				</button>
				<span id="start-session-hint" class="visually-hidden">Write a scenario first to enable sessions.</span>
			{/if}
		</nav>
	</header>

	{#if !hasScenarios}
		<article class="empty" role="status">
			<h2>No scenarios yet</h2>
			<p>Write your first one -- title, 2-3 sentences of context, 2-5 options, and the teaching point.</p>
			<a class="btn primary" href={ROUTES.REPS_NEW}>Create your first scenario</a>
		</article>
	{:else}
		<div class="grid">
			<StatTile
				label="Available"
				value={stats.scenarioCount}
				sub={stats.scenarioCount === 1 ? 'scenario' : 'scenarios'}
				href={stats.scenarioCount > 0 ? ROUTES.SESSION_START : undefined}
				tone="primary"
				ariaLabel="Available: {stats.scenarioCount} scenarios, start a session"
			/>
			<StatTile
				label="Unattempted"
				value={stats.unattemptedCount}
				sub="never tried"
				href={ROUTES.REPS_BROWSE}
				ariaLabel="Unattempted: {stats.unattemptedCount}, browse reps"
			/>
			<StatTile label="Today" value={stats.attemptedToday} sub={stats.attemptedToday === 1 ? 'rep' : 'reps'} />
			<StatTile
				label="Accuracy (30d)"
				value={stats.accuracyLast30d.attempted === 0 ? '--' : `${percent(stats.accuracyLast30d.accuracy)}%`}
				sub="{stats.accuracyLast30d.correct} / {stats.accuracyLast30d.attempted} correct"
				href={stats.accuracyLast30d.attempted > 0 ? ROUTES.CALIBRATION : undefined}
			/>
		</div>

		<article class="card-list">
			<h2>Accuracy by domain (last {REP_DASHBOARD_WINDOW_DAYS} days)</h2>
			{#if stats.domainBreakdown.length === 0}
				<p class="empty-note">No attempts in the last {REP_DASHBOARD_WINDOW_DAYS} days. Start a session to see breakdowns here.</p>
			{:else}
				<ul class="domains">
					{#each stats.domainBreakdown as d (d.domain)}
						<li>
							<div class="dm-head">
								<span class="dm-name">{domainLabel(d.domain)}</span>
								<span class="dm-counts">
									<span class="dm-pct">{percent(d.accuracy)}%</span>
									<span class="dm-total">{d.correct} / {d.attempted}</span>
								</span>
							</div>
							<div class="bar" aria-hidden="true">
								<span class="bar-fill" style="width: {bar(d.accuracy)}%"></span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</article>

		<article class="card-list">
			<h2>Scenarios by domain</h2>
			<ul class="domains">
				{#each stats.scenariosByDomain as d (d.domain)}
					<li>
						<div class="dm-head">
							<a class="dm-name" href={`${ROUTES.REPS_BROWSE}?domain=${encodeURIComponent(d.domain)}`}>
								{domainLabel(d.domain)}
							</a>
							<span class="dm-counts">
								<span class="dm-total">{d.count}</span>
							</span>
						</div>
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
		gap: 1.5rem;
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
		flex-wrap: wrap;
	}

	.empty {
		background: white;
		border: 1px dashed #cbd5e1;
		border-radius: 12px;
		padding: 2.5rem 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.empty h2 {
		margin: 0;
		color: #0f172a;
		font-size: 1.25rem;
	}

	.empty p {
		margin: 0;
		color: #64748b;
		max-width: 28rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	/* StatTile provides its own styling; the grid just lays them out. */

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.card-list {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.card-list h2 {
		margin: 0;
		font-size: 0.8125rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.domains {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.domains li {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.dm-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.dm-name {
		color: #0f172a;
		text-decoration: none;
		font-weight: 500;
	}

	a.dm-name:hover {
		color: #1d4ed8;
	}

	.dm-counts {
		display: flex;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}

	.dm-pct {
		color: #1d4ed8;
		font-weight: 600;
	}

	.dm-total {
		color: #64748b;
	}

	.bar {
		background: #e2e8f0;
		height: 0.375rem;
		border-radius: 999px;
		overflow: hidden;
	}

	.bar-fill {
		display: block;
		height: 100%;
		background: #2563eb;
		transition: width 250ms;
	}

	.empty-note {
		color: #64748b;
		font-size: 0.875rem;
		margin: 0;
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

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover {
		background: #1d4ed8;
	}

	.btn.primary:disabled {
		background: #94a3b8;
		cursor: not-allowed;
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
	}

	.btn.ghost:hover {
		background: #f1f5f9;
	}
</style>
