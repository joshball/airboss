<script lang="ts">
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import ReferenceCard from '@ab/library/ReferenceCard.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Flightbag -- airboss</title>
</svelte:head>

<ReaderLayout>
	{#snippet title()}
		Flightbag
	{/snippet}
	{#snippet subtitle()}
		<span>{data.totalReferences} reference{data.totalReferences === 1 ? '' : 's'} indexed</span>
	{/snippet}
	{#snippet pageHeaderExtra()}
		<p class="lead">
			Reader for every FAA reference document the platform has ingested. Deep-link any handbook section, AIM
			paragraph, CFR section, advisory circular, or ACS task -- citations from study, sim, and other surfaces
			resolve here.
		</p>
		<PageHelp pageId="library" />
	{/snippet}

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
						<ReferenceCard
							kind={card.kind}
							documentSlug={card.documentSlug}
							title={card.title}
							edition={card.edition}
							subjects={card.subjects}
							readerUrl={card.readerUrl}
							externalUrl={card.externalUrl}
							hasInlineBody={card.hasInlineBody}
						/>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</ReaderLayout>

<style>
	.lead {
		max-width: 72ch;
		margin: var(--space-2xs) 0 0;
		color: var(--ink-body);
		font-size: var(--font-size-lg);
		line-height: var(--line-height-relaxed);
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
</style>
