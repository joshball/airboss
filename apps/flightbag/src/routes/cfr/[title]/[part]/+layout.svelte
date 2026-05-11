<script lang="ts">
import { ROUTES } from '@ab/constants';
import { useComposerState } from '@ab/library';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCRender, { type TOCRenderEntry } from '@ab/library/TOCRender.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import RichReaderComposerPanel from '../../../../lib/RichReaderComposerPanel.svelte';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

const composerState = useComposerState();
const composerOpen = $derived(Boolean(composerState && composerState.kind !== null));

const partLandingHref = $derived(ROUTES.FLIGHTBAG_CFR_PART(data.cfr.titleParam, data.cfr.partParam));

const activeSectionId = $derived.by<string | null>(() => {
	const section = page.params.section;
	if (!section) return null;
	for (const entry of data.readingOrder) {
		if (entry.code === section) return entry.sectionId;
	}
	return null;
});

const readSet = $derived(new Set(data.readSectionIds));

const tocEntries = $derived.by<TOCRenderEntry[]>(() => {
	const entries: TOCRenderEntry[] = [];
	for (const entry of data.readingOrder) {
		const href = ROUTES.FLIGHTBAG_CFR_SECTION(data.cfr.titleParam, data.cfr.partParam, entry.code);
		entries.push({
			sectionId: entry.sectionId,
			code: entry.code,
			title: entry.title,
			depth: entry.depth,
			href,
			minutesToRead: Math.max(1, Math.round(entry.wordCount / 250)),
			isActive: entry.sectionId === activeSectionId,
		});
	}
	return entries;
});

const tocSummary = $derived.by(() => {
	const total = tocEntries.length;
	const read = tocEntries.filter((e) => readSet.has(e.sectionId)).length;
	const parts: string[] = [];
	if (total > 0) parts.push(`${total} sections`);
	if (read > 0) parts.push(`${read} read`);
	return parts.length > 0 ? parts.join(' · ') : undefined;
});
</script>

<ReaderLayout composerOpen={composerOpen}>
	{#snippet tocSidebar()}
		{#if tocEntries.length > 0}
			<TOCRender
				mode="rail"
				entries={tocEntries}
				{readSet}
				heading={data.cfr.title}
				headingHref={partLandingHref}
				summary={tocSummary}
			/>
		{/if}
	{/snippet}

	{#snippet breadcrumb()}
		<Breadcrumbs
			segments={[
				{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
				{ label: data.cfr.title, href: partLandingHref },
			]}
		/>
	{/snippet}

	{#snippet sourceLinks()}
		<SourceLinks
			localPdfHref={data.sourceLinks.localPdfHref}
			onlineUrl={data.sourceLinks.onlineUrl}
			localPdfMissing={data.sourceLinks.localPdfMissing}
		/>
	{/snippet}

	{#snippet composer()}
		<RichReaderComposerPanel />
	{/snippet}

	{@render children()}
</ReaderLayout>
