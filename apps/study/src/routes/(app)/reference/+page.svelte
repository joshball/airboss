<!--
@component
Reference section index (study-app-ia-cleanup Phase 3).

Always-on, pre-goal-friendly entry point for "look things up": the
knowledge graph + the canonical glossary. Replaces nothing; the section
itself is new in Phase 3 and folds the previously top-level `/knowledge`
and `/glossary` surfaces underneath.

Per spec.md "Section taglines", the index opens with the one-line
explanation of what the section is for, followed by linked cards into
the children.
-->
<script lang="ts">
import { NAV_LABELS, PAGE_EXPLAINER_KEYS, ROUTES } from '@ab/constants';
import Card from '@ab/ui/components/Card.svelte';
import PageExplainer from '@ab/ui/components/PageExplainer.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import Tooltip from '@ab/ui/components/Tooltip.svelte';
import { page } from '$app/state';

const flightbagOrigin = $derived(page.data.flightbagOrigin ?? '');
const libraryHref = $derived(`${flightbagOrigin}${ROUTES.FLIGHTBAG_HOME}`);
</script>

<svelte:head>
	<title>Reference -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		title={NAV_LABELS.REFERENCE}
		subtitle="Look things up -- the knowledge graph, the glossary, and the FAA library."
	/>

	<PageExplainer pageKey={PAGE_EXPLAINER_KEYS.REFERENCE}>
		The Reference section is the lookup surface. The
		<Tooltip for="knowledge-node">knowledge graph</Tooltip>
		groups every aviation concept the platform knows about; the
		<Tooltip for="glossary-drawer">glossary</Tooltip>
		defines the terms used across the rest of the app. Both stay reachable even before you set a goal.
	</PageExplainer>

	<div class="ref-grid">
		<a class="ref-card" href={ROUTES.REFERENCE_KNOWLEDGE}>
			<Card>
				<h2>{NAV_LABELS.REFERENCE_KNOWLEDGE}</h2>
				<p>Browse the knowledge graph -- atomic concepts, their prerequisites, and what cites them.</p>
			</Card>
		</a>
		<a class="ref-card" href={ROUTES.REFERENCE_GLOSSARY}>
			<Card>
				<h2>{NAV_LABELS.REFERENCE_GLOSSARY}</h2>
				<p>The canonical glossary. Hover any term in the app for the short form; this page lists everything.</p>
			</Card>
		</a>
		<a class="ref-card" href={libraryHref}>
			<Card>
				<h2>{NAV_LABELS.LIBRARY}</h2>
				<p>The in-app FAA library -- handbook chapters, regulations, advisory circulars.</p>
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

	.ref-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-lg);
	}

	.ref-card {
		display: block;
		text-decoration: none;
		color: inherit;
	}

	.ref-card h2 {
		margin: 0 0 var(--space-xs) 0;
		font-size: var(--type-heading-3-size);
		font-weight: var(--type-heading-2-weight);
		color: var(--ink-body);
	}

	.ref-card p {
		margin: 0;
		color: var(--ink-muted);
	}

	.ref-card:hover :global(.card),
	.ref-card:focus-visible :global(.card) {
		border-color: var(--action-default);
	}
</style>
