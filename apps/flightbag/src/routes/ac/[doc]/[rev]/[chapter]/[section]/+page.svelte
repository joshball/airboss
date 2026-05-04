<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
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

<div class="reader">
	<aside class="toc-rail">
		<TOCDrawer
			entries={data.toc.entries}
			heading={data.reference.title}
			headingHref={data.reference.acHref}
			summary={tocSummary}
		/>
	</aside>

	<div class="primary">
		<RenderedSection
			title={`§${data.section.code} -- ${data.section.title}`}
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
			{/snippet}
			{#snippet emptyFallback()}
				<ReaderNav nav={data.nav} variant="empty" />
			{/snippet}
			{#snippet footer()}
				<ReaderNav nav={data.nav} variant="footer" />
			{/snippet}
		</RenderedSection>
	</div>
</div>

<style>
	.reader {
		display: grid;
		grid-template-columns: 18rem minmax(0, 1fr);
		gap: var(--space-lg);
		align-items: start;
	}
	.toc-rail {
		position: sticky;
		top: var(--space-md);
	}
	.primary {
		min-width: 0;
	}
	@media (max-width: 60rem) {
		.reader {
			grid-template-columns: 1fr;
		}
		.toc-rail {
			position: static;
		}
	}
</style>
