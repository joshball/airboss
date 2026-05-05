<script lang="ts">
import { PAGE_EXPLAINER_KEYS, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PageExplainer from '@ab/ui/components/PageExplainer.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import Tooltip from '@ab/ui/components/Tooltip.svelte';
import type { LayoutData } from '../$types';
import type { PageData } from './$types';

let { data }: { data: PageData & LayoutData } = $props();
</script>

<svelte:head>
	<title>Coverage -- Program -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title="Coverage" subtitle="A snapshot of how your qualifications, goals, and plan line up." />

	<PageExplainer pageKey={PAGE_EXPLAINER_KEYS.PROGRAM_COVERAGE}>
		The Coverage tab summarises what's in motion: the
		<Tooltip for="qual">quals</Tooltip>
		you're working on, your
		<Tooltip for="goal">goals</Tooltip>, and whether an active
		<Tooltip for="plan">plan</Tooltip>
		is shaping today's session. Use it to spot gaps before they bite.
	</PageExplainer>

	<dl class="coverage-grid">
		<div class="cell">
			<dt>Goals</dt>
			<dd>{data.goalCount}</dd>
			<p class="meta">
				{#if data.primaryGoalTitle}
					Primary: {data.primaryGoalTitle}
				{:else}
					No primary goal set yet.
				{/if}
			</p>
		</div>
		<div class="cell">
			<dt>Active plan</dt>
			<dd>{data.hasPlan ? 'Yes' : 'No'}</dd>
			<p class="meta">
				{#if !data.hasPlan && data.hasGoal}
					Build one to start receiving today's session.
				{:else if !data.hasPlan}
					Set a goal first.
				{:else}
					Adjust shape from the Plan tab.
				{/if}
			</p>
		</div>
	</dl>

	{#if !data.hasGoal}
		<div class="cta">
			<Button href={ROUTES.PROGRAM_GOALS_NEW} variant="primary">Set your first goal</Button>
		</div>
	{:else if !data.hasPlan}
		<div class="cta">
			<Button href={ROUTES.PROGRAM_PLANS_NEW} variant="primary">Build a plan</Button>
		</div>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.coverage-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-md);
		margin: 0;
	}

	.cell {
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		background: var(--surface-panel);
	}

	.cell dt {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		margin-bottom: var(--space-2xs);
	}

	.cell dd {
		font-size: var(--type-heading-1-size);
		font-weight: var(--type-heading-1-weight);
		margin: 0;
	}

	.meta {
		margin: var(--space-xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.cta {
		display: flex;
		justify-content: flex-start;
	}
</style>
