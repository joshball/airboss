<script lang="ts">
import AcsCard from '@ab/aviation/ui/cards/AcsCard.svelte';
import PtsCard from '@ab/aviation/ui/cards/PtsCard.svelte';
import { LIBRARY_TESTING_KIND_COPY, LIBRARY_TESTING_KINDS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const acsPublications = $derived(data.publications.filter((p) => p.testingKind === LIBRARY_TESTING_KINDS.ACS));
const ptsPublications = $derived(data.publications.filter((p) => p.testingKind === LIBRARY_TESTING_KINDS.PTS));

const acsCopy = LIBRARY_TESTING_KIND_COPY[LIBRARY_TESTING_KINDS.ACS];
const ptsCopy = LIBRARY_TESTING_KIND_COPY[LIBRARY_TESTING_KINDS.PTS];
</script>

<svelte:head>
	<title>Testing standards -- airboss</title>
</svelte:head>

<PageHeader
	title="Testing standards"
	subtitle="The FAA documents your check ride examiner is testing you against -- one publication per cert level."
>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo; <span>Testing standards</span>
		</nav>
	{/snippet}
</PageHeader>

{#if data.publications.length === 0}
	<EmptyState
		title="No testing-standards publications seeded yet"
		body="Add ACS / PTS reference rows under course/references/acs-pts.yaml and run the seed."
	/>
{:else}
	<section aria-labelledby="acs-h" class="kind-section">
		<header class="kind-header">
			<h2 id="acs-h">{acsCopy.officialTitle}</h2>
			<p class="kind-description">{acsCopy.description}</p>
			<p class="kind-why">
				<span class="kind-why-label">Why pilots care</span>
				<span>{acsCopy.whyItMatters}</span>
			</p>
		</header>

		{#if acsPublications.length === 0}
			<EmptyState title="No ACS publications seeded yet" body="Add ACS rows in course/references/acs-pts.yaml." />
		{:else}
			<ul class="grid">
				{#each acsPublications as pub (pub.id)}
					<li>
						<AcsCard
							slug={pub.documentSlug}
							title={pub.officialTitle ?? pub.title}
							edition={pub.edition}
							description={pub.description ?? null}
							whyItMatters={pub.whyItMatters ?? null}
							href={ROUTES.LIBRARY_TESTING_DETAIL(pub.documentSlug)}
							external={pub.externalUrl ? { url: pub.externalUrl, label: pub.publisher } : null}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-labelledby="pts-h" class="kind-section">
		<header class="kind-header">
			<h2 id="pts-h">{ptsCopy.officialTitle}</h2>
			<p class="kind-description">{ptsCopy.description}</p>
			<p class="kind-why">
				<span class="kind-why-label">Why pilots care</span>
				<span>{ptsCopy.whyItMatters}</span>
			</p>
		</header>

		{#if ptsPublications.length === 0}
			<EmptyState
				title="No PTS publications seeded yet"
				body="The CFII PTS lives here once the seed is run; everything else has migrated to ACS."
			/>
		{:else}
			<ul class="grid">
				{#each ptsPublications as pub (pub.id)}
					<li>
						<PtsCard
							slug={pub.documentSlug}
							title={pub.officialTitle ?? pub.title}
							edition={pub.edition}
							description={pub.description ?? null}
							whyItMatters={pub.whyItMatters ?? null}
							href={ROUTES.LIBRARY_TESTING_DETAIL(pub.documentSlug)}
							external={pub.externalUrl ? { url: pub.externalUrl, label: pub.publisher } : null}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.kind-section {
		margin-bottom: var(--space-2xl);
	}
	.kind-header {
		margin-bottom: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		max-width: 70ch;
	}
	.kind-header h2 {
		margin: 0;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-semibold);
	}
	.kind-description {
		margin: 0;
		font-size: var(--font-size-base);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.kind-why {
		margin: 0;
		padding: var(--space-md) var(--space-lg);
		border-left: 3px solid var(--action-default-edge);
		background: var(--surface-sunken, var(--surface-raised));
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		border-radius: var(--radius-sm);
	}
	.kind-why-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-lg);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
</style>
