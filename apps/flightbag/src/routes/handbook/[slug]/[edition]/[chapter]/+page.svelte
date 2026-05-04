<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCDrawer from '@ab/library/TOCDrawer.svelte';
import { hasChapterPreamble } from '../../../../../lib/chapter-preamble';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const hasPreamble = $derived(hasChapterPreamble({ contentMd: data.chapter.contentMd, figures: data.figures }));
const hasSections = $derived(data.sections.length > 0);

const segments = $derived([
	{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
	{ label: data.reference.title, href: data.reference.handbookHref },
	{ label: `Chapter ${data.chapter.code}`, href: null },
]);

const tocSummary = $derived(
	data.toc.totalMinutes > 0 ? `${data.toc.entries.length} entries · ≈ ${data.toc.totalMinutes} min` : undefined,
);
</script>

<svelte:head>
	<title>{data.reference.title} -- Chapter {data.chapter.code}</title>
</svelte:head>

<div class="reader">
	<aside class="toc-rail">
		<TOCDrawer
			entries={data.toc.entries}
			heading={data.reference.title}
			headingHref={data.reference.handbookHref}
			summary={tocSummary}
		/>
	</aside>

	<div class="primary">
		{#if hasSections}
			<Breadcrumbs {segments} />

			<SourceLinks
				localPdfHref={data.sourceLinks.localPdfHref}
				onlineUrl={data.sourceLinks.onlineUrl}
				localPdfMissing={data.sourceLinks.localPdfMissing}
			/>

			{#if hasPreamble}
				<RenderedSection
					title={`Chapter ${data.chapter.code}: ${data.chapter.title}`}
					id={data.uri}
					body={data.chapter.contentMd}
					figures={data.figures}
					locator={data.chapter.sourceLocator}
					metadata={data.chapter.metadata}
				/>
			{:else}
				<header class="page-header">
					<h1>Chapter {data.chapter.code}: {data.chapter.title}</h1>
					{#if data.chapter.sourceLocator}
						<p class="locator">{data.chapter.sourceLocator}</p>
					{/if}
				</header>
			{/if}

			<section aria-label="Sections">
				<h2>Sections</h2>
				<ol class="sections">
					{#each data.sections as section (section.id)}
						<li>
							<a href={section.href}>
								<span class="section-code">§{section.code}</span>
								<span class="section-title">{section.title}</span>
							</a>
						</li>
					{/each}
				</ol>
			</section>

			<ReaderNav nav={data.nav} variant="footer" />
		{:else}
			<RenderedSection
				title={`Chapter ${data.chapter.code}: ${data.chapter.title}`}
				id={data.uri}
				body={data.chapter.contentMd}
				figures={data.figures}
				locator={data.chapter.sourceLocator}
				metadata={data.chapter.metadata}
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
		{/if}
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

	.page-header {
		margin-bottom: var(--space-lg);
	}
	.page-header h1 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}
	.locator {
		margin: 0;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}

	.sections {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.sections a {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
	}
	.sections a:hover,
	.sections a:focus-visible {
		border-color: var(--action-default-edge);
	}
	.section-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 4rem;
	}
	.section-title {
		flex: 1;
	}
</style>
