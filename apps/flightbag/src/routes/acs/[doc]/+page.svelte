<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const hasAreas = $derived(data.areas.length > 0);
const hasFrontMatter = $derived(data.publication.contentMd.trim().length > 0);
</script>

<svelte:head>
	<title>{data.reference.title} -- Flightbag</title>
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
	{#if data.reference.externalUrl}
		<p class="external">
			<a href={data.reference.externalUrl} target="_blank" rel="noopener noreferrer">
				FAA testing portal &rarr;
			</a>
		</p>
	{/if}
</header>

{#if hasFrontMatter}
	<RenderedSection
		title="Introduction"
		id={`${data.uri}#publication`}
		body={data.publication.contentMd}
	/>
{/if}

{#if hasAreas}
	<section aria-labelledby="areas-h" class="areas">
		<h2 id="areas-h">Areas of Operation</h2>
		<ol class="areas-list">
			{#each data.areas as area (area.id)}
				<li class="area">
					<header class="area-header">
						<h3>
							<span class="area-eyebrow">Area of Operation {area.code}</span>
							<span class="area-title">{area.title}</span>
						</h3>
						<p class="task-count">
							{area.tasks.length}
							{area.tasks.length === 1 ? 'task' : 'tasks'}
						</p>
					</header>
					{#if area.tasks.length > 0}
						<ol class="tasks-list">
							{#each area.tasks as task (task.id)}
								<li class="task">
									<a href={task.href} class="task-link">
										<span class="task-code">Task {task.letter.toUpperCase()}</span>
										<span class="task-title">{task.title}</span>
									</a>
								</li>
							{/each}
						</ol>
					{/if}
				</li>
			{/each}
		</ol>
	</section>
{:else}
	<section class="callout" data-testid="acs-sourced-only">
		<p class="badge">Sourced only</p>
		<h2>This ACS hasn't been ingested into the reader yet.</h2>
		<p>
			The areas of operation and per-task content live in the FAA PDF until ACS ingest produces section rows here.
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
	.page-header h1 {
		margin: 0 0 var(--space-xs);
	}
	.meta {
		margin: 0 0 var(--space-2xs);
		display: flex;
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.edition {
		font-family: var(--font-family-mono);
	}
	.external {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-sm);
	}
	.external a {
		color: var(--ink-muted);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.external a:hover,
	.external a:focus-visible {
		color: var(--ink-strong);
	}

	.areas h2 {
		margin: var(--space-lg) 0 var(--space-sm);
	}
	.areas-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}
	.area {
		padding: var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel, var(--surface-raised));
	}
	.area-header {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		margin-bottom: var(--space-sm);
	}
	.area-header h3 {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}
	.area-eyebrow {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: var(--font-weight-medium);
	}
	.area-title {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-strong);
	}
	.task-count {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		font-family: var(--font-family-mono);
	}

	.tasks-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.task-link {
		display: flex;
		gap: var(--space-sm);
		align-items: baseline;
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		background: var(--surface-sunken, transparent);
		color: inherit;
		text-decoration: none;
	}
	.task-link:hover,
	.task-link:focus-visible {
		border-color: var(--action-default-edge);
		background: var(--surface-raised);
	}
	.task-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 5rem;
		font-size: var(--font-size-sm);
	}
	.task-title {
		flex: 1;
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
