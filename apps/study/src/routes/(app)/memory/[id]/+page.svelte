<script lang="ts">
import CardCitationsPanel from './_panels/CardCitationsPanel.svelte';
import CardCrossRefsPanel from './_panels/CardCrossRefsPanel.svelte';
import CardDetailPanel from './_panels/CardDetailPanel.svelte';
import CardHeaderPanel from './_panels/CardHeaderPanel.svelte';
import CardRecentReviewsPanel from './_panels/CardRecentReviewsPanel.svelte';
import CardSchedulePanel from './_panels/CardSchedulePanel.svelte';
import type { ActionData, PageData } from './$types';

/**
 * Owner-detail page for a single memory card. This orchestrates layout
 * across six panels; each panel owns its own slice of state and event
 * handling. Server form actions live in `+page.server.ts`.
 */

let { data, form }: { data: PageData; form: ActionData } = $props();

const card = $derived(data.card);
const schedule = $derived(data.state);
const recentReviews = $derived(data.recentReviews);
const crossRefs = $derived(data.crossRefs);
const citations = $derived(data.citations);
</script>

<svelte:head>
	<title>{card.front.slice(0, 60)} -- airboss</title>
</svelte:head>

<section class="page">
	<CardHeaderPanel {card} />

	<CardDetailPanel {card} {form} />

	<CardCitationsPanel cardId={card.id} {citations} />

	<CardSchedulePanel {schedule} />

	<CardCrossRefsPanel {crossRefs} />

	<CardRecentReviewsPanel {recentReviews} />
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}
</style>
