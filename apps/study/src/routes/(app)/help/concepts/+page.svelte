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
		gap: var(--ab-space-xl-hi);
	}

	.crumb {
		margin: 0 0 var(--ab-space-xs);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-muted);
	}

	.crumb a {
		color: inherit;
		text-decoration: none;
	}

	.crumb a:hover {
		color: var(--ab-color-fg);
		text-decoration: underline;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--ab-font-size-xl);
		letter-spacing: -0.02em;
	}

	.sub {
		margin: var(--ab-space-2xs) 0 0;
		color: var(--ab-color-fg-muted);
		max-width: 48rem;
		line-height: 1.5;
	}

	.empty {
		border: 1px dashed var(--ab-color-border-strong);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-2xl) var(--ab-space-xl);
		text-align: center;
		color: var(--ab-color-fg-muted);
	}

	.empty h2 {
		margin: 0 0 var(--ab-space-md);
		font-size: var(--ab-font-size-lg);
		color: var(--ab-color-fg);
	}

	.group h2 {
		margin: 0 0 var(--ab-space-md);
		font-size: var(--ab-font-size-base);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ab-color-fg-muted);
	}

	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--ab-space-md);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xs);
		padding: var(--ab-space-md-alt) var(--ab-space-lg);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		background: var(--ab-color-surface);
		text-decoration: none;
		color: inherit;
	}

	.card:hover {
		border-color: var(--ab-color-primary);
	}

	.card:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring);
		outline-offset: 2px;
	}

	.title {
		font-weight: var(--ab-font-weight-semibold);
		font-size: var(--ab-font-size-base);
	}

	.summary {
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-muted);
		line-height: 1.45;
	}
</style>
