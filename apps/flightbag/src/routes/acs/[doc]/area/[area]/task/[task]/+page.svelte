<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title} -- Area {data.raw.area} / Task {data.raw.task}</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="crumbs">
	<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo;
	<a href={data.reference.acsHref}>{data.reference.title}</a> &raquo;
	<span>Area {data.raw.area} / Task {data.raw.task}</span>
</nav>

<header class="page-header">
	<h1>{data.reference.title}</h1>
	<p class="meta">Area {data.raw.area} / Task {data.raw.task}</p>
</header>

<section class="callout">
	<h2>Per-task content not yet ingested</h2>
	<p>
		ACS task content (knowledge / risk-management / skill triads) hasn't been ingested into the flightbag reader
		yet. The FAA's PDF is the canonical reference until that lands.
	</p>
	{#if data.reference.externalUrl}
		<p>
			<a class="external-link" href={data.reference.externalUrl} target="_blank" rel="noopener noreferrer">
				Open ACS portal &rarr;
			</a>
		</p>
	{/if}
	<p>
		<a class="back-link" href={data.reference.acsHref}>Back to {data.reference.title}</a>
	</p>
</section>

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
		color: var(--ink-muted);
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
	.external-link {
		display: inline-block;
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--action-default);
		color: var(--action-default-ink, var(--ink-strong));
		text-decoration: none;
		font-weight: var(--font-weight-medium);
	}
	.back-link {
		color: var(--ink-muted);
	}
</style>
