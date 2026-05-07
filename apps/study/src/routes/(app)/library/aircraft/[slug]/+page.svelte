<script lang="ts">
import PohCard from '@ab/aviation/ui/cards/PohCard.svelte';
import { AVIATION_TOPIC_LABELS, type AviationTopic, ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import LearnTabs from '$lib/components/LearnTabs.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// Topic slugs come off `metadata.topics` as plain strings; lift them to the
// `{ value, label }` shape the card consumes. Unknown values fall back to
// the slug so a YAML drift doesn't blow up the render.
const topicChips = $derived(
	data.reference.topics.map((t) => ({
		value: t,
		label: AVIATION_TOPIC_LABELS[t as AviationTopic] ?? t,
	})),
);

const externalLink = $derived(
	data.reference.externalUrl ? { url: data.reference.externalUrl, label: data.reference.manufacturer } : null,
);
</script>

<svelte:head>
	<title>{data.reference.title} -- airboss</title>
</svelte:head>

<LearnTabs active="read" />

<PageHeader title={data.reference.title}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_AIRCRAFT_LANDING}>Aircraft</a> &raquo;
			<span>{data.reference.aircraftModel}</span>
		</nav>
	{/snippet}
	{#snippet subtitleSnippet()}
		<p class="subtitle">Aircraft-specific reference -- {data.reference.manufacturer}</p>
	{/snippet}
</PageHeader>

<div class="card-wrap">
	<PohCard
		aircraftModel={data.reference.aircraftModel}
		title={data.reference.title}
		revision={data.reference.revision}
		manufacturer={data.reference.manufacturer}
		revisionDate={data.reference.revisionDate}
		applicableSerialNumbers={data.reference.applicableSerialNumbers}
		description={data.reference.description}
		whyItMatters={data.reference.whyItMatters}
		topics={topicChips}
		external={externalLink}
	/>
</div>

<p class="explainer">
	POH/AFM content is manufacturer-specific and not redistributed through this app. The card above links to the
	publisher's source when an external URL is on file.
</p>

<style>
	.subtitle {
		margin: 0;
		color: var(--ink-muted);
	}
	.card-wrap {
		max-width: 36rem;
		margin-bottom: var(--space-md);
	}
	.explainer {
		color: var(--ink-muted);
		max-width: 60ch;
	}
</style>
