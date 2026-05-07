<script lang="ts">
import PohCard from '@ab/aviation/ui/cards/PohCard.svelte';
import { AVIATION_TOPIC_LABELS, type AviationTopic, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import LearnTabs from '$lib/components/LearnTabs.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

function chipsFor(topics: readonly string[]): { value: string; label: string }[] {
	return topics.map((t) => ({ value: t, label: AVIATION_TOPIC_LABELS[t as AviationTopic] ?? t }));
}
</script>

<svelte:head>
	<title>Aircraft -- Library -- airboss</title>
</svelte:head>

<LearnTabs active="read" />

<PageHeader
	title="Aircraft"
	subtitle="Pilot Operating Handbooks and Aircraft Flight Manuals. The POH is your airframe's source of truth -- speeds, limits, emergency procedures, and weight & balance all live here."
>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo; <span>Aircraft</span>
		</nav>
	{/snippet}
</PageHeader>

{#if data.aircraft.length === 0}
	<EmptyState title="No aircraft authored yet">
		{#snippet bodySnippet()}
			<p>
				Per-aircraft POHs are seeded from <code>course/references/aircraft.yaml</code> with manufacturer voice from
				<code>aircraft/_authoring/poh.yaml</code>. Run <code>bun run db seed handbooks</code> to populate them.
			</p>
		{/snippet}
	</EmptyState>
{:else}
	<ul class="grid">
		{#each data.aircraft as ac (ac.id)}
			<li>
				<PohCard
					aircraftModel={ac.aircraftModel}
					title={ac.title}
					revision={ac.revision}
					manufacturer={ac.manufacturer}
					revisionDate={ac.revisionDate}
					applicableSerialNumbers={ac.applicableSerialNumbers}
					description={ac.description}
					whyItMatters={ac.whyItMatters}
					topics={chipsFor(ac.topics)}
					href={ROUTES.LIBRARY_AIRCRAFT(ac.documentSlug)}
					external={ac.externalUrl ? { url: ac.externalUrl, label: ac.manufacturer } : null}
				/>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-md);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
</style>
