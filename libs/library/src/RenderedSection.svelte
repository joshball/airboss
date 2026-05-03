<script lang="ts" module>
import type { Snippet } from 'svelte';

/**
 * `<RenderedSection>` -- markdown renderer for a reference section.
 *
 * Renders the supplied `body` markdown as HTML using the shared
 * `renderMarkdown` helper from `@ab/utils`. Figure assets that the
 * markdown corpus authored as `/handbooks/<doc>/<edition>/figures/foo.png`
 * are rewritten to `/handbook-asset/<doc>/<edition>/figures/foo.png` so
 * they resolve against the flightbag's per-app static-asset endpoint.
 *
 * Optional `figures` prop lets a server loader pass the manifest-side
 * figure list; figures already embedded in the body markdown are
 * deduped so the page doesn't render the same image twice.
 *
 * Optional `breadcrumbs` snippet renders before the title; `aside`
 * snippet renders after the body (used for "in this section" sticky
 * TOC, citing-nodes panels, etc.). Both are optional so a minimal
 * caller still gets a clean reader page.
 */

export interface RenderedSectionFigure {
	readonly id: string;
	readonly ordinal: number;
	readonly caption: string;
	readonly assetPath: string;
	readonly width: number | null;
	readonly height: number | null;
}

export interface RenderedSectionProps {
	/** Section heading -- typically the manifest's `title` field. */
	readonly title: string;
	/** Citable identifier for this section (e.g. `airboss-ref:handbooks/phak/8083-25C/2/3`). */
	readonly id: string;
	/** Section body in markdown. May be empty when the section has no inline content. */
	readonly body: string;
	/** Optional manifest-side figure list to render after the body (deduped). */
	readonly figures?: ReadonlyArray<RenderedSectionFigure>;
	/** Optional breadcrumb / header content rendered above the title. */
	readonly breadcrumb?: Snippet;
	/** Optional aside (e.g. sibling-section TOC, citing-nodes panel). */
	readonly aside?: Snippet;
	/** Optional locator string (e.g. `PHAK §12.9 -- pp. 12-15..12-18`). Rendered under the title. */
	readonly locator?: string;
}
</script>

<script lang="ts">
import { ROUTES } from '@ab/constants';
import { extractImageUrls, normalizeHandbookAssetPath, renderMarkdown } from '@ab/utils';

let { title, id, body, figures = [], breadcrumb, aside, locator }: RenderedSectionProps = $props();

const bodyHtml = $derived(renderMarkdown(body));

// Dedup the manifest's figure list against figures already embedded in
// the body markdown -- without this, sections whose markdown contains
// `![alt](url)` images render the figure both inline and again under
// the manifest tail block.
const inlineAssetPaths = $derived(new Set(extractImageUrls(body).map((url) => normalizeHandbookAssetPath(url))));
const orphanFigures = $derived(
	figures.filter((fig) => !inlineAssetPaths.has(normalizeHandbookAssetPath(fig.assetPath))),
);

function figureUrl(assetPath: string): string {
	const stripped = assetPath.startsWith('handbooks/') ? assetPath.slice('handbooks/'.length) : assetPath;
	return ROUTES.HANDBOOK_ASSET(stripped);
}
</script>

<section data-testid="rendered-section" data-ref-id={id}>
	{#if breadcrumb}
		{@render breadcrumb()}
	{/if}
	<h1>{title}</h1>
	{#if locator}
		<p class="locator">{locator}</p>
	{/if}
	{#if body.length > 0}
		<article class="body">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html bodyHtml}
			{#each orphanFigures as fig (fig.id)}
				<figure class="inline-figure">
					<img src={figureUrl(fig.assetPath)} alt={fig.caption} loading="lazy" />
					{#if fig.caption}
						<figcaption>{fig.caption}</figcaption>
					{/if}
				</figure>
			{/each}
		</article>
	{:else}
		<p class="empty" data-testid="rendered-section-empty">No body content for this section yet.</p>
	{/if}
	{#if aside}
		{@render aside()}
	{/if}
</section>

<style>
section {
	display: flex;
	flex-direction: column;
	gap: var(--space-md);
	max-width: 72ch;
}

h1 {
	margin: 0;
	font-size: var(--font-size-2xl);
	font-weight: var(--font-weight-bold);
}

.locator {
	margin: 0;
	color: var(--ink-muted);
	font-family: var(--font-family-mono);
}

.body {
	font-family: var(--font-family-base);
	font-size: var(--font-size-base);
	line-height: var(--line-height-relaxed);
	color: var(--ink-body);
}

.body :global(p) {
	margin: 0 0 var(--space-sm) 0;
}

.body :global(h3),
.body :global(h4),
.body :global(h5),
.body :global(h6) {
	margin: var(--space-lg) 0 var(--space-xs) 0;
}

.body :global(ul),
.body :global(ol) {
	margin: 0 0 var(--space-sm) var(--space-lg);
}

.body :global(pre) {
	background: var(--surface-sunken);
	padding: var(--space-sm);
	border-radius: var(--radius-md);
	overflow-x: auto;
}

.body :global(code) {
	font-family: var(--font-family-mono);
	font-size: 0.95em;
}

.body :global(figure.md-figure),
.inline-figure {
	margin: var(--space-md) 0;
	text-align: center;
}

.body :global(figure.md-figure img),
.inline-figure img {
	max-width: 100%;
	height: auto;
	border-radius: var(--radius-md);
}

.body :global(figure.md-figure figcaption),
.inline-figure figcaption {
	margin-top: var(--space-xs);
	color: var(--ink-muted);
}

.empty {
	color: var(--ink-muted);
	font-style: italic;
}
</style>
