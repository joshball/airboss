<script lang="ts">
/**
 * `<MarkdownArticle>` -- shared prose surface for rendered markdown HTML.
 *
 * Owns the prose typography (headings, paragraphs, code, links, tables) so
 * route files don't ship visual CSS. Pass server-rendered HTML via
 * `bodyHtml`; the component `{@html}`s it inside an `<article>` with the
 * canonical token-driven prose styles. The HTML itself must be safe to
 * `{@html}` -- callers are responsible for using `renderMarkdown` (which
 * escapes raw HTML) or otherwise sanitising.
 *
 * Used by the `/docs` browser today; any other surface that needs to render
 * a rich markdown body (knowledge nodes, ADR previews, regs walkthroughs)
 * should consume this rather than re-author prose CSS.
 */

interface Props {
	/** HTML produced by `renderMarkdown` (already escaped + sanitised). */
	readonly bodyHtml: string;
	/** Optional accessible name for the article landmark. */
	readonly ariaLabel?: string;
}

let { bodyHtml, ariaLabel }: Props = $props();
</script>

<article class="prose" aria-label={ariaLabel}>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html bodyHtml}
</article>

<style>
	.prose {
		min-width: 0;
		font-size: var(--type-reading-body-size);
		line-height: var(--type-reading-body-line-height);
		color: var(--ink-body);
	}

	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5),
	.prose :global(h6) {
		color: var(--ink-body);
	}

	.prose :global(p) {
		color: var(--ink-body);
	}

	.prose :global(pre) {
		background: var(--surface-sunken);
		padding: var(--space-md);
		border-radius: var(--radius-sm);
		overflow-x: auto;
	}

	.prose :global(code) {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		background: var(--surface-sunken);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
	}

	.prose :global(pre code) {
		padding: 0;
		background: transparent;
	}

	.prose :global(a) {
		color: var(--link-default);
	}

	.prose :global(a:hover) {
		color: var(--link-hover);
	}

	.prose :global(table) {
		border-collapse: collapse;
		margin: var(--space-md) 0;
		width: 100%;
		/* Allow wide test-plan / spec tables to overflow their column instead
		 * of clipping content off-screen on narrow viewports. `display: block`
		 * lets the table own its scroll container; max-width keeps it inside
		 * the prose column. */
		display: block;
		overflow-x: auto;
		max-width: 100%;
	}

	.prose :global(th),
	.prose :global(td) {
		border: 1px solid var(--edge-default);
		padding: var(--space-2xs) var(--space-sm);
	}

	.prose :global(th) {
		background: var(--surface-sunken);
		text-align: left;
	}
</style>
