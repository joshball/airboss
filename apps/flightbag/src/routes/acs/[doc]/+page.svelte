<script lang="ts">
import { ROUTES } from '@ab/constants';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const hasSections = $derived(data.sections.length > 0);
</script>

<svelte:head>
	<title>{data.reference.title} -- Flightbag</title>
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
</header>

{#if hasSections}
	<section aria-label="Sections" class="sections">
		<h2>Areas of operation</h2>
		<ol>
			{#each data.sections as section (section.id)}
				<li class="level-{section.level}">
					<span class="section-code">{section.code}</span>
					<span class="section-title">{section.title}</span>
				</li>
			{/each}
		</ol>
	</section>
{:else}
	<section class="callout" data-testid="acs-sourced-only">
		<p class="badge">Sourced only</p>
		<h2>This document hasn't been ingested yet.</h2>
		<p>
			Read the official FAA PDF below. The full reader will activate once per-task content is added to the
			corpus.
		</p>
		<div class="callout-actions">
			{#if data.sourceLinks.localPdfHref}
				<a class="local-link" href={data.sourceLinks.localPdfHref}>Local PDF</a>
			{/if}
			{#if data.reference.externalUrl}
				<a class="external-link" href={data.reference.externalUrl} target="_blank" rel="noopener noreferrer">
					Online PDF &rarr;
				</a>
			{/if}
		</div>
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
		margin: 0 0 var(--space-md);
		display: flex;
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.edition {
		font-family: var(--font-family-mono);
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
	.badge {
		display: inline-block;
		padding: var(--space-3xs) var(--space-2xs);
		background: var(--surface-raised);
		color: var(--ink-muted);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin: 0 0 var(--space-xs);
	}
	.callout-actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		margin-top: var(--space-sm);
	}
	.external-link,
	.local-link {
		display: inline-block;
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--action-default);
		color: var(--action-default-ink, var(--ink-strong));
		text-decoration: none;
		font-weight: var(--font-weight-medium);
	}
	.local-link {
		background: var(--surface-raised);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
	}
	.sections ol {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.sections li {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}
	.section-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 4rem;
	}
</style>
