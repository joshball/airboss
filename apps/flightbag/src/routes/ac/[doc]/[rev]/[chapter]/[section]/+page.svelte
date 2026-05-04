<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const segments = $derived([
	{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
	{ label: data.reference.title, href: data.reference.acHref },
	{ label: `Chapter ${data.chapter.code}`, href: data.reference.chapterHref },
	{ label: `§${data.section.code}`, href: null },
]);
</script>

<svelte:head>
	<title>{data.section.title} -- {data.reference.title}</title>
</svelte:head>

<div class="reader">
	<div class="primary">
		<RenderedSection
			title={`§${data.section.code} -- ${data.section.title}`}
			id={data.uri}
			body={data.section.contentMd}
			figures={data.figures}
			locator={data.section.sourceLocator}
			metadata={data.section.metadata}
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

	{#if data.siblings.length > 1}
		<aside class="toc" aria-label="Sections in this chapter">
			<h3>Chapter {data.chapter.code}: {data.chapter.title}</h3>
			<ol>
				{#each data.siblings as sib (sib.id)}
					<li class:active={sib.id === data.section.id}>
						<a href={sib.href}>
							<span class="sib-code">§{sib.code}</span>
							<span class="sib-title">{sib.title}</span>
						</a>
					</li>
				{/each}
			</ol>
		</aside>
	{/if}
</div>

<style>
	.reader {
		display: grid;
		grid-template-columns: 1fr 16rem;
		gap: var(--space-lg);
		align-items: start;
	}
	@media (max-width: 60rem) {
		.reader {
			grid-template-columns: 1fr;
		}
	}
	.toc {
		position: sticky;
		top: var(--space-md);
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}
	.toc h3 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-muted);
	}
	.toc ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.toc a {
		display: flex;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-xs);
		color: inherit;
		text-decoration: none;
		border-radius: var(--radius-sm);
	}
	.toc a:hover,
	.toc a:focus-visible {
		background: var(--surface-raised);
	}
	.toc li.active a {
		background: var(--surface-raised);
		color: var(--ink-strong);
		font-weight: var(--font-weight-medium);
	}
	.sib-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
	}
</style>
