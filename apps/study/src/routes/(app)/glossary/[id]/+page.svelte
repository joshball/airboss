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
		gap: var(--space-lg);
	}

	.crumbs {
		display: flex;
		gap: var(--space-xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
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
		gap: var(--space-md);
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		letter-spacing: -0.02em;
	}

	.id {
		font-family: var(--font-family-mono, ui-monospace, monospace);
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.chip {
		display: inline-flex;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		border: 1px solid var(--edge-default);
	}

	.body h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-label-size);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.body h2 .version {
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		color: var(--ink-subtle);
		font-size: var(--type-ui-caption-size);
	}

	.verbatim {
		white-space: pre-wrap;
		background: var(--surface-sunken);
		padding: var(--space-md) var(--space-lg);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		margin: 0;
		font-family: var(--font-family-mono, ui-monospace, monospace);
		font-size: var(--type-ui-label-size);
		line-height: 1.5;
	}

	.pending {
		padding: var(--space-md) var(--space-lg);
		border-radius: var(--radius-md);
		background: var(--signal-warning-wash);
		border: 1px solid var(--signal-warning-edge);
		color: var(--signal-warning);
		font-size: var(--type-ui-label-size);
	}

	.sources {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.sources li {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.sid {
		font-family: var(--font-family-mono, ui-monospace, monospace);
		font-size: var(--type-ui-label-size);
		padding: 1px var(--space-xs);
		border-radius: var(--radius-xs);
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.related {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.related a {
		color: var(--action-default);
		text-decoration: none;
		border-bottom: 1px dotted currentColor;
	}
</style>
