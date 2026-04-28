<script lang="ts">
import { GOAL_STATUS_LABELS, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
const grouped = $derived(data.grouped);
const totalGoals = $derived(
	grouped.active.length + grouped.paused.length + grouped.completed.length + grouped.abandoned.length,
);
</script>

<svelte:head>
	<title>Goals -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title="Goals" subtitle="What you're pursuing right now. Goals compose syllabi and ad-hoc nodes.">
		{#snippet actions()}
			<Button href={ROUTES.GOALS_NEW} variant="primary">New goal</Button>
		{/snippet}
	</PageHeader>

	{#if totalGoals === 0}
		<EmptyState
			title="No goals yet"
			body="Goals are how you target your study. Create one to start composing syllabi and ad-hoc knowledge nodes."
		>
			{#snippet actions()}
				<Button href={ROUTES.GOALS_NEW} variant="primary">Create your first goal</Button>
			{/snippet}
		</EmptyState>
	{:else}
		{#each ['active', 'paused', 'completed', 'abandoned'] as const as bucketKey (bucketKey)}
			{@const goals = grouped[bucketKey]}
			{#if goals.length > 0}
				<section class="bucket" aria-labelledby="bucket-{bucketKey}">
					<h2 id="bucket-{bucketKey}" class="bucket-h">{GOAL_STATUS_LABELS[bucketKey]}</h2>
					<ul class="goal-list">
						{#each goals as goal (goal.id)}
							<li class="goal">
								<a class="goal-link" href={ROUTES.GOAL(goal.id)}>
									<header class="goal-head">
										<h3 class="goal-title">
											{#if goal.isPrimary}
												<span class="primary-badge" title="Primary goal">★</span>
											{/if}
											{goal.title}
										</h3>
										{#if goal.targetDate !== null}
											<span class="target">Target: {goal.targetDate}</span>
										{/if}
									</header>
									{#if goal.notesMd !== ''}
										<p class="notes">{goal.notesMd.slice(0, 200)}{goal.notesMd.length > 200 ? '...' : ''}</p>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/each}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 70rem;
		margin: 0 auto;
		width: 100%;
	}

	.bucket {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.bucket-h {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.goal-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.goal {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.goal:hover {
		border-color: var(--edge-strong);
	}

	.goal-link {
		display: block;
		padding: var(--space-md);
		color: inherit;
		text-decoration: none;
	}

	.goal-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-md);
		flex-wrap: wrap;
	}

	.goal-title {
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
		display: inline-flex;
		gap: var(--space-xs);
		align-items: baseline;
	}

	.primary-badge {
		color: var(--signal-warning-ink);
		font-size: var(--font-size-body);
	}

	.target {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}

	.notes {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
	}
</style>
