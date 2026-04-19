<script lang="ts">
import { CARD_STATES, DOMAIN_LABELS, MASTERY_STABILITY_DAYS, ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const stats = $derived(data.stats);
const totalActive = $derived(Object.values(stats.stateCounts).reduce((a, b) => a + b, 0));

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function percent(n: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((n / total) * 100);
}
</script>

<svelte:head>
	<title>Memory -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Memory</h1>
			<p class="sub">Cards you've written; the algorithm schedules reviews.</p>
		</div>
		<nav class="quick" aria-label="Quick actions">
			<a class="btn ghost" href={ROUTES.MEMORY_BROWSE}>Browse</a>
			<a class="btn secondary" href={ROUTES.MEMORY_NEW}>New card</a>
			<a class="btn primary" href={ROUTES.MEMORY_REVIEW}>Start review</a>
		</nav>
	</header>

	<div class="grid">
		<article class="tile due">
			<div class="tile-label">Due now</div>
			<div class="tile-value">{stats.dueNow}</div>
			<div class="tile-sub">{stats.dueNow === 1 ? 'card' : 'cards'} to review</div>
		</article>
		<article class="tile">
			<div class="tile-label">Reviewed today</div>
			<div class="tile-value">{stats.reviewedToday}</div>
			<div class="tile-sub">{stats.reviewedToday === 1 ? 'review' : 'reviews'}</div>
		</article>
		<article class="tile">
			<div class="tile-label">Streak</div>
			<div class="tile-value">{stats.streakDays}</div>
			<div class="tile-sub">{stats.streakDays === 1 ? 'day' : 'days'}</div>
		</article>
		<article class="tile">
			<div class="tile-label">Active cards</div>
			<div class="tile-value">{totalActive}</div>
			<div class="tile-sub">across {stats.domains.length} {stats.domains.length === 1 ? 'domain' : 'domains'}</div>
		</article>
	</div>

	<article class="card-list">
		<h2>By state</h2>
		<ul class="states">
			<li>
				<span class="state-label">New</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.NEW]}</span>
			</li>
			<li>
				<span class="state-label">Learning</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.LEARNING]}</span>
			</li>
			<li>
				<span class="state-label">Review</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.REVIEW]}</span>
			</li>
			<li>
				<span class="state-label">Relearning</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.RELEARNING]}</span>
			</li>
		</ul>
	</article>

	<article class="card-list">
		<h2>By domain</h2>
		{#if stats.domains.length === 0}
			<p class="empty-note">No active cards yet. <a href={ROUTES.MEMORY_NEW}>Create your first</a>.</p>
		{:else}
			<ul class="domains">
				{#each stats.domains as d (d.domain)}
					<li>
						<div class="dm-head">
							<a class="dm-name" href={`${ROUTES.MEMORY_BROWSE}?domain=${encodeURIComponent(d.domain)}`}>
								{domainLabel(d.domain)}
							</a>
							<span class="dm-counts">
								<span class="dm-total">{d.total}</span>
								{#if d.due > 0}<span class="dm-due">{d.due} due</span>{/if}
							</span>
						</div>
						<div class="bar" aria-hidden="true">
							<span class="bar-fill" style="width: {percent(d.mastered, d.total)}%"></span>
						</div>
						<div class="dm-sub">{percent(d.mastered, d.total)}% mastered (stability &gt; {MASTERY_STABILITY_DAYS}d)</div>
					</li>
				{/each}
			</ul>
		{/if}
	</article>
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

	.tile.due {
		border-color: #bfdbfe;
		background: #eff6ff;
	}

	.tile-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.tile.due .tile-label {
		color: #1d4ed8;
	}

	.tile-value {
		font-size: 2rem;
		font-weight: 700;
		color: #0f172a;
		line-height: 1;
	}

	.tile.due .tile-value {
		color: #1d4ed8;
	}

	.tile-sub {
		font-size: 0.8125rem;
		color: #64748b;
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

	.states {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.states li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
	}

	.state-label {
		color: #475569;
		font-size: 0.875rem;
	}

	.state-count {
		color: #0f172a;
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

	.dm-name:hover {
		color: #1d4ed8;
	}

	.dm-counts {
		display: flex;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}

	.dm-total {
		color: #64748b;
	}

	.dm-due {
		color: #1d4ed8;
		font-weight: 600;
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

	.dm-sub {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.empty-note {
		color: #64748b;
		font-size: 0.875rem;
		margin: 0;
	}

	.empty-note a {
		color: #1d4ed8;
		font-weight: 500;
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
