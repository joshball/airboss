<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const hasElements = $derived(
	data.elements.knowledge.length + data.elements.risk.length + data.elements.skill.length > 0,
);
</script>

<svelte:head>
	<title>
		Task {data.task.letter.toUpperCase()}. {data.task.title} -- {data.reference.title}
	</title>
</svelte:head>

<Breadcrumbs
	segments={[
		{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
		{ label: data.reference.title, href: data.reference.acsHref },
		{ label: `Area ${data.area.code}: ${data.area.title}`, href: data.reference.acsHref },
		{ label: `Task ${data.task.letter.toUpperCase()}: ${data.task.title}`, href: null },
	]}
/>

<SourceLinks
	localPdfHref={data.sourceLinks.localPdfHref}
	onlineUrl={data.sourceLinks.onlineUrl}
	localPdfMissing={data.sourceLinks.localPdfMissing}
/>

<header class="page-header">
	<p class="eyebrow">
		Area of Operation {data.area.code} &middot; {data.area.title}
	</p>
	<h1>Task {data.task.letter.toUpperCase()}. {data.task.title}</h1>
	<p class="task-code">{data.task.code}</p>
</header>

{#if data.task.references}
	<section class="meta-block" aria-labelledby="references-h">
		<h2 id="references-h">References</h2>
		<p>{data.task.references}</p>
	</section>
{/if}

{#if data.task.objective}
	<section class="meta-block" aria-labelledby="objective-h">
		<h2 id="objective-h">Objective</h2>
		<p>{data.task.objective}</p>
	</section>
{/if}

{#if hasElements}
	<section class="elements" aria-labelledby="knowledge-h">
		{#if data.elements.knowledge.length > 0}
			<h2 id="knowledge-h">Knowledge</h2>
			<p class="lede">The applicant demonstrates understanding of:</p>
			<ul class="element-list">
				{#each data.elements.knowledge as element (element.id)}
					<li>
						<span class="element-code">{element.code}</span>
						<span class="element-title">{element.title}</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if data.elements.risk.length > 0}
			<h2 id="risk-h">Risk Management</h2>
			<p class="lede">The applicant identifies, assesses, and mitigates risk associated with:</p>
			<ul class="element-list">
				{#each data.elements.risk as element (element.id)}
					<li>
						<span class="element-code">{element.code}</span>
						<span class="element-title">{element.title}</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if data.elements.skill.length > 0}
			<h2 id="skills-h">Skills</h2>
			<p class="lede">The applicant exhibits the skill to:</p>
			<ul class="element-list">
				{#each data.elements.skill as element (element.id)}
					<li>
						<span class="element-code">{element.code}</span>
						<span class="element-title">{element.title}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{:else}
	<section class="callout">
		<h2>No element rows seeded for this task.</h2>
		<p>
			The task body is in the FAA PDF below. Element-level extraction has not yet produced K/R/S rows for this
			task.
		</p>
		{#if data.reference.externalUrl}
			<p>
				<a class="external-link" href={data.reference.externalUrl} target="_blank" rel="noopener noreferrer">
					Open ACS portal &rarr;
				</a>
			</p>
		{/if}
	</section>
{/if}

<nav class="task-nav" aria-label="Task navigation">
	{#if data.nav.prev}
		<a class="nav-link prev" href={data.nav.prev.href}>
			<span class="nav-direction">&larr; Previous task</span>
			<span class="nav-code">{data.nav.prev.code}</span>
			<span class="nav-label">{data.nav.prev.label}</span>
		</a>
	{:else}
		<span class="nav-spacer"></span>
	{/if}
	<a class="nav-link up" href={data.reference.acsHref}>
		<span class="nav-direction">Up to publication</span>
		<span class="nav-label">{data.reference.title}</span>
	</a>
	{#if data.nav.next}
		<a class="nav-link next" href={data.nav.next.href}>
			<span class="nav-direction">Next task &rarr;</span>
			<span class="nav-code">{data.nav.next.code}</span>
			<span class="nav-label">{data.nav.next.label}</span>
		</a>
	{:else}
		<span class="nav-spacer"></span>
	{/if}
</nav>

<style>
	.page-header {
		margin-bottom: var(--space-lg);
	}
	.page-header h1 {
		margin: 0 0 var(--space-2xs);
	}
	.eyebrow {
		margin: 0 0 var(--space-2xs);
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}
	.task-code {
		margin: 0;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}

	.meta-block {
		margin: var(--space-md) 0;
		max-width: 72ch;
	}
	.meta-block h2 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}
	.meta-block p {
		margin: 0;
		line-height: var(--line-height-relaxed);
	}

	.elements {
		margin-top: var(--space-lg);
		max-width: 72ch;
	}
	.elements h2 {
		margin: var(--space-lg) 0 var(--space-xs);
		font-size: var(--font-size-lg);
	}
	.elements h2:first-of-type {
		margin-top: 0;
	}
	.lede {
		margin: 0 0 var(--space-xs);
		color: var(--ink-muted);
		font-style: italic;
	}
	.element-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
	.element-list li {
		display: grid;
		grid-template-columns: minmax(7rem, max-content) 1fr;
		gap: var(--space-sm);
		padding: var(--space-2xs) 0;
		border-bottom: 1px dashed var(--edge-subtle, var(--edge-default));
	}
	.element-list li:last-child {
		border-bottom: none;
	}
	.element-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.element-title {
		line-height: var(--line-height-relaxed);
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

	.task-nav {
		margin-top: var(--space-2xl);
		padding-top: var(--space-md);
		border-top: 1px solid var(--edge-default);
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: var(--space-md);
		align-items: stretch;
	}
	.nav-link {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		background: var(--surface-raised);
	}
	.nav-link:hover,
	.nav-link:focus-visible {
		border-color: var(--action-default-edge);
	}
	.nav-link.next {
		text-align: right;
	}
	.nav-link.up {
		align-items: center;
		text-align: center;
	}
	.nav-direction {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}
	.nav-code {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
	.nav-label {
		font-weight: var(--font-weight-medium);
	}
	.nav-spacer {
		display: block;
	}
</style>
