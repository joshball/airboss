<script lang="ts">
import HeartbeatTicker from '@ab/library/HeartbeatTicker.svelte';
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import RichReaderHost from '../../../../../lib/RichReaderHost.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const isEndOfDoc = $derived(data.nav.next === null);
</script>

<svelte:head>
	<title>{data.raw.title} CFR §{data.raw.part}.{data.raw.section}</title>
</svelte:head>

{#if data.section}
	<RenderedSection
		title={`${data.raw.title} CFR §${data.raw.part}.${data.raw.section} -- ${data.section.title}`}
		id={data.uri}
		body={data.section.contentMd}
		locator={data.section.sourceLocator}
		metadata={data.section.metadata}
		readingTimeMinutes={data.readingTime.sectionMinutes}
	>
		{#snippet emptyFallback()}
			<ReaderNav nav={data.nav} variant="empty" />
		{/snippet}
		{#snippet footer()}
			<ReaderNav
				nav={data.nav}
				variant={isEndOfDoc ? 'end-of-doc' : 'footer'}
				endOfDocSummary={isEndOfDoc ? `End of ${data.reference.title}.` : undefined}
			/>
		{/snippet}
	</RenderedSection>
	{#if data.isAuthenticated}
		<HeartbeatTicker sectionId={data.section.id} enabled={data.isAuthenticated} />
	{/if}
	<RichReaderHost
		section={{
			id: data.section.id,
			title: data.section.title,
			code: `${data.raw.title} CFR §${data.raw.part}.${data.raw.section}`,
			airbossRef: data.uri,
		}}
		bodyText={data.section.contentMd}
		isAuthenticated={data.isAuthenticated}
		annotationContext={data.annotationContext}
	/>
{:else}
	<header class="page-header-inline">
		<h1>{data.raw.title} CFR §{data.raw.part}.{data.raw.section}</h1>
	</header>
	<ReaderEmptyState
		kind="not-yet-ingested"
		externalUrl={data.ecfrUrl}
		heading="Read on eCFR"
		note="This section isn't ingested into the flightbag reader yet. The federal eCFR site is the authoritative source."
		externalLabel={`Open §${data.raw.part}.${data.raw.section} on eCFR`}
	/>
{/if}

<style>
	.page-header-inline {
		margin-bottom: var(--space-md);
	}
	.page-header-inline h1 {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}
</style>
