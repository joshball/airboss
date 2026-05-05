<!--
@component
Learn section index (study-app-ia-cleanup Phase 4).

The Learn section unifies the three "doing the work" surfaces -- Cards
(`/memory`), Reps (`/reps`), and Read (`/library`) -- under a single nav
entry. The underlying URLs are intentionally unchanged from prior
phases (per design.md "Memory and Reps routes stay where they are --
their nav surface moves into Learn -> Cards / Reps, but the URLs do not
change"). This index page is the discovery surface that explains the
three sub-areas and links into them.

Tab strip is the canonical Learn nav substrate (`LearnTabs.svelte`),
mirrored on each section index page so the orientation persists no
matter which sub-section the user lands on first.
-->
<script lang="ts">
import { NAV_LABELS, PAGE_EXPLAINER_KEYS, ROUTES } from '@ab/constants';
import Card from '@ab/ui/components/Card.svelte';
import PageExplainer from '@ab/ui/components/PageExplainer.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import Tooltip from '@ab/ui/components/Tooltip.svelte';
import LearnTabs from '$lib/components/LearnTabs.svelte';
</script>

<svelte:head>
	<title>Learn -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		title={NAV_LABELS.LEARN}
		subtitle="The doing-the-work surfaces. Cards for spaced repetition, Reps for decision practice, Read for the FAA library."
	/>

	<LearnTabs active="learn" />

	<PageExplainer pageKey={PAGE_EXPLAINER_KEYS.LEARN}>
		The Learn section is where you do the work. Cards run the
		<Tooltip for="reps">spaced-repetition</Tooltip>
		queue; Reps run decision-practice scenarios (knowledge in motion); Read is the FAA library, the canonical reference for everything else. All three stay at their existing URLs -- this section just gives them a shared home so the daily flow is one click instead of three.
	</PageExplainer>

	<div class="learn-grid">
		<a class="learn-card" href={ROUTES.MEMORY} data-testid="learn-card-cards">
			<Card>
				<h2>{NAV_LABELS.LEARN_CARDS}</h2>
				<p>Memory cards on a spaced-repetition schedule. Review what's due, browse the deck, write new ones.</p>
			</Card>
		</a>
		<a class="learn-card" href={ROUTES.REPS} data-testid="learn-card-reps">
			<Card>
				<h2>{NAV_LABELS.LEARN_REPS}</h2>
				<p>Decision-practice scenarios. Short, self-contained, knowledge-in-motion drills.</p>
			</Card>
		</a>
		<a class="learn-card" href={ROUTES.LIBRARY} data-testid="learn-card-read">
			<Card>
				<h2>{NAV_LABELS.LEARN_READ}</h2>
				<p>The in-app FAA library. Handbooks, regulations, advisory circulars. Cited by everything else.</p>
			</Card>
		</a>
	</div>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.learn-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-lg);
	}

	.learn-card {
		text-decoration: none;
		color: inherit;
		display: block;
	}

	.learn-card :global(h2) {
		margin: 0 0 var(--space-xs) 0;
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--ink-body);
	}

	.learn-card :global(p) {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-body);
	}

	.learn-card:hover :global(.card),
	.learn-card:focus-visible :global(.card) {
		border-color: var(--action-default-hover);
		background: var(--surface-sunken);
	}
</style>
