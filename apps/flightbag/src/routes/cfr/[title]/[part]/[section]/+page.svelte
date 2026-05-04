<script lang="ts">
import { ROUTES } from '@ab/constants';
import ReaderNav from '@ab/library/ReaderNav.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.raw.title} CFR §{data.raw.part}.{data.raw.section}</title>
</svelte:head>

{#if data.section}
	<RenderedSection
		title={`${data.raw.title} CFR §${data.raw.part}.${data.raw.section} -- ${data.section.title}`}
		id={data.uri}
		body={data.section.contentMd}
		locator={data.section.sourceLocator}
		metadata={data.section.metadata}
	>
		{#snippet breadcrumb()}
			<nav aria-label="Breadcrumb" class="crumbs">
				<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo;
				<a href={data.reference.partHref}>{data.reference.title}</a> &raquo;
				<span>§{data.raw.part}.{data.raw.section}</span>
			</nav>
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
{:else}
	<nav aria-label="Breadcrumb" class="crumbs">
		<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo;
		<a href={data.reference.partHref}>{data.reference.title}</a> &raquo;
		<span>§{data.raw.part}.{data.raw.section}</span>
	</nav>
	<SourceLinks
		localPdfHref={data.sourceLinks.localPdfHref}
		onlineUrl={data.sourceLinks.onlineUrl}
		localPdfMissing={data.sourceLinks.localPdfMissing}
	/>
	<header class="page-header">
		<h1>{data.raw.title} CFR §{data.raw.part}.{data.raw.section}</h1>
	</header>
	<section class="callout">
		<h2>Read on eCFR</h2>
		<p>
			This section isn't ingested into the flightbag reader yet. The federal eCFR site is the authoritative
			source.
		</p>
		{#if data.ecfrUrl}
			<p>
				<a class="ecfr-link" href={data.ecfrUrl} target="_blank" rel="noopener noreferrer">
					Open §{data.raw.part}.{data.raw.section} on eCFR &rarr;
				</a>
			</p>
		{/if}
	</section>
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
	.callout {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		max-width: 72ch;
	}
	.callout h2 {
		margin: 0 0 var(--space-xs);
	}
	.callout p {
		margin: 0 0 var(--space-sm);
	}
	.callout p:last-child {
		margin-bottom: 0;
	}
	.ecfr-link {
		display: inline-block;
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--action-default);
		color: var(--action-default-ink, var(--ink-strong));
		text-decoration: none;
		font-weight: var(--font-weight-medium);
	}
</style>
