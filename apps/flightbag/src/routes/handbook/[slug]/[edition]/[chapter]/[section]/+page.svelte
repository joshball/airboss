<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCDrawer from '@ab/library/TOCDrawer.svelte';
import HeartbeatTicker from '../../../../../../lib/HeartbeatTicker.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const segments = $derived([
	{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
	{ label: data.reference.title, href: data.reference.handbookHref },
	{ label: `Chapter ${data.chapter.code}`, href: data.reference.chapterHref },
	{ label: `§${data.section.code}`, href: null },
]);

const readSet = $derived(new Set(data.toc.readSectionIds));
const readCount = $derived(readSet.size);
const tocSummary = $derived(buildTocSummary(data.toc.entries.length, data.toc.totalMinutes, readCount));
const readSummary = $derived(formatReadSummary(data.readState));

function buildTocSummary(total: number, minutes: number, read: number): string | undefined {
	const parts: string[] = [];
	if (total > 0) parts.push(`${total} entries`);
	if (minutes > 0) parts.push(`≈ ${minutes} min`);
	if (read > 0) parts.push(`${read} read`);
	return parts.length > 0 ? parts.join(' · ') : undefined;
}

function formatReadSummary(state: typeof data.readState): string | undefined {
	if (!state || state.openedCount === 0) return undefined;
	const times = state.openedCount === 1 ? 'once' : `${state.openedCount} times`;
	if (!state.lastReadAt) return `You've read this ${times}.`;
	const date = new Date(state.lastReadAt);
	const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	return `You've read this ${times}; last on ${formatted}.`;
}
</script>

<svelte:head>
	<title>{data.section.title} -- {data.reference.title}</title>
</svelte:head>

<ReaderLayout>
	{#snippet tocSidebar()}
		<TOCDrawer
			entries={data.toc.entries}
			{readSet}
			heading={data.reference.title}
			headingHref={data.reference.handbookHref}
			summary={tocSummary}
		/>
	{/snippet}

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
			<Breadcrumbs {segments} />
			<SourceLinks
				localPdfHref={data.sourceLinks.localPdfHref}
				onlineUrl={data.sourceLinks.onlineUrl}
				localPdfMissing={data.sourceLinks.localPdfMissing}
			/>
			{#if readSummary}
				<p class="read-summary">{readSummary}</p>
			{/if}
		{/snippet}
		{#snippet emptyFallback()}
			<ReaderNav nav={data.nav} variant="empty" />
		{/snippet}
		{#snippet footer()}
			<ReaderNav nav={data.nav} variant="footer" />
		{/snippet}
	</RenderedSection>
	<HeartbeatTicker sectionId={data.section.id} enabled={data.isAuthenticated} />
</ReaderLayout>

<style>
	.read-summary {
		margin: var(--space-xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		font-style: italic;
	}
</style>
