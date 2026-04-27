<script lang="ts">
import { type HandbookReadStatus, ROUTES } from '@ab/constants';
import HandbookCitingNodesPanel from '@ab/ui/handbooks/HandbookCitingNodesPanel.svelte';
import HandbookEditionBadge from '@ab/ui/handbooks/HandbookEditionBadge.svelte';
import HandbookReadProgressControl from '@ab/ui/handbooks/HandbookReadProgressControl.svelte';
import HandbookSectionNotes from '@ab/ui/handbooks/HandbookSectionNotes.svelte';
import { renderMarkdown } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const bodyMd = $derived(stripFrontmatter(data.section.contentMd));
const bodyHtml = $derived(renderMarkdown(bodyMd));

function stripFrontmatter(md: string): string {
	if (!md.startsWith('---')) return md;
	const end = md.indexOf('\n---', 3);
	if (end < 0) return md;
	return md.slice(end + 4).replace(/^\n+/, '');
}

function figureUrl(assetPath: string): string {
	const stripped = assetPath.startsWith('handbooks/') ? assetPath.slice('handbooks/'.length) : assetPath;
	return `/handbook-asset/${stripped}`;
}
</script>

<svelte:head>
	<title>{data.section.title} -- {data.reference.title}</title>
</svelte:head>

<header class="page-header">
	<nav aria-label="Breadcrumb">
		<a href={ROUTES.HANDBOOKS}>Handbooks</a> &raquo;
		<a href={ROUTES.HANDBOOK(data.reference.documentSlug)}>{data.reference.title}</a> &raquo;
		<a href={ROUTES.HANDBOOK_CHAPTER(data.reference.documentSlug, data.chapter.code)}
			>Ch {data.chapter.code}</a
		>
		&raquo; <span>§{data.section.code}</span>
	</nav>
	<h1>
		{data.section.title}
		<HandbookEditionBadge edition={data.reference.edition} />
	</h1>
	<p class="locator">{data.section.sourceLocator}</p>
</header>

<div class="reader">
	<article class="section-body">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html bodyHtml}

		{#each data.figures as fig (fig.id)}
			<figure class="inline-figure">
				<img src={figureUrl(fig.assetPath)} alt={fig.caption} loading="lazy" />
				<figcaption>{fig.caption}</figcaption>
			</figure>
		{/each}
	</article>

	{#if data.siblings.length > 0}
		<aside class="toc" aria-label="Sections in this chapter">
			<h3>In this chapter</h3>
			<ul>
				{#each data.siblings as sibling (sibling.id)}
					<li class:active={sibling.id === data.section.id}>
						<a
							href={ROUTES.HANDBOOK_SECTION(
								data.reference.documentSlug,
								data.chapter.code,
								sibling.code.split('.').slice(1).join('.'),
							)}
						>
							§{sibling.code} {sibling.title}
						</a>
					</li>
				{/each}
			</ul>
		</aside>
	{/if}
</div>

<HandbookCitingNodesPanel nodes={data.citingNodes} scope="section" />

<HandbookReadProgressControl
	status={data.readState.status as HandbookReadStatus}
	comprehended={data.readState.comprehended}
	formAction="?/"
/>

<HandbookSectionNotes notesMd={data.readState.notesMd} formAction="?/set-notes" />

<style>
	.page-header {
		margin-bottom: var(--space-lg);
	}
	.page-header nav {
		color: var(--ink-muted);
		margin-bottom: var(--space-xs);
	}
	.page-header nav a {
		color: inherit;
	}
	.page-header h1 {
		margin: 0 0 var(--space-xs) 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}
	.locator {
		margin: 0;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}
	.reader {
		display: grid;
		grid-template-columns: 1fr 15rem;
		gap: var(--space-lg);
	}
	@media (max-width: 56rem) {
		.reader {
			grid-template-columns: 1fr;
		}
	}
	.section-body {
		line-height: var(--line-height-relaxed);
	}
	.section-body :global(p) {
		margin: 0 0 var(--space-sm) 0;
	}
	.section-body :global(h1),
	.section-body :global(h2),
	.section-body :global(h3) {
		margin: var(--space-lg) 0 var(--space-xs) 0;
	}
	.toc {
		position: sticky;
		top: var(--space-md);
		align-self: start;
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}
	.toc h3 {
		margin: 0 0 var(--space-xs) 0;
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
	}
	.toc ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.toc li {
		padding: var(--space-2xs) 0;
	}
	.toc li.active a {
		color: var(--action-default);
		font-weight: var(--font-weight-medium);
	}
	.toc a {
		color: inherit;
		text-decoration: none;
	}
	.toc a:hover,
	.toc a:focus-visible {
		text-decoration: underline;
	}
	.inline-figure {
		margin: var(--space-md) 0;
		text-align: center;
	}
	.inline-figure img {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-md);
	}
	.inline-figure figcaption {
		margin-top: var(--space-xs);
		color: var(--ink-muted);
	}
</style>
