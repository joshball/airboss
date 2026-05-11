<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCDrawer from '@ab/library/TOCDrawer.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const segments = $derived([
	{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
	{ label: data.reference.title, href: data.reference.partHref },
	{ label: `§${data.raw.part}.${data.raw.section}`, href: null },
]);

// Only show the TOC drawer when the doc has any reading-order entries we can
// link to -- avoids a blank rail on a not-yet-ingested CFR Part.
const hasTOC = $derived(data.toc.entries.length > 0);
const tocSummary = $derived(
	data.toc.totalMinutes > 0 ? `${data.toc.entries.length} entries · ≈ ${data.toc.totalMinutes} min` : undefined,
);
const heartbeatSectionId = $derived(data.section?.id);
const heartbeatEnabled = $derived(data.isAuthenticated && Boolean(data.section));
</script>

<svelte:head>
	<title>{data.raw.title} CFR §{data.raw.part}.{data.raw.section}</title>
</svelte:head>

<ReaderLayout sectionId={heartbeatSectionId} {heartbeatEnabled}>
	{#snippet tocSidebar()}
		{#if hasTOC}
			<TOCDrawer
				entries={data.toc.entries}
				heading={data.reference.title}
				headingHref={data.reference.partHref}
				summary={tocSummary}
			/>
		{/if}
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
				<ReaderNav nav={data.nav} variant="footer" />
			{/snippet}
		</RenderedSection>
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
</ReaderLayout>

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
