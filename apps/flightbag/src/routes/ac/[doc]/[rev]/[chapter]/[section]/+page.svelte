<script lang="ts">
import HeartbeatTicker from '@ab/library/HeartbeatTicker.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import RichReaderHost from '../../../../../../lib/RichReaderHost.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const isEndOfDoc = $derived(data.nav.next === null);
</script>

<svelte:head>
	<title>{data.section.title} -- {data.reference.title}</title>
</svelte:head>

<RenderedSection
	title={`§${data.section.code} -- ${data.section.title}`}
	id={data.uri}
	body={data.section.contentMd}
	figures={data.figures}
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
		code: `${data.reference.title} §${data.section.code}`,
		airbossRef: data.uri,
	}}
	bodyText={data.section.contentMd}
	isAuthenticated={data.isAuthenticated}
	annotationContext={data.annotationContext}
/>
