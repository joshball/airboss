<script lang="ts">
import { CONCEPT_GROUP_LABELS, ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Concepts -- Help -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<p class="crumb"><a href={ROUTES.HELP}>Help</a> / Concepts</p>
		<h1>Concepts</h1>
		<p class="sub">
			The ideas airboss is built on -- learning science, platform architecture, and aviation doctrine. {data.totalCount}
			concept page{data.totalCount === 1 ? '' : 's'}.
		</p>
	</header>

	{#if data.groups.length === 0}
		<div class="empty">
			<h2>No concept pages registered</h2>
			<p>The concept library is empty. Ten foundational pages ship as Phase 2 of session-legibility-and-help-expansion.</p>
		</div>
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

	.crumb {
		margin: 0 0 var(--space-xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.crumb a {
		color: inherit;
		text-decoration: none;
	}

	.crumb a:hover {
		color: var(--ink-body);
		text-decoration: underline;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		letter-spacing: -0.02em;
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		max-width: 48rem;
		line-height: 1.5;
	}

	.empty {
		border: 1px dashed var(--edge-strong);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl) var(--space-xl);
		text-align: center;
		color: var(--ink-muted);
	}

	.empty h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--type-reading-lead-size);
		color: var(--ink-body);
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
