<script lang="ts">
import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import MapPanel from './_panels/MapPanel.svelte';
import ProgressPanel from './_panels/ProgressPanel.svelte';
import TilesPanel from './_panels/TilesPanel.svelte';
import TodayPanel from './_panels/TodayPanel.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// Cards-due / cards-new badge derives from the credential's recall
// gating bucket. The mastery rollup gives a coarse "required vs passing"
// shape; for the per-tile badge we surface "leaves not yet mastered" as
// a stand-in for "cards that need work" until the future card-state-
// per-credential aggregation lands.
const recallRequired = $derived(data.kind === 'home' ? (data.mastery.byEvidenceKind.recall?.required ?? 0) : 0);
const recallPassing = $derived(data.kind === 'home' ? (data.mastery.byEvidenceKind.recall?.passing ?? 0) : 0);
const dueCardsCount = $derived(Math.max(0, recallRequired - recallPassing));
</script>

<svelte:head>
	<title>Study -- airboss</title>
</svelte:head>

<section class="page">
	{#if data.kind === 'home'}
		<PageHeader
			title="Study"
			subtitleSnippet={credentialSubtitle}
		/>
	{:else}
		<PageHeader title="Study" subtitle="Where you are. What's next. How you'd like to study it." />
	{/if}

	{#if data.kind === 'no-goal'}
		<article class="banner" aria-labelledby="study-no-goal-h">
			<h2 id="study-no-goal-h">Set a primary goal to personalize your study home</h2>
			<p>
				The study home rolls up progress against the certification you're targeting (Private Pilot,
				Instrument, etc.). Pick a primary goal and the page will show your understood / memorized /
				practiced numbers, today's focus, and a hierarchical map of the cert.
			</p>
			<div class="actions">
				<Button href={ROUTES.GOALS_NEW} variant="primary">Set a primary goal</Button>
			</div>
		</article>
	{:else}
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

{#snippet credentialSubtitle()}
	{#if data.kind === 'home'}
		<span class="cred">
			<strong>{data.credential.title}</strong>
			<a href={ROUTES.GOALS} class="switch">(switch)</a>
		</span>
	{/if}
{/snippet}

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

.cred {
	display: inline-flex;
	gap: var(--space-2xs);
	align-items: baseline;
}

.switch {
	color: var(--link-default);
	text-decoration: underline;
	font-size: var(--font-size-sm);
}
</style>
