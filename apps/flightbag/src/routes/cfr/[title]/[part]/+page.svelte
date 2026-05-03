<script lang="ts">
import { ROUTES } from '@ab/constants';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title}</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="crumbs">
	<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo; <span>{data.reference.title}</span>
</nav>

<SourceLinks
	localPdfHref={data.sourceLinks.localPdfHref}
	onlineUrl={data.sourceLinks.onlineUrl}
	localPdfMissing={data.sourceLinks.localPdfMissing}
/>

<header class="page-header">
	<h1>{data.reference.title}</h1>
	<p class="meta">
		<span class="edition">{data.reference.edition}</span>
		<span class="publisher">{data.reference.publisher}</span>
	</p>
	{#if data.reference.subjects.length > 0}
		<p class="subjects">
			{#each data.reference.subjects as subject (subject)}
				<span class="subject">{subject}</span>
			{/each}
		</p>
	{/if}
</header>

{#if data.sections.length > 0}
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
	<section class="callout">
		<h2>Read on eCFR</h2>
		<p>
			This Part has been catalogued in airboss but its individual sections aren't ingested into the flightbag
			reader yet. The authoritative source is the federal eCFR site -- it stays current with amendments and
			supports per-section deep links.
		</p>
		{#if data.ecfrUrl}
			<p>
				<a class="ecfr-link" href={data.ecfrUrl} target="_blank" rel="noopener noreferrer">
					Open Part {data.reference.documentSlug.replace(/^\d+cfr/, '')} on eCFR &rarr;
				</a>
			</p>
		{/if}
	</section>
{/if}

<style>
	.crumbs {
		color: var(--ink-muted);
		margin-bottom: var(--space-sm);
		font-size: var(--font-size-sm);
	}
	.crumbs a {
		color: inherit;
	}
	.page-header h1 {
		margin: 0 0 var(--space-xs);
	}
	.meta {
		margin: 0 0 var(--space-xs);
		display: flex;
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.edition {
		font-family: var(--font-family-mono);
	}
	.subjects {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}
	.subject {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		padding: var(--space-2xs) var(--space-xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
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

	.callout {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		max-width: 72ch;
	}
	.callout h2 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-lg);
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
