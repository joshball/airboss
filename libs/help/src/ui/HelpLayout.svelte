<script lang="ts">
import type { Snippet } from 'svelte';
import type { MdNode } from '../markdown/ast';
import type { HelpPage } from '../schema/help-page';
import ExternalRefsFooter from './ExternalRefsFooter.svelte';
import HelpSection from './HelpSection.svelte';
import HelpTOC from './HelpTOC.svelte';

/**
 * HelpLayout is the page shell for `/help/[id]`: title + summary, a sticky
 * TOC on desktop, the section list in reading order, and an optional
 * sidebar snippet (for an on-page search widget). First section renders
 * without a heading (lede pattern).
 */

let {
	page,
	sidebar,
	sectionNodes,
}: {
	page: HelpPage;
	sidebar?: Snippet;
	/**
	 * Pre-parsed markdown ASTs keyed by section id. When provided, sections
	 * render via `<MarkdownBody>`; otherwise they fall back to the legacy
	 * `<ReferenceText>` path. Typically supplied by the page loader after
	 * awaiting `parseMarkdown` per section.
	 */
	sectionNodes?: Readonly<Record<string, MdNode[]>>;
} = $props();

const sections = $derived(page.sections);
// Seed `activeId` to the first section of the current page. Using
// `$derived` + `$state` with a keyed fallback avoids an `$effect` that
// would clobber the scroll handler's updates every time the parent
// rerenders (the effect fires on identity changes of `sections`, not
// value changes).
let scrolledActiveId = $state<string | null>(null);
const activeId = $derived(scrolledActiveId ?? sections[0]?.id ?? null);

function handleScroll(): void {
	if (sections.length === 0) return;
	const scrollY = window.scrollY + 80;
	let current = sections[0]?.id ?? null;
	for (const section of sections) {
		const el = document.getElementById(section.id);
		if (!el) continue;
		if (el.offsetTop <= scrollY) current = section.id;
	}
	scrolledActiveId = current;
}

$effect(() => {
	if (typeof window === 'undefined') return;
	window.addEventListener('scroll', handleScroll, { passive: true });
	handleScroll();
	return () => {
		window.removeEventListener('scroll', handleScroll);
	};
});
</script>

<article class="help" data-testid="helplayout-root">
	<aside class="sidebar" aria-label="Help navigation" data-testid="helplayout-sidebar">
		<HelpTOC sections={page.sections} {activeId} />
		{#if sidebar}
			<div class="sidebar-extra" data-testid="helplayout-sidebar-extra">{@render sidebar()}</div>
		{/if}
	</aside>

	<div class="content" data-testid="helplayout-content">
		<header class="page-head" data-testid="helplayout-head">
			<h1 data-testid="helplayout-title">{page.title}</h1>
			<p class="summary" data-testid="helplayout-summary">{page.summary}</p>
			{#if page.documents}
				<p class="documents" data-testid="helplayout-documents">Documents: <code>{page.documents}</code></p>
			{/if}
		</header>

		{#each page.sections as section, index (section.id)}
			<HelpSection {section} showHeading={index !== 0} nodes={sectionNodes?.[section.id]} />
		{/each}

		<ExternalRefsFooter refs={page.externalRefs} />
	</div>
</article>

<style>
	.help {
		display: grid;
		grid-template-columns: 14rem 1fr;
		gap: 2rem;
		align-items: start;
	}

	.sidebar {
		position: sticky;
		top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.5rem 0;
	}

	.sidebar-extra {
		border-top: 1px solid var(--edge-default);
		padding-top: 0.75rem;
	}

	.content {
		min-width: 0;
	}

	.page-head {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--edge-default);
	}

	.page-head h1 {
		margin: 0 0 0.25rem;
		font-size: var(--font-size-2xl);
		letter-spacing: -0.02em;
	}

	.summary {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-base);
		line-height: 1.5;
	}

	.documents {
		margin: 0.5rem 0 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}

	.documents code {
		background: var(--surface-sunken);
		padding: 0.0625rem 0.375rem;
		border-radius: var(--radius-xs);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}

	@media (max-width: 640px) { /* --ab-breakpoint-md */
		.help {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: static;
		}
	}
</style>
