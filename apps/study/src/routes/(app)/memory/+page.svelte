<script lang="ts">
import { CARD_STATES, DOMAIN_LABELS, type Domain, MASTERY_STABILITY_DAYS, QUERY_PARAMS, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import StatTile from '@ab/ui/components/StatTile.svelte';
import { humanize } from '@ab/utils';
import type { PageData } from './$types';

const STATE_TIPS: Record<'new' | 'learning' | 'review' | 'relearning', { label: string; definition: string }> = {
	new: {
		label: 'New',
		definition: 'Cards you have not reviewed yet. They enter the rotation the first time you see them.',
	},
	learning: {
		label: 'Learning',
		definition: 'New cards still being introduced. Short intervals until the first successful review.',
	},
	review: { label: 'Review', definition: 'Cards in long-term rotation. Intervals grow as stability grows.' },
	relearning: {
		label: 'Relearning',
		definition: 'Cards you recently forgot. Back to short intervals until they stabilize.',
	},
};

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
			<div class="title-row">
				<h1>Memory</h1>
				<PageHelp pageId="memory-dashboard" />
			</div>
			<p class="sub">Cards you've written; the algorithm schedules reviews.</p>
		</div>
		<nav class="quick" aria-label="Quick actions">
			<a class="btn ghost" href={ROUTES.MEMORY_BROWSE}>Browse</a>
			<a class="btn secondary" href={ROUTES.MEMORY_NEW}>New card</a>
			<a class="btn primary" href={ROUTES.MEMORY_REVIEW}>Start review</a>
		</nav>
	</header>

	<div class="grid">
		<div class="tile-wrap">
			<StatTile
				label="Due now"
				value={stats.dueNow}
				sub="{stats.dueNow === 1 ? 'card' : 'cards'} to review"
				href={stats.dueNow > 0 ? ROUTES.MEMORY_REVIEW : undefined}
				tone="primary"
				ariaLabel="Due now: {stats.dueNow} cards to review"
			/>
			<span class="tile-tip">
				<InfoTip
					term="Due now"
					definition="Cards the scheduler says are ready to review right now. The queue grows as stability clocks elapse."
					helpId="memory-review"
					helpSection="how-scheduling-works"
				/>
			</span>
		</div>
		<div class="tile-wrap">
			<StatTile
				label="Reviewed today"
				value={stats.reviewedToday}
				sub={stats.reviewedToday === 1 ? 'review' : 'reviews'}
				href={`${ROUTES.MEMORY_BROWSE}?${QUERY_PARAMS.STATUS}=active`}
				ariaLabel="Reviewed today: {stats.reviewedToday}, browse active cards"
			/>
			<span class="tile-tip">
				<InfoTip
					term="Reviewed today"
					definition="Reviews you have rated since local midnight. Includes repeat reviews of the same card."
					helpId="memory-dashboard"
				/>
			</span>
		</div>
		<div class="tile-wrap">
			<StatTile
				label="Streak"
				value={stats.streakDays}
				sub={stats.streakDays === 1 ? 'day' : 'days'}
				href={ROUTES.CALIBRATION}
				ariaLabel="Streak: {stats.streakDays} days, open calibration"
			/>
			<span class="tile-tip">
				<InfoTip
					term="Streak"
					definition="Consecutive days you reviewed at least one due card. Resets if a day passes with zero reviews."
					helpId="memory-dashboard"
				/>
			</span>
		</div>
		<div class="tile-wrap">
			<StatTile
				label="Active cards"
				value={totalActive}
				sub="across {stats.domains.length} {stats.domains.length === 1 ? 'domain' : 'domains'}"
				href={ROUTES.MEMORY_BROWSE}
			/>
			<span class="tile-tip">
				<InfoTip
					term="Active cards"
					definition="Cards currently in rotation. Excludes suspended and archived items."
					helpId="memory-dashboard"
				/>
			</span>
		</div>
	</div>

	<article class="card-list">
		<h2>By state</h2>
		<ul class="states">
			<li>
				<span class="state-cell">
					<span class="state-label">New</span>
					<InfoTip
						term={STATE_TIPS.new.label}
						definition={STATE_TIPS.new.definition}
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.NEW]}</span>
			</li>
			<li>
				<span class="state-cell">
					<span class="state-label">Learning</span>
					<InfoTip
						term={STATE_TIPS.learning.label}
						definition={STATE_TIPS.learning.definition}
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.LEARNING]}</span>
			</li>
			<li>
				<span class="state-cell">
					<span class="state-label">Review</span>
					<InfoTip
						term={STATE_TIPS.review.label}
						definition={STATE_TIPS.review.definition}
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.REVIEW]}</span>
			</li>
			<li>
				<span class="state-cell">
					<span class="state-label">Relearning</span>
					<InfoTip
						term={STATE_TIPS.relearning.label}
						definition={STATE_TIPS.relearning.definition}
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.RELEARNING]}</span>
			</li>
		</ul>
	</article>

	<article class="card-list">
		<div class="domain-hd">
			<h2>By domain</h2>
			<InfoTip
				term="Domain breakdown"
				definition="Per-domain totals, due count, and the percent of cards with stability above the mastery threshold."
				helpId="concept-fsrs"
				helpSection="stability-and-mastery"
			/>
		</div>
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

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	h1 {
		margin: 0;
		font-size: var(--font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-body);
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

	.tile-wrap {
		position: relative;
		display: flex;
	}

	.tile-wrap > :global(.tile) {
		flex: 1;
	}

	.tile-tip {
		position: absolute;
		top: var(--space-xs);
		right: var(--space-xs);
	}

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

	.state-cell {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.state-label {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.domain-hd {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.domain-hd h2 {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
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
		font-size: var(--font-size-sm);
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
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.empty-note {
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
		margin: 0;
	}

	.empty-note a {
		color: var(--action-default-hover);
		font-weight: 500;
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-body);
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
		color: var(--ink-inverse);
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
