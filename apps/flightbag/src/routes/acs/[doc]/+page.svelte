<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCDrawer from '@ab/library/TOCDrawer.svelte';
import { buildAcsTocEntries } from '../../../lib/acs-toc';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const hasAreas = $derived(data.areas.length > 0);
const hasFrontMatter = $derived(data.publication.contentMd.trim().length > 0);

const tocEntries = $derived(
	buildAcsTocEntries({
		documentSlug: data.reference.documentSlug,
		areas: data.areas,
		activeTaskId: null,
	}),
);
</script>

<svelte:head>
	<title>{data.reference.title} -- Flightbag</title>
</svelte:head>

<ReaderLayout>
	{#snippet breadcrumb()}
		<Breadcrumbs
			segments={[
				{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
				{ label: data.reference.title, href: null },
			]}
		/>
	{/snippet}

	{#snippet sourceLinks()}
		<SourceLinks
			localPdfHref={data.sourceLinks.localPdfHref}
			onlineUrl={data.sourceLinks.onlineUrl}
			localPdfMissing={data.sourceLinks.localPdfMissing}
		/>
	{/snippet}

	{#snippet title()}
		{data.reference.title}
	{/snippet}

	{#snippet subtitle()}
		<span class="edition">{data.reference.edition}</span>
		<span class="publisher">{data.reference.publisher}</span>
	{/snippet}

	{#snippet pageHeaderExtra()}
		{#if data.reference.externalUrl}
			<p class="external">
				<a href={data.reference.externalUrl} target="_blank" rel="noopener noreferrer">
					FAA testing portal &rarr;
				</a>
			</p>
		{/if}
	{/snippet}

	{#snippet tocSidebar()}
		{#if hasAreas}
			<TOCDrawer
				entries={tocEntries}
				heading={data.reference.title}
				headingHref={ROUTES.FLIGHTBAG_ACS(data.reference.documentSlug)}
				summary={`${data.areas.length} areas`}
				collapsibleGroups
			/>
		{/if}
	{/snippet}

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
		<ReaderEmptyState
			kind="sourced-only"
			localPdfHref={data.sourceLinks.localPdfHref}
			externalUrl={data.reference.externalUrl}
			heading="This ACS hasn't been ingested into the reader yet."
			note="The areas of operation and per-task content live in the FAA PDF until ACS ingest produces section rows here."
			externalLabel="Online PDF"
		/>
	{/if}
</ReaderLayout>

<style>
	.edition {
		font-family: var(--font-family-mono);
	}
	.external {
		margin: var(--space-2xs) 0 0;
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
</style>
