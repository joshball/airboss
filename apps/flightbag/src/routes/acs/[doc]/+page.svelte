<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.reference.title} -- Flightbag</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="crumbs">
	<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo; <span>{data.reference.title}</span>
</nav>

<header class="page-header">
	<h1>{data.reference.title}</h1>
	<p class="meta">
		<span class="edition">{data.reference.edition}</span>
		<span class="publisher">{data.reference.publisher}</span>
	</p>
</header>

<section class="callout">
	<h2>Read on faa.gov</h2>
	<p>
		The FAA's Airman Certification Standards portal is the authoritative source for ACS publications. Per-task
		content is on the airboss roadmap; until then, the FAA's PDF is the canonical reference.
	</p>
	{#if data.reference.externalUrl}
		<p>
			<a class="external-link" href={data.reference.externalUrl} target="_blank" rel="noopener noreferrer">
				Open ACS portal &rarr;
			</a>
		</p>
	{/if}
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
	.external-link {
		display: inline-block;
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--action-default);
		color: var(--action-default-ink, var(--ink-strong));
		text-decoration: none;
		font-weight: var(--font-weight-medium);
	}
</style>
