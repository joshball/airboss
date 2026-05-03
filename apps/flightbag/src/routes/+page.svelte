<script lang="ts">
import { REFERENCE_KIND_LABELS } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Flightbag -- airboss</title>
</svelte:head>

<header class="hero">
	<h1>Flightbag</h1>
	<p class="lead">
		Reader for every FAA reference document the platform has ingested. Deep-link any handbook section, AIM
		paragraph, CFR section, advisory circular, or ACS task -- citations from study, sim, and other surfaces
		resolve here.
	</p>
	<p class="meta">{data.totalReferences} reference{data.totalReferences === 1 ? '' : 's'} indexed</p>
</header>

{#each data.groups as group (group.id)}
	<section class="group" aria-labelledby="group-{group.id}">
		<header>
			<h2 id="group-{group.id}">{group.label}</h2>
			<p class="group-subtitle">{group.subtitle}</p>
			<p class="group-count">{group.cards.length} reference{group.cards.length === 1 ? '' : 's'}</p>
		</header>
		<ul class="cards">
			{#each group.cards as card (card.id)}
				<li>
					{#if card.readerUrl}
						<a class="card" href={card.readerUrl} data-kind={card.kind} data-slug={card.documentSlug}>
							<span class="card-title">{card.title}</span>
							<span class="card-edition">{card.edition}</span>
							<span class="card-meta">
								<span class="badge">{REFERENCE_KIND_LABELS[card.kind]}</span>
								{#if card.hasInlineBody}
									<span class="badge badge-inline">Read in-app</span>
								{:else if card.externalUrl}
									<span class="badge badge-external">External</span>
								{/if}
							</span>
							{#if card.subjects.length > 0}
								<span class="card-subjects">
									{#each card.subjects as subject (subject)}
										<span class="subject">{subject}</span>
									{/each}
								</span>
							{/if}
						</a>
					{:else if card.externalUrl}
						<a
							class="card card-external"
							href={card.externalUrl}
							rel="noopener noreferrer"
							target="_blank"
							data-kind={card.kind}
							data-slug={card.documentSlug}
						>
							<span class="card-title">{card.title}</span>
							<span class="card-edition">{card.edition}</span>
							<span class="card-meta">
								<span class="badge">{REFERENCE_KIND_LABELS[card.kind]}</span>
								<span class="badge badge-external">External</span>
							</span>
							{#if card.subjects.length > 0}
								<span class="card-subjects">
									{#each card.subjects as subject (subject)}
										<span class="subject">{subject}</span>
									{/each}
								</span>
							{/if}
						</a>
					{:else}
						<div class="card card-disabled" data-kind={card.kind} data-slug={card.documentSlug}>
							<span class="card-title">{card.title}</span>
							<span class="card-edition">{card.edition}</span>
							<span class="card-meta">
								<span class="badge">{REFERENCE_KIND_LABELS[card.kind]}</span>
							</span>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/each}

<style>
	.hero {
		max-width: 72ch;
		margin-bottom: var(--space-xl);
	}
	.hero h1 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}
	.lead {
		margin: 0 0 var(--space-xs);
		color: var(--ink-body);
		font-size: var(--font-size-lg);
		line-height: var(--line-height-relaxed);
	}
	.meta {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.group {
		margin-bottom: var(--space-2xl);
	}
	.group header h2 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-semibold);
	}
	.group-subtitle {
		margin: 0 0 var(--space-xs);
		color: var(--ink-muted);
	}
	.group-count {
		margin: 0 0 var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}
	.card:hover,
	.card:focus-visible {
		border-color: var(--action-default-edge);
	}
	.card:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.card-disabled {
		opacity: 0.7;
	}
	.card-title {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
	}
	.card-edition {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}
	.card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}
	.badge {
		display: inline-block;
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		letter-spacing: var(--letter-spacing-wide);
		text-transform: uppercase;
	}
	.badge-inline {
		background: var(--action-default-edge);
		color: var(--action-default-ink, var(--ink-strong));
	}
	.badge-external {
		background: var(--surface-panel);
		color: var(--ink-muted);
	}
	.card-subjects {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
		margin-top: var(--space-2xs);
	}
	.subject {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		padding: var(--space-2xs) var(--space-xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}
</style>
