<script lang="ts">
import {
	AVIATION_TOPIC_LABELS,
	type AviationTopic,
	CERT_APPLICABILITIES,
	CERT_APPLICABILITY_LABELS,
	LIBRARY_REGULATIONS_KIND_LABELS,
	LIBRARY_TOPIC_VISIBLE_THRESHOLD,
	ROUTES,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// "Topics with <N entries collapse under a Show all toggle" per spec; N tunable via the constant.
const TOPIC_VISIBLE_THRESHOLD = LIBRARY_TOPIC_VISIBLE_THRESHOLD;

const visibleCertSpine = $derived(
	data.certSpine.filter((entry) => entry.cert !== CERT_APPLICABILITIES.ALL && entry.count > 0),
);

const allTopics = $derived(data.topicSpine);
const primaryTopics = $derived(allTopics.filter((entry) => entry.count >= TOPIC_VISIBLE_THRESHOLD));
const collapsedTopics = $derived(allTopics.filter((entry) => entry.count > 0 && entry.count < TOPIC_VISIBLE_THRESHOLD));

let showAllTopics = $state(false);

const visibleRegulationBuckets = $derived(data.regulationBuckets.filter((b) => b.count > 0));

const certCount = $derived(visibleCertSpine.length);
const topicCount = $derived(primaryTopics.length + collapsedTopics.length);
const regCount = $derived(visibleRegulationBuckets.length);
const aircraftCount = $derived(data.aircraft.length);

const totalSurfaces = $derived(certCount + topicCount + regCount + aircraftCount);
</script>

<svelte:head>
	<title>Library -- airboss</title>
</svelte:head>

<PageHeader
	title="Library"
	subtitle="Pick a cert spine, a cross-cutting topic, or a regulations & policy bucket. References live where they primarily apply; cross-cuts surface on the topic spines."
>
	{#snippet titleSuffix()}
		<PageHelp pageId="library" />
	{/snippet}
</PageHeader>

{#if totalSurfaces === 0}
	<EmptyState title="No references yet">
		{#snippet bodySnippet()}
			<p>
				References are added by your administrator -- check back, or browse
				<a href={ROUTES.KNOWLEDGE}>the knowledge graph</a> in the meantime.
			</p>
		{/snippet}
	</EmptyState>
{:else}
	<section class="spine" aria-labelledby="cert-spine-h">
		<h2 id="cert-spine-h">By cert</h2>
		<p class="spine-lead">References whose primary cert is this rating, plus carryover from upstream prereqs.</p>
		{#if visibleCertSpine.length === 0}
			<EmptyState title="No cert assignments yet" body="Run the reference seed to populate primary_cert." />
		{:else}
			<ul class="grid">
				{#each visibleCertSpine as entry (entry.cert)}
					<li>
						<a class="card cert-card" href={ROUTES.LIBRARY_CERT(entry.cert)}>
							<span class="card-title">{CERT_APPLICABILITY_LABELS[entry.cert]}</span>
							<span class="card-count">{entry.count} reference{entry.count === 1 ? '' : 's'}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="spine" aria-labelledby="topic-spine-h">
		<h2 id="topic-spine-h">By topic</h2>
		<p class="spine-lead">Cross-cutting subject groupings; a single reference can appear under several topics.</p>
		{#if primaryTopics.length === 0 && collapsedTopics.length === 0}
			<EmptyState title="No topic tags yet" body="Run the reference seed to populate subjects." />
		{:else}
			<ul class="grid" id="library-topics-list">
				{#each primaryTopics as entry (entry.topic)}
					<li>
						<a class="card topic-card" href={ROUTES.LIBRARY_TOPIC(entry.topic as AviationTopic)}>
							<span class="card-title">{AVIATION_TOPIC_LABELS[entry.topic as AviationTopic] ?? entry.topic}</span>
							<span class="card-count">{entry.count} reference{entry.count === 1 ? '' : 's'}</span>
						</a>
					</li>
				{/each}
				{#if showAllTopics}
					{#each collapsedTopics as entry (entry.topic)}
						<li>
							<a class="card topic-card" href={ROUTES.LIBRARY_TOPIC(entry.topic as AviationTopic)}>
								<span class="card-title">{AVIATION_TOPIC_LABELS[entry.topic as AviationTopic] ?? entry.topic}</span>
								<span class="card-count">{entry.count} reference{entry.count === 1 ? '' : 's'}</span>
							</a>
						</li>
					{/each}
				{/if}
			</ul>
			{#if collapsedTopics.length > 0}
				<button
					type="button"
					class="show-all"
					aria-expanded={showAllTopics}
					aria-controls="library-topics-list"
					onclick={() => (showAllTopics = !showAllTopics)}
				>
					{showAllTopics ? 'Hide smaller topics' : `Show all ${primaryTopics.length + collapsedTopics.length} topics`}
				</button>
			{/if}
		{/if}
	</section>

	<section class="spine" aria-labelledby="regs-spine-h">
		<h2 id="regs-spine-h">Regulations & policy</h2>
		<p class="spine-lead">Federal regulations, advisory circulars, and accident-investigation reports.</p>
		{#if visibleRegulationBuckets.length === 0}
			<EmptyState title="No regulatory references seeded yet" />
		{:else}
			<ul class="grid">
				{#each visibleRegulationBuckets as bucket (bucket.kind)}
					<li>
						<a class="card reg-card" href={ROUTES.LIBRARY_REGULATIONS_KIND(bucket.kind)}>
							<span class="card-title">{LIBRARY_REGULATIONS_KIND_LABELS[bucket.kind]}</span>
							<span class="card-count">{bucket.count} reference{bucket.count === 1 ? '' : 's'}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if aircraftCount > 0}
		<section class="spine" aria-labelledby="aircraft-spine-h">
			<h2 id="aircraft-spine-h">Aircraft-specific</h2>
			<p class="spine-lead">Pilot's Operating Handbooks and Aircraft Flight Manuals.</p>
			<ul class="grid">
				{#each data.aircraft as ac (ac.id)}
					<li>
						<a class="card aircraft-card" href={ROUTES.LIBRARY_AIRCRAFT(ac.documentSlug)}>
							<span class="card-title">{ac.title}</span>
							<span class="card-count">POH / AFM</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

<style>
	.spine {
		margin-bottom: var(--space-lg);
	}
	.spine h2 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-semibold);
	}
	.spine-lead {
		margin: 0 0 var(--space-sm);
		color: var(--ink-muted);
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
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
	.card:hover {
		border-color: var(--action-default-edge);
	}
	.card:focus-visible {
		border-color: var(--action-default-edge);
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.card-title {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
	}
	.card-count {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.show-all {
		margin-top: var(--space-sm);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill, var(--radius-md));
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}
	.show-all:hover {
		border-color: var(--action-default-edge);
	}
	.show-all:focus-visible {
		border-color: var(--action-default-edge);
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
