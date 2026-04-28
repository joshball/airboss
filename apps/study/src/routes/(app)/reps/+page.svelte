<script lang="ts">
import { domainLabel, REP_DASHBOARD_WINDOW_DAYS, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import StatTile from '@ab/ui/components/StatTile.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const stats = $derived(data.stats);
const hasScenarios = $derived(stats.scenarioCount > 0);

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
	<PageHeader
		title="Decision Reps"
		subtitle="Read a situation. Pick a call. See what happens. 60 seconds at a time."
		actionsLabel="Quick actions"
	>
		{#snippet titleSuffix()}
			<PageHelp pageId="reps" />
		{/snippet}
		{#snippet actions()}
			<Button variant="ghost" href={ROUTES.REPS_BROWSE}>Browse</Button>
			<Button variant="secondary" href={ROUTES.REPS_NEW}>New scenario</Button>
			{#if hasScenarios}
				<Button variant="primary" href={ROUTES.SESSION_START}>Start session</Button>
			{:else}
				<Button variant="primary" disabled ariaLabel="Write a scenario first to enable sessions.">
					Start session
				</Button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if !hasScenarios}
		<EmptyState
			title="No scenarios yet"
			body="Write your first one -- title, 2-3 sentences of context, 2-5 options, and the teaching point."
		>
			{#snippet actions()}
				<Button variant="primary" href={ROUTES.REPS_NEW}>Create your first scenario</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid">
			<StatTile
				label="Available"
				value={stats.scenarioCount}
				sub={stats.scenarioCount === 1 ? 'scenario' : 'scenarios'}
				href={stats.scenarioCount > 0 ? ROUTES.SESSION_START : undefined}
				tone="featured"
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
		gap: var(--space-xl);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-md);
	}

	/* StatTile provides its own styling; the grid just lays them out. */

	.card-list {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.card-list h2 {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
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

	a.dm-name:hover {
		color: var(--action-default-hover);
	}

	.dm-counts {
		display: flex;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}

	.dm-pct {
		color: var(--action-default-hover);
		font-weight: 600;
	}

	.dm-total {
		color: var(--ink-subtle);
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

	.empty-note {
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
		margin: 0;
	}

</style>
