<script lang="ts">
import { ROUTES } from '@ab/constants';
import { useComposerState, useSectionContext } from '@ab/library';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCRender, { type TOCRenderEntry } from '@ab/library/TOCRender.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import RichReaderComposerPanel from '../../lib/RichReaderComposerPanel.svelte';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

const composerState = useComposerState();
const sectionContext = useSectionContext();
const composerOpen = $derived(Boolean((composerState && composerState.kind !== null) || sectionContext?.section));

const activeSectionId = $derived.by<string | null>(() => {
	const chapter = page.params.chapter;
	const section = page.params.section;
	const paragraph = page.params.paragraph;
	if (!chapter && !section && !paragraph) return null;
	for (const entry of data.readingOrder) {
		if (paragraph && entry.code === `${chapter}-${section}-${paragraph}`) return entry.sectionId;
		if (!paragraph && section && entry.code === `${chapter}-${section}`) return entry.sectionId;
		if (!section && chapter && entry.code === chapter) return entry.sectionId;
	}
	return null;
});

const readSet = $derived(new Set(data.readSectionIds));

const tocEntries = $derived.by<TOCRenderEntry[]>(() => {
	const entries: TOCRenderEntry[] = [];
	for (const entry of data.readingOrder) {
		const href = (() => {
			const parts = entry.code.split('-');
			if (parts.length === 1 && parts[0]) return ROUTES.FLIGHTBAG_AIM_CHAPTER(parts[0]);
			if (parts.length === 2 && parts[0] && parts[1]) return ROUTES.FLIGHTBAG_AIM_SECTION(parts[0], parts[1]);
			if (parts.length === 3 && parts[0] && parts[1] && parts[2])
				return ROUTES.FLIGHTBAG_AIM_PARAGRAPH(parts[0], parts[1], parts[2]);
			return null;
		})();
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
	if (total > 0) parts.push(`${total} entries`);
	if (read > 0) parts.push(`${read} read`);
	return parts.length > 0 ? parts.join(' · ') : undefined;
});
</script>

<ReaderLayout composerOpen={composerOpen}>
	{#snippet tocSidebar()}
		<TOCRender
			mode="rail"
			entries={tocEntries}
			{readSet}
			heading={data.aim.title}
			headingHref={ROUTES.FLIGHTBAG_AIM}
			summary={tocSummary}
		/>
	{/snippet}

	{#snippet breadcrumb()}
		<Breadcrumbs
			segments={[
				{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
				{ label: data.aim.title, href: ROUTES.FLIGHTBAG_AIM },
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
