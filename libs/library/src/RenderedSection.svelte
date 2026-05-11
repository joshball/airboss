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
	/**
	 * Optional structured metadata loaded from `reference_section.metadata`
	 * (the JSONB column populated by the seeder). Merged with body-frontmatter
	 * keys to drive the "Metadata" disclosure panel. Frontmatter wins on key
	 * collision; keys present only in `metadata` show too.
	 *
	 * Pass `null` or `undefined` when the page-server didn't load it (older
	 * routes); the panel falls through to body-frontmatter only.
	 */
	readonly metadata?: Record<string, unknown> | null;
	/** Optional breadcrumb / header content rendered above the title. */
	readonly breadcrumb?: Snippet;
	/** Optional aside (e.g. sibling-section TOC, citing-nodes panel). */
	readonly aside?: Snippet;
	/** Optional locator string (e.g. `PHAK §12.9 -- pp. 12-15..12-18`). Rendered under the title. */
	readonly locator?: string;
	/**
	 * Optional reading-time estimate, in minutes. When > 0, surfaces a small
	 * "≈ N min read" badge in the section header (next to the title). 0 hides
	 * the badge. The estimate is computed from the body's word count via
	 * `readingMinutesForWords` in `@ab/constants`.
	 */
	readonly readingTimeMinutes?: number;
	/**
	 * Optional footer rendered below the body (and below the orphan-figures
	 * tail). Used by the section reader to attach the prev/next/up nav strip
	 * so every section page is "book-like" instead of dead-ending.
	 */
	readonly footer?: Snippet;
	/**
	 * Optional empty-body fallback. Rendered in place of the default "no body
	 * content in the PDF" placeholder when the section has no body and no
	 * figures. Lets the section reader inject prev/next/up navigation links so
	 * an empty section still has somewhere to go.
	 */
	readonly emptyFallback?: Snippet;
}
</script>

<script lang="ts">
import { ROUTES } from '@ab/constants';
import {
	dedupeFirstHeading,
	extractHandbookTableLinks,
	extractImageUrls,
	type FrontmatterEntry,
	injectFigureRefs,
	normalizeHandbookAssetPath,
	parseFrontmatter,
	renderMarkdown,
} from '@ab/utils';
import ReadingTime from './ReadingTime.svelte';

let {
	title,
	id,
	body,
	figures = [],
	metadata = null,
	breadcrumb,
	aside,
	locator,
	readingTimeMinutes = 0,
	footer,
	emptyFallback,
}: RenderedSectionProps = $props();

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
const stripped = $derived(dedupeFirstHeading(parsedFrontmatter.body, title));
const figureOrdinalMap = $derived(buildFigureOrdinalMap(figures));
const injection = $derived(injectFigureRefs(stripped, figureOrdinalMap));
const renderableBody = $derived(injection.body);
const bodyHtml = $derived(renderMarkdown(renderableBody));
const tableLinks = $derived(extractHandbookTableLinks(renderableBody));

// Merge body-frontmatter and DB-loaded metadata. Frontmatter wins on key
// collision (operator-authored is presumed more current than the seeder).
// DB-only keys still surface so the panel covers every available field.
const metadataEntries = $derived(mergeMetadata(metadata, parsedFrontmatter.entries));
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

/**
 * Merge DB-loaded `reference_section.metadata` with body-frontmatter entries.
 * Frontmatter wins on key collision; DB-only keys still surface. Order:
 * frontmatter keys first (in author order), then DB keys not already covered
 * (in object-key order).
 *
 * DB values may be primitives (string/number/boolean), arrays, or nested
 * objects. The panel only knows how to render strings, so non-string values
 * are JSON-encoded into a compact display form. Empty objects/arrays render
 * as the same dash glyph as empty frontmatter values.
 */
function mergeMetadata(
	dbMetadata: Record<string, unknown> | null | undefined,
	frontmatter: ReadonlyArray<FrontmatterEntry>,
): ReadonlyArray<FrontmatterEntry> {
	const seen = new Set<string>();
	const out: FrontmatterEntry[] = [];
	for (const entry of frontmatter) {
		seen.add(entry.key);
		out.push(entry);
	}
	if (dbMetadata) {
		for (const [key, value] of Object.entries(dbMetadata)) {
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ key, value: stringifyMetadataValue(value) });
		}
	}
	return out;
}

function stringifyMetadataValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) return value.map((v) => stringifyMetadataValue(v)).join(', ');
	try {
		return JSON.stringify(value);
	} catch {
		return '';
	}
}
</script>

