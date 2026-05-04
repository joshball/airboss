<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import { renderMarkdown } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const bodyHtml = $derived(rewriteDocsLinks(renderMarkdown(data.body), data.repoRelPath));
const crumbs = $derived<readonly BreadcrumbItem[]>(buildCrumbs(data.repoRelPath));

/**
 * Rewrite intra-doc links so a `(./other-file.md)` or `(../sibling/foo.md)`
 * link resolves under `/docs/<repo-relative path>` instead of falling
 * through to the SvelteKit not-found path. Absolute `/` links and external
 * `https?://` links pass through unchanged.
 *
 * Cheap post-process: walk the rendered HTML's `href="..."` attributes,
 * resolve relative paths against the current page's directory, prefix with
 * `/docs/`. Unsupported schemes (`javascript:`, anything else) are left
 * alone -- the markdown renderer's allow-list is the security boundary.
 */
function rewriteDocsLinks(html: string, currentRepoRelPath: string): string {
	const dir = currentRepoRelPath.includes('/') ? currentRepoRelPath.replace(/\/[^/]+$/, '') : '';
	return html.replace(/href="([^"]+)"/g, (full, raw: string) => {
		if (raw.startsWith('http://') || raw.startsWith('https://')) return full;
		if (raw.startsWith('#') || raw.startsWith('mailto:')) return full;
		if (raw.startsWith(ROUTES.HANGAR_DOCS) || raw.startsWith('/handbook-asset/')) return full;
		if (raw.startsWith('/')) return full;
		if (!raw.endsWith('.md')) return full;
		const resolvedRel = resolveRelativeRepoPath(dir, raw);
		if (resolvedRel === null) return full;
		return `href="${ROUTES.HANGAR_DOCS_PATH(resolvedRel)}"`;
	});
}

/** Pure-string POSIX resolver -- joins `base` and `rel`, collapses `..` /
 * `.` segments. Returns null when the result climbs above the root. */
function resolveRelativeRepoPath(base: string, rel: string): string | null {
	const segs = base === '' ? [] : base.split('/');
	for (const part of rel.split('/')) {
		if (part === '' || part === '.') continue;
		if (part === '..') {
			if (segs.length === 0) return null;
			segs.pop();
		} else {
			segs.push(part);
		}
	}
	return segs.join('/');
}

function buildCrumbs(path: string): readonly BreadcrumbItem[] {
	const parts = path.split('/');
	const out: BreadcrumbItem[] = [{ label: 'Docs', href: ROUTES.HANGAR_DOCS }];
	let acc = '';
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i] ?? '';
		acc = acc === '' ? part : `${acc}/${part}`;
		const isLast = i === parts.length - 1;
		const label = isLast ? part.replace(/\.md$/, '') : part;
		out.push(isLast ? { label } : { label, href: ROUTES.HANGAR_DOCS_PATH(acc) });
	}
	return out;
}
</script>

<div class="docs-page">
	<Breadcrumbs items={crumbs} />

	<div class="grid">
		<article class="prose">
			{@html bodyHtml}
		</article>

		{#if data.entries.length > 0}
			<aside class="frontmatter" aria-label="Frontmatter">
				<h2>Frontmatter</h2>
				<dl>
					{#each data.entries as entry (entry.key)}
						<dt>{entry.key}</dt>
						<dd>{entry.value}</dd>
					{/each}
				</dl>
			</aside>
		{/if}
	</div>
</div>

<style>
	.docs-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem);
		gap: var(--space-xl);
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	.prose {
		min-width: 0;
		font-size: var(--type-reading-body-size);
		line-height: var(--type-reading-body-line-height);
		color: var(--ink-body);
	}

	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3),
	.prose :global(h4) {
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
	}

	.prose :global(th),
	.prose :global(td) {
		border: 1px solid var(--edge-default);
		padding: var(--space-2xs) var(--space-sm);
	}

	.frontmatter {
		border-left: 1px solid var(--edge-default);
		padding-left: var(--space-md);
	}

	.frontmatter h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--type-ui-label-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.frontmatter dl {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		column-gap: var(--space-sm);
		row-gap: var(--space-2xs);
	}

	.frontmatter dt {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}

	.frontmatter dd {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
		overflow-wrap: anywhere;
	}
</style>
