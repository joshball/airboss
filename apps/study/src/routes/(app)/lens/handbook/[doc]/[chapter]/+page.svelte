<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const reference = $derived(data.reference);
const chapter = $derived(data.chapter);
const sections = $derived(data.sections);

const totalCitingNodes = $derived(sections.reduce((acc, s) => acc + s.citingNodes.length, 0));
</script>

<svelte:head>
	<title>{reference.title} Ch {chapter.code} -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.LENS_HANDBOOK}>{NAV_LABELS.LENS_HANDBOOK}</a>
		<span aria-hidden="true">/</span>
		<a href={ROUTES.LENS_HANDBOOK_DOC(reference.documentSlug)}>{reference.title}</a>
		<span aria-hidden="true">/</span>
		<span>Ch {chapter.code}</span>
	</nav>

	<PageHeader
		eyebrow="Chapter {chapter.code} -- {reference.title}"
		title={chapter.title}
		subtitle="{sections.length} section{sections.length === 1 ? '' : 's'}; {totalCitingNodes} citing knowledge node{totalCitingNodes === 1 ? '' : 's'}."
	/>

	{#if sections.length === 0}
		<EmptyState title="No sections" body="This chapter has no sections in the database." />
	{:else}
		<ul class="sections">
			{#each sections as entry (entry.section.id)}
				<li class="section">
					<header class="sec-head">
						<span class="sec-code">{entry.section.code}</span>
						<a
							class="sec-title"
							href={`${ROUTES.HANDBOOKS}/${reference.documentSlug}/${chapter.code}/${entry.section.code}`}
						>
							{entry.section.title}
						</a>
						<span class="sec-meta">{entry.citingNodes.length} citing node{entry.citingNodes.length === 1 ? '' : 's'}</span>
					</header>
					{#if entry.citingNodes.length > 0}
						<ul class="cite-list">
							{#each entry.citingNodes as node (node.id)}
								<li>
									<a href={ROUTES.KNOWLEDGE_SLUG(node.id)} data-testid="lens-citing-node">
										{node.title}
									</a>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted">No knowledge nodes cite this section yet.</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 80rem;
		margin: 0 auto;
		width: 100%;
	}

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.crumb a {
		color: var(--ink-subtle);
	}

	.muted {
		color: var(--ink-faint);
		font-size: var(--font-size-sm);
		margin: 0;
	}

	.sections {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.section {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
	}

	.sec-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		margin-bottom: var(--space-sm);
		flex-wrap: wrap;
	}

	.sec-code {
		color: var(--ink-faint);
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-sm);
	}

	.sec-title {
		font-weight: var(--font-weight-semibold);
		color: var(--action-link);
		text-decoration: none;
	}

	.sec-meta {
		margin-left: auto;
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}

	.cite-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.cite-list li {
		padding: var(--space-2xs) var(--space-sm);
		background: var(--surface-panel);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-pill);
	}

	.cite-list a {
		color: var(--action-link);
		text-decoration: none;
	}
</style>