<section data-testid="rendered-section" data-ref-id={id}>
	{#if breadcrumb}
		{@render breadcrumb()}
	{/if}
	<header class="head">
		<div class="title-block">
			<h1>{title}</h1>
			{#if locator || readingTimeMinutes > 0}
				<p class="meta-row">
					{#if locator}
						<span class="locator">{locator}</span>
					{/if}
					<ReadingTime minutes={readingTimeMinutes} />
				</p>
			{/if}
			{#if figures.length > 0 || tableLinks.length > 0}
				<p class="indicators" data-testid="rendered-section-indicators">
					{#if figures.length > 0}
						<span class="indicator">Figures: {figures.length}</span>
					{/if}
					{#if tableLinks.length > 0}
						<span class="indicator">Tables: {tableLinks.length}</span>
					{/if}
				</p>
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
	{:else if emptyFallback}
		{@render emptyFallback()}
	{:else}
		<p class="empty" data-testid="rendered-section-empty">
			This section has no body content in the PDF. Open the linked PDF or parent page below for the source material.
		</p>
	{/if}
	{#if aside}
		{@render aside()}
	{/if}
	{#if footer}
		{@render footer()}
	{/if}
</section>

<style>
section {
	display: flex;
	flex-direction: column;
	gap: var(--space-md);
	/* Honor the user's reader-measure preference (WP-FLIGHTBAG-READER-UX
	 * Phase 3); fall through to the platform default when no
	 * `<ReadableScope>` is mounted. */
	max-width: var(--reader-measure-ch, 72ch);
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

.meta-row {
	margin: 0;
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	gap: var(--space-xs) var(--space-sm);
}

.locator {
	color: var(--ink-muted);
	font-family: var(--font-family-mono);
	font-size: var(--font-size-sm);
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
	/* Reader-pref tokens (WP-FLIGHTBAG-READER-UX Phase 3) -- when a
	 * `<ReadableScope>` is mounted in the layout, the user's typography
	 * preference flows in via the cascade. Without the scope, the
	 * fallback to the platform tokens keeps anonymous / non-reader
	 * surfaces visually identical to pre-WP behavior. */
	font-family: var(--reader-body-font-family, var(--font-family-base));
	font-size: var(--reader-body-font-size, var(--font-size-base));
	line-height: var(--reader-body-line-height, var(--line-height-relaxed));
	color: var(--ink-body);
	/* Animate font-size changes so the user feels the resize as a
	 * deliberate gesture rather than a hard cut. Respect reduced-motion. */
	transition: font-size var(--motion-fast, 200ms) ease;
}

@media (prefers-reduced-motion: reduce) {
	.body {
		transition: none;
	}
}

.body :global(p) {
	margin: 0 0 var(--space-sm) 0;
}

/* Heading sizes scale against the reader body size + the user's
 * heading-scale multiplier. Per-level ratios approximate the platform's
 * type system but compute relative to whatever body size the user picked. */
.body :global(h2) {
	margin: var(--space-xl) 0 var(--space-sm) 0;
	font-size: calc(var(--reader-body-font-size, var(--font-size-base)) * 1.5 * var(--reader-heading-scale, 1));
	line-height: var(--line-height-tight);
}

.body :global(h3) {
	margin: var(--space-lg) 0 var(--space-xs) 0;
	font-size: calc(var(--reader-body-font-size, var(--font-size-base)) * 1.25 * var(--reader-heading-scale, 1));
	line-height: var(--line-height-tight);
}

.body :global(h4),
.body :global(h5),
.body :global(h6) {
	margin: var(--space-lg) 0 var(--space-xs) 0;
	font-size: calc(var(--reader-body-font-size, var(--font-size-base)) * 1.1 * var(--reader-heading-scale, 1));
	line-height: var(--line-height-tight);
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

.indicators {
	margin: 0;
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-xs);
	font-size: var(--font-size-sm);
	color: var(--ink-muted);
}

.indicator {
	padding: var(--space-3xs) var(--space-2xs);
	background: var(--surface-sunken);
	border-radius: var(--radius-sm);
	font-family: var(--font-family-mono);
}

/* Handbook tables -- the extractor authors `<div class="handbook-table">`
   wrappers that survive `sanitizeInlineHtml`. Style them in scoped styles
   so the table fits the reader's typography (left-aligned text, monospace
   captions, alternating row backgrounds for legibility). */
.body :global(.handbook-table) {
	margin: var(--space-md) 0;
	overflow-x: auto;
	border-radius: var(--radius-md);
	border: 1px solid var(--edge-default);
	background: var(--surface-panel);
}

.body :global(.handbook-table > table) {
	border-collapse: collapse;
	width: 100%;
	font-size: var(--font-size-sm);
}

.body :global(.handbook-table caption) {
	caption-side: top;
	padding: var(--space-xs) var(--space-sm);
	color: var(--ink-muted);
	font-family: var(--font-family-mono);
	font-size: var(--font-size-xs);
	text-align: left;
	background: var(--surface-sunken);
	border-bottom: 1px solid var(--edge-default);
}

.body :global(.handbook-table th),
.body :global(.handbook-table td) {
	padding: var(--space-2xs) var(--space-sm);
	border-bottom: 1px solid var(--edge-subtle, var(--edge-default));
	text-align: left;
	vertical-align: top;
}

.body :global(.handbook-table th) {
	background: var(--surface-sunken);
	font-weight: var(--font-weight-semibold);
	color: var(--ink-strong);
}

.body :global(.handbook-table tbody tr:nth-child(even) td) {
	background: var(--surface-sunken);
}

.body :global(.handbook-table-source) {
	display: inline-block;
	margin: var(--space-2xs) var(--space-sm) var(--space-xs);
	padding: var(--space-3xs) var(--space-2xs);
	color: var(--ink-muted);
	font-size: var(--font-size-xs);
	text-decoration: underline;
	text-underline-offset: 0.15em;
}

.body :global(.handbook-table-source:hover),
.body :global(.handbook-table-source:focus-visible) {
	color: var(--ink-strong);
}
</style>
