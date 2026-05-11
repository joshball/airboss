<script lang="ts">
import HeartbeatTicker from '@ab/library/HeartbeatTicker.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const readSummary = $derived(formatReadSummary(data.readState));

function formatReadSummary(state: typeof data.readState): string | undefined {
	if (!state || state.openedCount === 0) return undefined;
	const times = state.openedCount === 1 ? 'once' : `${state.openedCount} times`;
	if (!state.lastReadAt) return `You've read this ${times}.`;
	const date = new Date(state.lastReadAt);
	const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	return `You've read this ${times}; last on ${formatted}.`;
}

const isEndOfDoc = $derived(data.nav.next === null);
</script>

<svelte:head>
	<title>{data.section.title} -- {data.reference.title}</title>
</svelte:head>

<RenderedSection
	title={data.section.title}
	id={data.uri}
	body={data.section.contentMd}
	figures={data.figures}
	locator={data.section.sourceLocator}
	metadata={data.section.metadata}
	readingTimeMinutes={data.readingTime.sectionMinutes}
>
	{#snippet breadcrumb()}
		{#if readSummary}
			<p class="read-summary">{readSummary}</p>
		{/if}
	{/snippet}
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

<style>
	.read-summary {
		margin: 0 0 var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		font-style: italic;
	}
</style>
