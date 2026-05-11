<script lang="ts">
import HeartbeatTicker from '@ab/library/HeartbeatTicker.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import RichReaderHost from '../../../../../lib/RichReaderHost.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const isEndOfDoc = $derived(data.nav.next === null);
</script>

<svelte:head>
	<title>AIM ¶{data.paragraph.code} -- {data.paragraph.title}</title>
</svelte:head>

<RenderedSection
	title={`¶${data.paragraph.code} -- ${data.paragraph.title}`}
	id={data.uri}
	body={data.paragraph.contentMd}
	locator={data.paragraph.sourceLocator}
	metadata={data.paragraph.metadata}
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
	<HeartbeatTicker sectionId={data.paragraph.id} enabled={data.isAuthenticated} />
{/if}

<RichReaderHost
	section={{
		id: data.paragraph.id,
		title: data.paragraph.title,
		code: data.paragraph.code,
		airbossRef: data.uri,
	}}
	bodyText={data.paragraph.contentMd}
	isAuthenticated={data.isAuthenticated}
	annotationContext={data.annotationContext}
/>
