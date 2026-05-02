<script lang="ts">
import HandbookCitingNodesPanel from '@ab/aviation/ui/handbooks/HandbookCitingNodesPanel.svelte';
import HandbookEditionBadge from '@ab/aviation/ui/handbooks/HandbookEditionBadge.svelte';
import HandbookReadProgressControl from '@ab/aviation/ui/handbooks/HandbookReadProgressControl.svelte';
import HandbookSectionListItem from '@ab/aviation/ui/handbooks/HandbookSectionListItem.svelte';
import HandbookSectionNotes from '@ab/aviation/ui/handbooks/HandbookSectionNotes.svelte';
import { type HandbookReadStatus, ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { extractImageUrls, normalizeHandbookAssetPath, renderMarkdown } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// Strip the YAML frontmatter (starts with `---\n...---\n`) before rendering.
// The seed already separated it, but the chapter row holds the file's full
// markdown so the renderer doesn't accidentally typeset the frontmatter.
const bodyMd = $derived(stripFrontmatter(data.chapter.contentMd));
const bodyHtml = $derived(renderMarkdown(bodyMd));

// Dedup manifest figures against any already inline in the body markdown so
// chapters whose body contains `![alt](url)` don't double-render.
const inlineAssetPaths = $derived(new Set(extractImageUrls(bodyMd).map((url) => normalizeHandbookAssetPath(url))));
const orphanFigures = $derived(
	data.figures.filter((fig) => !inlineAssetPaths.has(normalizeHandbookAssetPath(fig.assetPath))),
);

function stripFrontmatter(md: string): string {
	if (!md.startsWith('---')) return md;
	const end = md.indexOf('\n---', 3);
	if (end < 0) return md;
	return md.slice(end + 4).replace(/^\n+/, '');
}

// Asset paths in the manifest are repo-relative (e.g.
// `handbooks/phak/FAA-H-8083-25C/figures/foo.png`); the streaming endpoint
// at `/handbook-asset/[...path]` expects the path *without* the leading
// `handbooks/` segment.
function figureUrl(assetPath: string): string {
	const stripped = assetPath.startsWith('handbooks/') ? assetPath.slice('handbooks/'.length) : assetPath;
	return ROUTES.HANDBOOK_ASSET(stripped);
}
</script>

<svelte:head>
	<title>{data.chapter.title} -- {data.reference.title}</title>
</svelte:head>

<PageHeader title={`Chapter ${data.chapter.code}: ${data.chapter.title}`}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_HANDBOOK(data.reference.documentSlug)}>{data.reference.title}</a> &raquo;
			<span>Ch {data.chapter.code}</span>
		</nav>
	{/snippet}
	{#snippet titleSuffix()}
		<HandbookEditionBadge edition={data.reference.edition} />
	{/snippet}
	{#snippet subtitleSnippet()}
		<p class="locator">{data.chapter.sourceLocator}</p>
	{/snippet}
</PageHeader>

{#if data.reference.supersededByEdition}
	<div class="banner" role="alert">
		<strong>Newer edition available.</strong>
		You're reading {data.reference.edition}; the latest is
		{data.reference.supersededByEdition}.
	</div>
{/if}

{#if data.sections.length > 0}
	<section class="section-list" aria-label="Sections in this chapter">
		<h2>Sections</h2>
		<ul>
			{#each data.sections as section (section.id)}
				<li>
					<HandbookSectionListItem
						documentSlug={data.reference.documentSlug}
						chapterCode={data.chapter.code}
						code={section.code}
						title={section.title}
						faaPageStart={section.faaPageStart}
						faaPageEnd={section.faaPageEnd}
					/>
				</li>
			{/each}
		</ul>
	</section>
{:else if bodyMd}
	<article class="chapter-body">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html bodyHtml}
	</article>

	{#each orphanFigures as fig (fig.id)}
		<figure class="inline-figure">
			<img src={figureUrl(fig.assetPath)} alt={fig.caption} loading="lazy" />
			<figcaption>{fig.caption}</figcaption>
		</figure>
	{/each}
{/if}

<HandbookCitingNodesPanel nodes={data.citingNodes} scope="chapter" />

<HandbookReadProgressControl
	status={data.readState.status as HandbookReadStatus}
	comprehended={data.readState.comprehended}
	formAction="?/"
/>

<HandbookSectionNotes notesMd={data.readState.notesMd} formAction="?/set-notes" />

<style>
	.locator {
		margin: 0;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}
	.banner {
		margin-bottom: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--signal-info-wash);
		border-left: var(--space-2xs) solid var(--signal-info-edge);
		border-radius: var(--radius-md);
	}
	.section-list {
		margin-bottom: var(--space-lg);
	}
	.section-list h2 {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		margin: 0 0 var(--space-sm) 0;
	}
	.section-list ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
	.chapter-body {
		margin-bottom: var(--space-lg);
		line-height: var(--line-height-relaxed);
	}
	.chapter-body :global(p) {
		margin: 0 0 var(--space-sm) 0;
	}
	.chapter-body :global(h1),
	.chapter-body :global(h2),
	.chapter-body :global(h3) {
		margin: var(--space-lg) 0 var(--space-xs) 0;
	}
	.chapter-body :global(table) {
		border-collapse: collapse;
		margin: var(--space-sm) 0;
	}
	.chapter-body :global(th),
	.chapter-body :global(td) {
		border: 1px solid var(--edge-default);
		padding: var(--space-2xs) var(--space-xs);
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
