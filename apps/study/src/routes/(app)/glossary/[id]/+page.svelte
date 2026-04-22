<script lang="ts">
import ReferenceText from '@ab/aviation/ui/ReferenceText.svelte';
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const reference = $derived(data.reference);
const related = $derived(data.related);
</script>

<svelte:head>
	<title>{reference.displayName} -- Glossary</title>
</svelte:head>

<section class="page">
	<nav class="crumbs" aria-label="Breadcrumb">
		<a href={ROUTES.GLOSSARY}>Glossary</a>
		<span aria-hidden="true">/</span>
		<span>{reference.displayName}</span>
	</nav>

	<header class="hd">
		<h1>{reference.displayName}</h1>
		<span class="id">{reference.id}</span>
	</header>

	<div class="tags">
		<span class="chip source">{reference.tags.sourceType}</span>
		<span class="chip rules">{reference.tags.flightRules}</span>
		<span class="chip kind">{reference.tags.knowledgeKind}</span>
		{#each reference.tags.aviationTopic as topic (topic)}
			<span class="chip topic">{topic}</span>
		{/each}
		{#if reference.tags.phaseOfFlight}
			{#each reference.tags.phaseOfFlight as phase (phase)}
				<span class="chip phase">{phase}</span>
			{/each}
		{/if}
		{#if reference.tags.certApplicability}
			{#each reference.tags.certApplicability as cert (cert)}
				<span class="chip cert">{cert}</span>
			{/each}
		{/if}
	</div>

	<section class="body">
		<h2>Paraphrase</h2>
		<ReferenceText source={reference.paraphrase} />
	</section>

	{#if reference.verbatim}
		<section class="body">
			<h2>
				Verbatim <span class="version">{reference.verbatim.sourceVersion}</span>
			</h2>
			<pre class="verbatim">{reference.verbatim.text}</pre>
		</section>
	{:else}
		<section class="body">
			<div class="pending">
				<strong>Verbatim pending extraction.</strong> The source text hasn't been materialized yet. Use the citation link(s)
				below to read the source directly.
			</div>
		</section>
	{/if}

	{#if reference.sources.length > 0}
		<section class="body">
			<h2>Sources</h2>
			<ul class="sources">
				{#each reference.sources as citation (citation.sourceId)}
					<li>
						<span class="sid">{citation.sourceId}</span>
						{#if citation.url}
							<a href={citation.url} target="_blank" rel="noopener noreferrer">open source</a>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if related.length > 0}
		<section class="body">
			<h2>Related</h2>
			<ul class="related">
				{#each related as rel (rel.id)}
					<li>
						<a href={ROUTES.GLOSSARY_ID(rel.id)}>{rel.displayName}</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}

	.crumbs {
		display: flex;
		gap: 0.375rem;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-muted, var(--ab-color-fg-muted));
	}

	.crumbs a {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px dotted currentColor;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--ab-font-size-xl);
		letter-spacing: -0.02em;
	}

	.id {
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle, var(--ab-color-fg-faint));
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.chip {
		display: inline-flex;
		padding: 0.125rem 0.5rem;
		font-size: var(--ab-font-size-xs);
		border-radius: var(--ab-radius-pill);
		background: var(--ab-color-surface-sunken, var(--ab-color-surface-sunken));
		color: var(--ab-color-fg-muted, var(--ab-color-fg-muted));
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border: 1px solid var(--ab-color-border, var(--ab-color-border));
	}

	.body h2 {
		margin: 0 0 0.5rem;
		font-size: var(--ab-font-size-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ab-color-fg-muted, var(--ab-color-fg-muted));
	}

	.body h2 .version {
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		color: var(--ab-color-fg-subtle, var(--ab-color-fg-faint));
		font-size: var(--ab-font-size-xs);
	}

	.verbatim {
		white-space: pre-wrap;
		background: var(--ab-color-surface-sunken, var(--ab-color-surface-muted));
		padding: 0.875rem 1rem;
		border-radius: var(--ab-radius-md);
		border: 1px solid var(--ab-color-border, var(--ab-color-border));
		margin: 0;
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		font-size: var(--ab-font-size-sm);
		line-height: 1.5;
	}

	.pending {
		padding: 0.75rem 1rem;
		border-radius: var(--ab-radius-md);
		background: var(--ab-color-warning-subtle);
		border: 1px solid var(--ab-color-warning-subtle-border);
		color: var(--ab-color-warning-hover);
		font-size: var(--ab-font-size-sm);
	}

	.sources {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.sources li {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.sid {
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		font-size: var(--ab-font-size-sm);
		padding: 0.0625rem 0.375rem;
		border-radius: var(--ab-radius-xs);
		background: var(--ab-color-surface-sunken, var(--ab-color-surface-sunken));
		color: var(--ab-color-fg-muted, var(--ab-color-fg-muted));
	}

	.related {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.related a {
		color: var(--ab-color-primary, var(--ab-color-primary));
		text-decoration: none;
		border-bottom: 1px dotted currentColor;
	}
</style>
