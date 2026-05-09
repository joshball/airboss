<script lang="ts" module>
import type { Snippet } from 'svelte';

/**
 * `<ReaderLayout>` -- shared two-column reader chrome for FAA-reference reader
 * pages.
 *
 * The flightbag uses one persistent shape for every long-form reader: a sticky
 * TOC rail on the right, a content column on the left. This component owns
 * that layout primitive. Surfaces compose it by passing snippets for the
 * header (breadcrumb, source-links, eyebrow, title, subtitle, header-extra),
 * the TOC sidebar (typically a `<TOCDrawer>` instance), the body content,
 * and an optional footer (typically a `<ReaderNav>` strip).
 *
 * Visual contract:
 * - Desktop (>=60rem): grid `1fr 18rem`, content first, TOC right. The TOC is
 *   sticky to the top of the viewport and scrolls within its own bounds.
 * - Mobile (<60rem): single column, TOC stacked above the body so the user
 *   sees navigation before content. The TOC component itself is responsible
 *   for any "collapsed by default on mobile" affordance (`<TOCDrawer>` does
 *   this via its `mobileOpen` toggle).
 *
 * The header snippets render inside a single `<header class="page-header">`
 * block so spacing / typography stays normalized across surfaces. Pages don't
 * pick their own h1 size or breadcrumb spacing -- the layout owns it.
 *
 * No snippet is required; a minimal caller (no breadcrumb, no source-links,
 * just a title and body) still gets a clean reader page.
 */

export interface ReaderLayoutProps {
	/** TOC sidebar content -- typically a `<TOCDrawer>` instance. */
	readonly tocSidebar?: Snippet;
	/** Breadcrumb trail -- typically a `<Breadcrumbs>` instance. */
	readonly breadcrumb?: Snippet;
	/** Source-links cluster -- typically a `<SourceLinks>` instance. */
	readonly sourceLinks?: Snippet;
	/** Small uppercase eyebrow above the title (e.g. "Area of Operation I"). */
	readonly eyebrow?: Snippet;
	/** Page h1 -- the headline label for this page. */
	readonly title?: Snippet;
	/** Subtitle / meta line under the title (edition, code, publisher). */
	readonly subtitle?: Snippet;
	/** Extra header content (e.g. the "FAA portal -->" link on ACS pubs). */
	readonly pageHeaderExtra?: Snippet;
	/** Body / main content. */
	readonly children?: Snippet;
	/** Optional footer strip below the body (typically `<ReaderNav>`). */
	readonly footer?: Snippet;
}
</script>

<script lang="ts">
let {
	tocSidebar,
	breadcrumb,
	sourceLinks,
	eyebrow,
	title,
	subtitle,
	pageHeaderExtra,
	children,
	footer,
}: ReaderLayoutProps = $props();
</script>

<div class="reader">
	<div class="primary">
		{#if breadcrumb}
			{@render breadcrumb()}
		{/if}
		{#if sourceLinks}
			{@render sourceLinks()}
		{/if}
		{#if eyebrow || title || subtitle || pageHeaderExtra}
			<header class="page-header">
				{#if eyebrow}
					<p class="eyebrow">{@render eyebrow()}</p>
				{/if}
				{#if title}
					<h1>{@render title()}</h1>
				{/if}
				{#if subtitle}
					<p class="subtitle">{@render subtitle()}</p>
				{/if}
				{#if pageHeaderExtra}
					{@render pageHeaderExtra()}
				{/if}
			</header>
		{/if}
		{#if children}
			{@render children()}
		{/if}
		{#if footer}
			<div class="page-footer">
				{@render footer()}
			</div>
		{/if}
	</div>
	{#if tocSidebar}
		<aside class="toc-rail">
			{@render tocSidebar()}
		</aside>
	{/if}
</div>

<style>
	.reader {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: var(--space-lg);
		align-items: start;
	}

	.toc-rail {
		position: sticky;
		top: var(--space-md);
	}

	.primary {
		min-width: 0;
	}

	.page-header {
		margin-bottom: var(--space-lg);
	}

	.page-header h1 {
		margin: 0 0 var(--space-2xs);
	}

	.eyebrow {
		margin: 0 0 var(--space-2xs);
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.subtitle {
		margin: 0 0 var(--space-2xs);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.page-footer {
		margin-top: var(--space-2xl);
	}

	@media (max-width: 60rem) {
		.reader {
			grid-template-columns: 1fr;
		}
		.toc-rail {
			position: static;
			order: -1;
		}
	}
</style>
