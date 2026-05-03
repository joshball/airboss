<script lang="ts">
import { ROUTES } from '@ab/constants';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title} -- Chapter {data.chapter.code}</title>
</svelte:head>

{#if data.sections.length > 0}
	<nav aria-label="Breadcrumb" class="crumbs">
		<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo;
		<a href={data.reference.acHref}>{data.reference.title}</a> &raquo;
		<span>Chapter {data.chapter.code}</span>
	</nav>

	<SourceLinks
		localPdfHref={data.sourceLinks.localPdfHref}
		onlineUrl={data.sourceLinks.onlineUrl}
		localPdfMissing={data.sourceLinks.localPdfMissing}
	/>

	<header class="page-header">
		<h1>Chapter {data.chapter.code}: {data.chapter.title}</h1>
	</header>

	{#if data.chapter.contentMd}
		<RenderedSection
			title=""
			id={data.uri}
			body={data.chapter.contentMd}
			locator={data.chapter.sourceLocator}
		/>
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
{:else}
	<RenderedSection
		title={`Chapter ${data.chapter.code}: ${data.chapter.title}`}
		id={data.uri}
		body={data.chapter.contentMd}
		locator={data.chapter.sourceLocator}
	>
		{#snippet breadcrumb()}
			<nav aria-label="Breadcrumb" class="crumbs">
				<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo;
				<a href={data.reference.acHref}>{data.reference.title}</a> &raquo;
				<span>Chapter {data.chapter.code}</span>
			</nav>
			<SourceLinks
				localPdfHref={data.sourceLinks.localPdfHref}
				onlineUrl={data.sourceLinks.onlineUrl}
				localPdfMissing={data.sourceLinks.localPdfMissing}
			/>
		{/snippet}
	</RenderedSection>
{/if}

<style>
	:global(.crumbs) {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	:global(.crumbs a) {
		color: inherit;
	}
	.page-header h1 {
		margin: 0 0 var(--space-md);
	}
	.sections {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.sections a {
		display: flex;
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
</style>
