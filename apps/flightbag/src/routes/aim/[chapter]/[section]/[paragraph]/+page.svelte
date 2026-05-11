<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { BreadcrumbSegment } from '@ab/library';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCDrawer from '@ab/library/TOCDrawer.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const segments = $derived.by((): BreadcrumbSegment[] => {
	const trail: BreadcrumbSegment[] = [
		{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
		{ label: data.reference.title, href: data.links.aimHref },
		{ label: `Chapter ${data.paragraph.code.split('-')[0]}`, href: data.links.chapterHref },
	];
	if (data.section) {
		trail.push({ label: `§${data.section.code}`, href: data.links.sectionHref });
	}
	trail.push({ label: `¶${data.paragraph.code}`, href: null });
	return trail;
});

const tocSummary = $derived(
	data.toc.totalMinutes > 0 ? `${data.toc.entries.length} entries · ≈ ${data.toc.totalMinutes} min` : undefined,
);
</script>

<svelte:head>
	<title>AIM ¶{data.paragraph.code} -- {data.paragraph.title}</title>
</svelte:head>

<ReaderLayout sectionId={data.paragraph.id} heartbeatEnabled={data.isAuthenticated}>
	{#snippet tocSidebar()}
		<TOCDrawer
			entries={data.toc.entries}
			heading={data.reference.title}
			headingHref={data.links.aimHref}
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
			<ReaderNav nav={data.nav} variant="footer" />
		{/snippet}
	</RenderedSection>
</ReaderLayout>
