<script lang="ts">
import { getReferenceById } from '@ab/aviation';
import { ROUTES } from '@ab/constants';
import type { InlineNode, MdNode } from '../markdown/ast';
import { helpRegistry } from '../registry';
import HelpCard from './HelpCard.svelte';

/**
 * Walks an `MdNode[]` AST produced by `parseMarkdown` and renders each
 * node with the matching Svelte primitive.
 *
 * SSR note: code blocks carry a pre-rendered `highlighted` HTML string
 * (Shiki) and are emitted via `{@html}`. The call site (help page loader)
 * must have awaited `parseMarkdown`, so no async work happens inside this
 * component.
 */

let { nodes }: { nodes: MdNode[] } = $props();

function resolveWikilink(pageId: string): { href: string; resolved: boolean } {
	if (pageId === '') return { href: '', resolved: false };
	if (helpRegistry.getById(pageId)) {
		return { href: ROUTES.HELP_ID(pageId), resolved: true };
	}
	if (getReferenceById(pageId)) {
		return { href: ROUTES.GLOSSARY_ID(pageId), resolved: true };
	}
	return { href: '', resolved: false };
}
</script>

{#snippet inlineNodes(items: InlineNode[])}
	{#each items as node, i (i)}
		{#if node.kind === 'text'}
			{node.value}
		{:else if node.kind === 'strong'}
			<strong>{@render inlineNodes(node.children)}</strong>
		{:else if node.kind === 'em'}
			<em>{@render inlineNodes(node.children)}</em>
		{:else if node.kind === 'code'}
			<code class="md-inline-code">{node.value}</code>
		{:else if node.kind === 'br'}
			<br />
		{:else if node.kind === 'link'}
			{#if node.external}
				<a
					class="md-link md-link-external"
					href={node.url}
					target="_blank"
					rel="noopener noreferrer"
					data-source={node.source ?? 'other'}
				>
					{@render inlineNodes(node.children)}
					<span class="md-external-icon" aria-hidden="true">↗</span>
					{#if node.source && node.source !== 'other'}
						<span class="md-source-badge md-source-{node.source}">{node.source}</span>
					{/if}
				</a>
			{:else}
				<a class="md-link" href={node.url}>{@render inlineNodes(node.children)}</a>
			{/if}
		{:else if node.kind === 'wikilink'}
			{@const target = resolveWikilink(node.pageId)}
			{#if target.resolved}
				<a class="md-link md-link-wiki" href={target.href}>{node.display || node.pageId}</a>
			{:else}
				<span class="md-wikilink-unresolved" title="Unresolved: {node.pageId}"
					>{node.display || node.pageId}</span
				>
			{/if}
		{/if}
	{/each}
{/snippet}

{#snippet blockNodes(items: MdNode[])}
	{#each items as node, i (i)}
		{#if node.kind === 'heading'}
			{#if node.level === 2}
				<h2 id={node.id} class="md-h md-h2">{@render inlineNodes(node.children)}</h2>
			{:else if node.level === 3}
				<h3 id={node.id} class="md-h md-h3">{@render inlineNodes(node.children)}</h3>
			{:else}
				<h4 id={node.id} class="md-h md-h4">{@render inlineNodes(node.children)}</h4>
			{/if}
		{:else if node.kind === 'paragraph'}
			<p class="md-p">{@render inlineNodes(node.children)}</p>
		{:else if node.kind === 'list'}
			{#if node.ordered}
				<ol class="md-ol">
					{#each node.items as item, idx (idx)}
						<li>{@render blockNodes(item.children)}</li>
					{/each}
				</ol>
			{:else}
				<ul class="md-ul">
					{#each node.items as item, idx (idx)}
						<li>{@render blockNodes(item.children)}</li>
					{/each}
				</ul>
			{/if}
		{:else if node.kind === 'table'}
			<div class="md-table-wrap">
				<table class="md-table">
					<thead>
						<tr>
							{#each node.header as cell, ci (ci)}
								<th class="md-align-{node.alignments[ci] ?? 'default'}">
									{@render inlineNodes(cell)}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each node.rows as row, ri (ri)}
							<tr>
								{#each row as cell, ci (ci)}
									<td class="md-align-{node.alignments[ci] ?? 'default'}">
										{@render inlineNodes(cell)}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if node.kind === 'code'}
			{#if node.highlighted}
				<div class="md-code-wrap">{@html node.highlighted}</div>
			{:else}
				<pre class="md-code md-code-plain"><code>{node.value}</code></pre>
			{/if}
		{:else if node.kind === 'blockquote'}
			<blockquote class="md-quote">{@render blockNodes(node.children)}</blockquote>
		{:else if node.kind === 'callout'}
			<HelpCard variant={node.variant} title={node.title}>
				{#snippet children()}
					{@render blockNodes(node.children)}
				{/snippet}
			</HelpCard>
		{:else if node.kind === 'figure'}
			<figure class="md-figure">
				<img src={node.src} alt={node.alt} />
				{#if node.caption}
					<figcaption>{node.caption}</figcaption>
				{/if}
			</figure>
		{:else if node.kind === 'hr'}
			<hr class="md-hr" />
		{/if}
	{/each}
{/snippet}

<div class="md-body" data-testid="markdownbody-root">
	{@render blockNodes(nodes)}
</div>

<style>
	.md-body {
		font-size: var(--font-size-base);
		line-height: 1.6;
		color: var(--ink-body);
	}

	.md-body :global(.md-h) {
		margin: var(--space-lg) 0 var(--space-sm);
		color: var(--ink-body);
		letter-spacing: -0.01em;
	}

	.md-body :global(.md-h2) {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		scroll-margin-top: 4rem;
	}

	.md-body :global(.md-h3) {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
	}

	.md-body :global(.md-h4) {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-muted);
	}

	.md-body :global(.md-p) {
		margin: 0 0 var(--space-md);
	}

	.md-body :global(.md-ul),
	.md-body :global(.md-ol) {
		margin: 0 0 var(--space-md);
		padding-left: 1.5rem;
	}

	.md-body :global(.md-ul li),
	.md-body :global(.md-ol li) {
		margin-bottom: 0.25rem;
	}

	.md-body :global(.md-inline-code) {
		background: var(--surface-sunken);
		padding: 0.0625rem 0.375rem;
		border-radius: var(--radius-xs);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}

	.md-body :global(.md-link) {
		color: var(--action-default);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color var(--motion-normal);
	}

	.md-body :global(.md-link:hover),
	.md-body :global(.md-link:focus-visible) {
		border-bottom-color: currentColor;
	}

	.md-body :global(.md-link:focus-visible) {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}

	.md-body :global(.md-external-icon) {
		display: inline-block;
		margin-left: 0.15em;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}

	.md-body :global(.md-source-badge) {
		display: inline-block;
		margin-left: 0.375rem;
		padding: 0 0.375rem;
		border-radius: var(--radius-xs);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--surface-sunken);
		color: var(--ink-muted);
		border: 1px solid var(--edge-default);
	}

	.md-body :global(.md-source-wikipedia) {
		background: var(--surface-sunken);
		color: var(--ink-body);
	}

	.md-body :global(.md-source-faa) {
		background: var(--action-default-wash);
		color: var(--action-default);
	}

	.md-body :global(.md-source-paper) {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.md-body :global(.md-source-book) {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.md-body :global(.md-wikilink-unresolved) {
		color: var(--action-hazard);
		text-decoration: underline wavy;
	}

	.md-body :global(.md-table-wrap) {
		overflow-x: auto;
		margin: 0 0 var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.md-body :global(.md-table) {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-base);
	}

	.md-body :global(.md-table th),
	.md-body :global(.md-table td) {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--edge-default);
		vertical-align: top;
	}

	.md-body :global(.md-table th) {
		background: var(--surface-sunken);
		font-weight: var(--font-weight-semibold);
		text-align: left;
	}

	.md-body :global(.md-table tbody tr:last-child td) {
		border-bottom: 0;
	}

	.md-body :global(.md-align-left) {
		text-align: left;
	}

	.md-body :global(.md-align-right) {
		text-align: right;
	}

	.md-body :global(.md-align-center) {
		text-align: center;
	}

	.md-body :global(.md-code-wrap) {
		margin: 0 0 var(--space-md);
		border-radius: var(--radius-md);
		overflow: hidden;
		border: 1px solid var(--edge-default);
	}

	.md-body :global(.md-code-wrap pre),
	.md-body :global(.md-code) {
		margin: 0;
		padding: 0.75rem 1rem;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		overflow-x: auto;
	}

	/*
	 * Shiki dual-theme wiring.
	 *
	 * Shiki emits every token span with `--shiki-light` + `--shiki-dark`
	 * CSS variables (and `-bg` variants on the <pre>). `defaultColor: false`
	 * means Shiki applies no inline color itself, so these rules own the
	 * resolution. The light branch is the default; the dark branch matches
	 * the `data-appearance='dark'` attribute the theme system sets on
	 * <html> before first paint, which keeps the highlighted block in sync
	 * with the rest of the app through the appearance toggle and avoids
	 * a FOUC on reload.
	 */
	.md-body :global(.md-code-wrap .shiki),
	.md-body :global(.md-code-wrap .shiki span) {
		color: var(--shiki-light);
		background-color: var(--shiki-light-bg);
	}

	:global([data-appearance='dark']) .md-body :global(.md-code-wrap .shiki),
	:global([data-appearance='dark']) .md-body :global(.md-code-wrap .shiki span) {
		color: var(--shiki-dark);
		background-color: var(--shiki-dark-bg);
	}

	.md-body :global(.md-quote) {
		margin: var(--space-md) 0;
		padding: 0.5rem 1rem;
		border-left: 3px solid var(--edge-default);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		font-style: italic;
	}

	.md-body :global(.md-figure) {
		margin: var(--space-md) 0;
	}

	.md-body :global(.md-figure img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-md);
	}

	.md-body :global(.md-figure figcaption) {
		margin-top: 0.375rem;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		text-align: center;
	}

	.md-body :global(.md-hr) {
		border: 0;
		border-top: 1px solid var(--edge-default);
		margin: var(--space-lg) 0;
	}
</style>
