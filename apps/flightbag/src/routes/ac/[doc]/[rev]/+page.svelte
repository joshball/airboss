<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title}</title>
</svelte:head>

<Breadcrumbs
	segments={[
		{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
		{ label: data.reference.title, href: null },
	]}
/>

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

{#if data.chapters.length === 0}
	<section class="callout" data-testid="ac-sourced-only">
		<p class="badge">Sourced only</p>
		<h2>This document hasn't been ingested yet.</h2>
		<p>
			Read the official FAA PDF below. The full reader will activate once the document is added to the corpus.
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
{:else}
	<section aria-label="Chapters">
		<h2>Contents</h2>
		<ol class="chapters">
			{#each data.chapters as chapter (chapter.id)}
				<li>
					<a href={chapter.href}>
						<span class="chapter-code">Ch {chapter.code}</span>
						<span class="chapter-title">{chapter.title}</span>
					</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.page-header h1 {
		margin: 0 0 var(--space-xs);
	}
	.meta {
		margin: 0;
		display: flex;
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.edition {
		font-family: var(--font-family-mono);
	}
	.chapters {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.chapters a {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
	}
	.chapters a:hover,
	.chapters a:focus-visible {
		border-color: var(--action-default-edge);
	}
	.chapter-code {
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
</style>
