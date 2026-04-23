<script lang="ts">
import { CARD_STATES, DOMAIN_LABELS, type Domain, MASTERY_STABILITY_DAYS, QUERY_PARAMS, ROUTES } from '@ab/constants';
import StatTile from '@ab/ui/components/StatTile.svelte';
import { humanize } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const stats = $derived(data.stats);
const totalActive = $derived(Object.values(stats.stateCounts).reduce((a, b) => a + b, 0));

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
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
		<StatTile
			label="Due now"
			value={stats.dueNow}
			sub="{stats.dueNow === 1 ? 'card' : 'cards'} to review"
			href={stats.dueNow > 0 ? ROUTES.MEMORY_REVIEW : undefined}
			tone="primary"
			ariaLabel="Due now: {stats.dueNow} cards to review"
		/>
		<StatTile
			label="Reviewed today"
			value={stats.reviewedToday}
			sub={stats.reviewedToday === 1 ? 'review' : 'reviews'}
			href={`${ROUTES.MEMORY_BROWSE}?${QUERY_PARAMS.STATUS}=active`}
			ariaLabel="Reviewed today: {stats.reviewedToday}, browse active cards"
		/>
		<StatTile
			label="Streak"
			value={stats.streakDays}
			sub={stats.streakDays === 1 ? 'day' : 'days'}
			href={ROUTES.CALIBRATION}
			ariaLabel="Streak: {stats.streakDays} days, open calibration"
		/>
		<StatTile
			label="Active cards"
			value={totalActive}
			sub="across {stats.domains.length} {stats.domains.length === 1 ? 'domain' : 'domains'}"
			href={ROUTES.MEMORY_BROWSE}
		/>
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
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: 0.9375rem;
	}

	.quick {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-md);
	}

	/* StatTile provides its own styling; the grid just lays them out. */

	.card-list {
		/* TODO-theme: pick a role token for this literal. */ background: white;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.card-list h2 {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--ink-subtle);
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
		gap: var(--space-sm);
	}

	.states li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.state-label {
		color: var(--ink-muted);
		font-size: 0.875rem;
	}

	.state-count {
		color: var(--ink-body);
		font-weight: 600;
	}

	.domains {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.domains li {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.dm-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.dm-name {
		color: var(--ink-body);
		text-decoration: none;
		font-weight: 500;
	}

	.dm-name:hover {
		color: var(--action-default-hover);
	}

	.dm-counts {
		display: flex;
		gap: var(--space-sm);
		font-size: 0.8125rem;
	}

	.dm-total {
		color: var(--ink-subtle);
	}

	.dm-due {
		color: var(--action-default-hover);
		font-weight: 600;
	}

	.bar {
		background: var(--edge-default);
		height: 0.375rem;
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.bar-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
		transition: width var(--motion-normal);
	}

	.dm-sub {
		font-size: 0.75rem;
		color: var(--ink-faint);
	}

	.empty-note {
		color: var(--ink-subtle);
		font-size: 0.875rem;
		margin: 0;
	}

	.empty-note a {
		color: var(--action-default-hover);
		font-weight: 500;
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: 0.9375rem;
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

	.btn.primary {
		background: var(--action-default);
		/* TODO-theme: pick a role token for this literal. */ color: white;
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover {
		background: var(--edge-default);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}
</style>
