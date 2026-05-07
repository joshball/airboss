<script lang="ts">
import InfoCard from '@ab/aviation/ui/cards/InfoCard.svelte';
import SafoCard from '@ab/aviation/ui/cards/SafoCard.svelte';
import { LIBRARY_ADVISORIES_KINDS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const safoBucket = $derived(data.buckets.find((b) => b.kind === LIBRARY_ADVISORIES_KINDS.SAFO));
const infoBucket = $derived(data.buckets.find((b) => b.kind === LIBRARY_ADVISORIES_KINDS.INFO));
const totalBulletins = $derived(data.buckets.reduce((acc, b) => acc + b.count, 0));
</script>

<svelte:head>
	<title>Advisories -- airboss</title>
</svelte:head>

<PageHeader title="Advisories" subtitle="FAA Safety Alerts and Information for Operators -- short bulletins, urgent voice.">
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<span>Advisories</span>
		</nav>
	{/snippet}
</PageHeader>

{#if totalBulletins === 0}
	<EmptyState
		title="No advisory bulletins seeded yet"
		body="Add SAFO or InFO references under course/references/ and run the seed."
	/>
{:else}
	{#if safoBucket && safoBucket.count > 0}
		<section aria-labelledby="safo-h" class="bucket">
			<header class="bucket-header">
				<h2 id="safo-h">{safoBucket.officialTitle}</h2>
				<p class="bucket-description">{safoBucket.description}</p>
				<p class="bucket-why">
					<span class="bucket-why-label">Why pilots care</span>
					<span>{safoBucket.whyItMatters}</span>
				</p>
			</header>
			<ul class="grid">
				{#each safoBucket.bulletins as ref (ref.id)}
					<li>
						<SafoCard
							safoNumber={ref.documentSlug}
							title={ref.officialTitle ?? ref.title}
							date={ref.date}
							summary={ref.description ?? null}
							audience={ref.audience}
							href={ROUTES.LIBRARY_ADVISORIES_DETAIL(ref.documentSlug)}
							external={ref.external}
						/>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if infoBucket && infoBucket.count > 0}
		<section aria-labelledby="info-h" class="bucket">
			<header class="bucket-header">
				<h2 id="info-h">{infoBucket.officialTitle}</h2>
				<p class="bucket-description">{infoBucket.description}</p>
				<p class="bucket-why">
					<span class="bucket-why-label">Why pilots care</span>
					<span>{infoBucket.whyItMatters}</span>
				</p>
			</header>
			<ul class="grid">
				{#each infoBucket.bulletins as ref (ref.id)}
					<li>
						<InfoCard
							infoNumber={ref.documentSlug}
							title={ref.officialTitle ?? ref.title}
							date={ref.date}
							summary={ref.description ?? null}
							audience={ref.audience}
							href={ROUTES.LIBRARY_ADVISORIES_DETAIL(ref.documentSlug)}
							external={ref.external}
						/>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

<style>
	.bucket {
		margin-bottom: var(--space-xl);
	}
	.bucket-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
		max-width: 70ch;
	}
	.bucket-header h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.bucket-description {
		margin: 0;
		font-size: var(--font-size-base);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.bucket-why {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.bucket-why-label {
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-size: var(--font-size-xs);
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
