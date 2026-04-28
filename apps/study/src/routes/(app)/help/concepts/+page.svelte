<script lang="ts">
import { CONCEPT_GROUP_LABELS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Concepts -- Help -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		title="Concepts"
		subtitle={`The ideas airboss is built on -- learning science, platform architecture, and aviation doctrine. ${data.totalCount} concept page${data.totalCount === 1 ? '' : 's'}.`}
	>
		{#snippet eyebrowSnippet()}
			<a href={ROUTES.HELP}>Help</a> / Concepts
		{/snippet}
	</PageHeader>

	{#if data.groups.length === 0}
		<EmptyState
			title="No concept pages registered"
			body="The concept library is empty. Ten foundational pages ship as Phase 2 of session-legibility-and-help-expansion."
		/>
	{:else}
		{#each data.groups as group (group.group)}
			<section class="group" aria-labelledby={`group-${group.group}`}>
				<h2 id={`group-${group.group}`}>{CONCEPT_GROUP_LABELS[group.group]}</h2>
				<ul class="cards">
					{#each group.pages as page (page.id)}
						<li>
							<a href={ROUTES.HELP_ID(page.id)} class="card">
								<span class="title">{page.title}</span>
								<span class="summary">{page.summary}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.group h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--type-reading-body-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--space-md);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md) var(--space-lg);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
		text-decoration: none;
		color: inherit;
	}

	.card:hover {
		border-color: var(--action-default);
	}

	.card:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.title {
		font-weight: var(--type-heading-3-weight);
		font-size: var(--type-reading-body-size);
	}

	.summary {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		line-height: 1.45;
	}
</style>
