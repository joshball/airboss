<script lang="ts">
import { ROUTES } from '@ab/constants';
import RenderedSection from '@ab/library/RenderedSection.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.section.title} -- {data.reference.title}</title>
</svelte:head>

<div class="reader">
	<div class="primary">
		<RenderedSection
			title={data.section.title}
			id={data.uri}
			body={data.section.contentMd}
			figures={data.figures}
			locator={data.section.sourceLocator}
		>
			{#snippet breadcrumb()}
				<nav aria-label="Breadcrumb" class="crumbs">
					<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo;
					<a href={data.reference.handbookHref}>{data.reference.title}</a> &raquo;
					<a href={data.reference.chapterHref}>Chapter {data.chapter.code}</a> &raquo;
					<span>§{data.section.code}</span>
				</nav>
			{/snippet}
		</RenderedSection>
	</div>

	{#if data.siblings.length > 1}
		<aside class="toc" aria-label="Sections in this chapter">
			<h3>Chapter {data.chapter.code}: {data.chapter.title}</h3>
			<ol>
				{#each data.siblings as sib (sib.id)}
					<li class:active={sib.id === data.section.id}>
						<a href={sib.href}>
							<span class="sib-code">§{sib.code}</span>
							<span class="sib-title">{sib.title}</span>
						</a>
					</li>
				{/each}
			</ol>
		</aside>
	{/if}
</div>

<style>
	:global(.crumbs) {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	:global(.crumbs a) {
		color: inherit;
	}

	.reader {
		display: grid;
		grid-template-columns: 1fr 16rem;
		gap: var(--space-lg);
		align-items: start;
	}
	@media (max-width: 60rem) {
		.reader {
			grid-template-columns: 1fr;
		}
	}

	.toc {
		position: sticky;
		top: var(--space-md);
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}
	.toc h3 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-muted);
	}
	.toc ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.toc a {
		display: flex;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-xs);
		color: inherit;
		text-decoration: none;
		border-radius: var(--radius-sm);
	}
	.toc a:hover,
	.toc a:focus-visible {
		background: var(--surface-raised);
	}
	.toc li.active a {
		background: var(--surface-raised);
		color: var(--ink-strong);
		font-weight: var(--font-weight-medium);
	}
	.sib-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
	}
</style>
