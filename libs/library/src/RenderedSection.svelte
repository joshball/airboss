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
 * Body markdown that opens with a YAML frontmatter block has the block
 * parsed: stripped from the body before the markdown renderer runs, and
 * surfaced in a small "Metadata" disclosure panel in the top-right of
 * the header. The disclosure is collapsed by default and shows the
 * operator-authored fields (`handbook`, `edition`, `faa_pages`,
 * `source_url`, etc.) as a key-value list. The `<SourceLinks>` cluster
 * the page composes alongside this component handles the FAA / local-PDF
 * link rendering -- `<RenderedSection>` does not duplicate that affordance.
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
import {
	dedupeFirstHeading,
	extractImageUrls,
	injectFigureRefs,
	normalizeHandbookAssetPath,
	parseFrontmatter,
	renderMarkdown,
} from '@ab/utils';

let { title, id, body, figures = [], breadcrumb, aside, locator }: RenderedSectionProps = $props();

// Pipeline:
//   1. Parse the YAML frontmatter the section seed leaves at the top of the
//      body markdown -- strip it from the body so the `---` fences don't leak
//      as a paragraph, and keep the parsed key-value entries to surface in a
//      "Metadata" disclosure in the top-right of the header.
//   2. Drop a leading H1 line that duplicates the section title -- the page
//      title is already rendered as a `<h1>` above the body, and having the
//      body lead with `# Same Title` makes the page show the title twice.
//   3. Build an ordinal -> figure map from the manifest figures and splice
//      `![caption](url)` blocks into the body where the prose first names
//      each figure ("Figure 2-5"). The inline image is rendered as a
//      `<figure>` by `renderMarkdown`.
//   4. Render the resulting markdown to HTML.
//   5. After the body, render any remaining figures that the prose did NOT
//      reference (rare but seen on pages with bare image references that
//      don't follow the "Figure X-Y" convention).
const parsedFrontmatter = $derived(parseFrontmatter(body));
const metadataEntries = $derived(parsedFrontmatter.entries);
const stripped = $derived(dedupeFirstHeading(parsedFrontmatter.body, title));
const figureOrdinalMap = $derived(buildFigureOrdinalMap(figures));
const injection = $derived(injectFigureRefs(stripped, figureOrdinalMap));
const renderableBody = $derived(injection.body);
const bodyHtml = $derived(renderMarkdown(renderableBody));

const hasMetadata = $derived(metadataEntries.length > 0);

// Dedup the manifest's figure list against figures already embedded in
// the body markdown (or freshly injected above) -- without this, sections
// whose markdown contains `![alt](url)` images render the figure both
// inline and again under the manifest tail block.
const inlineAssetPaths = $derived(
	new Set(extractImageUrls(renderableBody).map((url) => normalizeHandbookAssetPath(url))),
);
const orphanFigures = $derived(
	figures.filter((fig) => !inlineAssetPaths.has(normalizeHandbookAssetPath(fig.assetPath))),
);

const hasContent = $derived(stripped.trim().length > 0 || figures.length > 0);

function figureUrl(assetPath: string): string {
	const cleaned = assetPath.startsWith('handbooks/') ? assetPath.slice('handbooks/'.length) : assetPath;
	return ROUTES.HANDBOOK_ASSET(cleaned);
}

/**
 * Build an ordinal-keyed map from a manifest figure list. Ordinals come
 * either from the caption (`Figure 2-5. Phonetic pronunciation guide.`) or
 * from the asset path filename (`figure-2-5.png`). When neither yields an
 * ordinal, the figure is excluded from the inline-injection pass and falls
 * through to the "orphan figures" tail render.
 */
function buildFigureOrdinalMap(
	list: ReadonlyArray<RenderedSectionFigure>,
): Map<string, { caption: string; assetPath: string }> {
	const map = new Map<string, { caption: string; assetPath: string }>();
	for (const fig of list) {
		const ord = ordinalForFigure(fig);
		if (ord === null) continue;
		if (!map.has(ord)) map.set(ord, { caption: fig.caption, assetPath: fig.assetPath });
	}
	return map;
}

