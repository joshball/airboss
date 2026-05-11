<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCDrawer from '@ab/library/TOCDrawer.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const segments = $derived([
	{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
	{ label: data.reference.title, href: data.reference.acHref },
	{ label: `Chapter ${data.chapter.code}`, href: data.reference.chapterHref },
	{ label: `§${data.section.code}`, href: null },
]);

const tocSummary = $derived(
	data.toc.totalMinutes > 0 ? `${data.toc.entries.length} entries · ≈ ${data.toc.totalMinutes} min` : undefined,
);
</script>

<svelte:head>
	<title>{data.section.title} -- {data.reference.title}</title>
</svelte:head>

<ReaderLayout sectionId={data.section.id} heartbeatEnabled={data.isAuthenticated}>
	{#snippet tocSidebar()}
		<TOCDrawer
			entries={data.toc.entries}
			heading={data.reference.title}
			headingHref={data.reference.acHref}
			summary={tocSummary}
		/>
	{/snippet}

	{#snippet breadcrumb()}
		<Breadcrumbs {segments} />
	{/snippet}

	{#snippet sourceLinks()}
		<SourceLinks
			localPdfHref={data.sourceLinks.localPdfHref}
			onlineUrl={data.sourceLinks.onlineUrl}
			localPdfMissing={data.sourceLinks.localPdfMissing}
		/>
	{/snippet}

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
			<ReaderNav nav={data.nav} variant="footer" />
		{/snippet}
	</RenderedSection>
</ReaderLayout>
