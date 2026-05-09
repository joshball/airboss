<script lang="ts">
import { PAGE_EXPLAINER_KEYS, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PageExplainer from '@ab/ui/components/PageExplainer.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import Tooltip from '@ab/ui/components/Tooltip.svelte';
import MapPanel from './_panels/MapPanel.svelte';
import ProgressPanel from './_panels/ProgressPanel.svelte';
import TilesPanel from './_panels/TilesPanel.svelte';
import TodayPanel from './_panels/TodayPanel.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// Cards-due badge derives from the credential's recall gating bucket.
// The mastery rollup gives a coarse "required vs passing" shape; for
// the per-tile badge we surface "leaves not yet mastered" as a
// stand-in for "cards that need work" until the future card-state-
// per-credential aggregation lands.
//
// When the credential has zero recall-gated leaves, we surface `null`
// (TilesPanel renders "--") rather than `0`, so a fresh learner does
// not read the badge as "you have completed all your cards" when in
// fact there are no cards to count.
const recallRequired = $derived(data.kind === 'home' ? (data.mastery.byEvidenceKind.recall?.required ?? 0) : 0);
const recallPassing = $derived(data.kind === 'home' ? (data.mastery.byEvidenceKind.recall?.passing ?? 0) : 0);
const dueCardsCount = $derived<number | null>(
	recallRequired === 0 ? null : Math.max(0, recallRequired - recallPassing),
);
</script>

<svelte:head>
	<title>Study -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title="Study" subtitle="What should I do right now? Today's session and any pressure points." />

	<PageExplainer
		pageKey={PAGE_EXPLAINER_KEYS.STUDY_HOME}
		dismissed={data.pageExplainerDismissals[PAGE_EXPLAINER_KEYS.STUDY_HOME] ?? false}
	>
		The Home page rolls up your study state into one obvious next step. If you don't have a
		<Tooltip for="goal">a goal</Tooltip>, set one. If you have a goal but no
		<Tooltip for="plan">plan</Tooltip>, build one. If you have both, start today's session.
	</PageExplainer>

	{#if data.kind === 'no-goal'}
		<article class="banner" aria-labelledby="study-no-goal-h">
			<h2 id="study-no-goal-h">Set your first goal</h2>
			<p>
				A <Tooltip for="goal">goal</Tooltip> is the slice of study you're focused on right now (e.g. "Pass PPL written
				by July"). Once you set one, the rest of the app personalizes around it.
			</p>
			<div class="actions" data-testid="first-run-set-goal-cta">
				<Button href={ROUTES.PROGRAM_GOALS_NEW} variant="primary">Set your first goal</Button>
			</div>
		</article>
	{:else if data.kind === 'no-plan'}
		<article class="banner" aria-labelledby="study-no-plan-h">
			<h2 id="study-no-plan-h">Build a plan for {data.goalTitle}</h2>
			<p>
				Your <Tooltip for="goal">goal</Tooltip> is set. A
				<Tooltip for="plan">plan</Tooltip> tells the
				<Tooltip for="session">session</Tooltip> engine how long to study, how often, and what to focus on. You can change
				it any time.
			</p>
			<div class="actions" data-testid="home-cta-primary">
				<Button href={ROUTES.PROGRAM_PLANS_NEW} variant="primary">Build a plan for {data.goalTitle}</Button>
			</div>
		</article>
	{:else}
		<article class="banner banner-cta" aria-labelledby="study-today-h">
			<h2 id="study-today-h">Start today's session</h2>
			<p>
				Working toward <Tooltip for="goal">{data.goalTitle}</Tooltip>. Today's session is shaped by your active
				<Tooltip for="plan">plan</Tooltip>.
			</p>
			<div class="actions" data-testid="home-cta-primary">
				<Button href={ROUTES.SESSION_START} variant="primary">Start today's session</Button>
			</div>
		</article>
		<ProgressPanel mastery={data.mastery} />
		<TodayPanel briefing={data.briefing} />
		<TilesPanel
			repBacklog={data.repBacklog}
			focusNodeId={data.focusNodeId}
			dueCardsCount={dueCardsCount}
			newCardsCount={0}
		/>
		<MapPanel tab={data.tab} tree={data.tree} citationOrder={data.citationOrder} />
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.banner {
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		padding: var(--space-xl);
		background: var(--surface-raised);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		max-width: 60ch;
	}

	.banner-cta {
		border-color: var(--action-default);
	}

	.banner h2 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.banner p {
		margin: 0;
		color: var(--ink-muted);
	}

	.actions {
		margin-top: var(--space-sm);
	}
</style>
