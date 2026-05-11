<script lang="ts">
import ReaderEmptyState from '@ab/library/ReaderEmptyState.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>AIM Chapter {data.chapter.code} -- {data.chapter.title}</title>
</svelte:head>

<header class="title-block">
	<h1>Chapter {data.chapter.code}: {data.chapter.title}</h1>
</header>

{#if data.sections.length === 0}
	<ReaderEmptyState
		kind="no-children"
		localPdfHref={data.sourceLinks.localPdfHref}
		externalUrl={data.sourceLinks.onlineUrl}
		heading="No sections seeded under this chapter."
		note="The chapter is catalogued but its sections aren't ingested into the reader yet."
	/>
{:else}
	<section aria-label="Sections">
		<h2>Sections</h2>
		<ol class="sections">
			{#each data.sections as section (section.id)}
				<li>
					<a href={section.href}>
						<span class="section-code">§{section.code}</span>
						<span class="section-title">{section.title}</span>
					</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.title-block {
		margin-bottom: var(--space-lg);
	}
	.title-block h1 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}
	.sections {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.sections a {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
	}
	.sections a:hover,
	.sections a:focus-visible {
		border-color: var(--action-default-edge);
	}
	.section-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 4rem;
	}
</style>