function ordinalForFigure(fig: RenderedSectionFigure): string | null {
	const fromCaption = /Figure\s+(\d+(?:-\d+)?(?:\.[A-Z])?)/.exec(fig.caption);
	if (fromCaption?.[1]) return fromCaption[1];
	const fromPath = /figure[-_](\d+(?:-\d+)?(?:\.[A-Z])?)/i.exec(fig.assetPath);
	if (fromPath?.[1]) return fromPath[1];
	return null;
}

function isHttpUrl(value: string): boolean {
	return value.startsWith('http://') || value.startsWith('https://');
}

/**
 * Snake-case-or-kebab-case key -> Title Case label for the metadata
 * disclosure (`faa_pages` -> `Faa Pages`, `source_url` -> `Source Url`).
 */
function humanizeFrontmatterKey(key: string): string {
	return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
</script>

<section data-testid="rendered-section" data-ref-id={id}>
	{#if breadcrumb}
		{@render breadcrumb()}
	{/if}
	<header class="head">
		<div class="title-block">
			<h1>{title}</h1>
			{#if locator}
				<p class="locator">{locator}</p>
			{/if}
		</div>
		{#if hasMetadata}
			<details class="metadata" data-testid="rendered-section-metadata">
				<summary>Metadata</summary>
				<dl>
					{#each metadataEntries as entry (entry.key)}
						<dt>{humanizeFrontmatterKey(entry.key)}</dt>
						<dd>
							{#if isHttpUrl(entry.value)}
								<a href={entry.value} target="_blank" rel="noopener noreferrer">{entry.value}</a>
							{:else if entry.value === ''}
								<span class="metadata-empty">—</span>
							{:else}
								{entry.value}
							{/if}
						</dd>
					{/each}
				</dl>
			</details>
		{/if}
	</header>
	{#if hasContent}
		<article class="body">
			{#if stripped.trim().length > 0}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html bodyHtml}
			{/if}
			{#if orphanFigures.length > 0}
				<aside class="figure-tail" aria-label="Figures in this section">
					{#each orphanFigures as fig (fig.id)}
						<figure class="inline-figure">
							<img src={figureUrl(fig.assetPath)} alt={fig.caption} loading="lazy" />
							{#if fig.caption}
								<figcaption>{fig.caption}</figcaption>
							{/if}
						</figure>
					{/each}
				</aside>
			{/if}
		</article>
	{:else}
		<p class="empty" data-testid="rendered-section-empty">
			This section has no body content in the PDF. Open the linked PDF or parent page below for the source material.
		</p>
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

.head {
	display: flex;
	gap: var(--space-md);
	align-items: flex-start;
	justify-content: space-between;
	flex-wrap: wrap;
}

.title-block {
	display: flex;
	flex-direction: column;
	gap: var(--space-2xs);
	flex: 1 1 auto;
	min-width: 0;
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

.metadata {
	flex: 0 0 auto;
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	background: var(--surface-panel);
	max-width: 22rem;
	font-size: var(--font-size-sm);
}

.metadata > summary {
	padding: var(--space-2xs) var(--space-xs);
	cursor: pointer;
	color: var(--ink-muted);
	user-select: none;
	list-style: none;
}

.metadata > summary::-webkit-details-marker {
	display: none;
}

.metadata > summary::after {
	content: '▸';
	margin-left: var(--space-2xs);
	font-size: 0.85em;
	color: var(--ink-muted);
	transition: transform 120ms ease;
	display: inline-block;
}

.metadata[open] > summary::after {
	transform: rotate(90deg);
}

.metadata > summary:hover,
.metadata > summary:focus-visible {
	color: var(--ink-strong);
}

.metadata dl {
	margin: 0;
	padding: var(--space-xs);
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: var(--space-2xs) var(--space-sm);
	border-top: 1px solid var(--edge-default);
}

.metadata dt {
	color: var(--ink-muted);
	font-weight: var(--font-weight-medium);
}

.metadata dd {
	margin: 0;
	color: var(--ink-body);
	overflow-wrap: anywhere;
}

.metadata dd a {
	color: inherit;
	text-decoration: underline;
	text-underline-offset: 0.15em;
}

.metadata-empty {
	color: var(--ink-muted);
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
	margin: 0;
	padding: var(--space-md);
	background: var(--surface-sunken);
	border-radius: var(--radius-md);
	color: var(--ink-muted);
	font-style: italic;
}

.figure-tail {
	margin-top: var(--space-lg);
	padding-top: var(--space-md);
	border-top: 1px dashed var(--edge-default);
}
</style>
