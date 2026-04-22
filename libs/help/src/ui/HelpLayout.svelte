<script lang="ts">
import type { Snippet } from 'svelte';
import type { HelpPage } from '../schema/help-page';
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
}: {
	page: HelpPage;
	sidebar?: Snippet;
} = $props();

let activeId = $state<string | null>(null);
const sections = $derived(page.sections);

$effect(() => {
	// Reset the active-section highlight when the page itself changes.
	activeId = sections[0]?.id ?? null;
});

function handleScroll(): void {
	if (sections.length === 0) return;
	const scrollY = window.scrollY + 80;
	let current = sections[0]?.id ?? null;
	for (const section of sections) {
		const el = document.getElementById(section.id);
		if (!el) continue;
		if (el.offsetTop <= scrollY) current = section.id;
	}
	activeId = current;
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

<article class="help">
	<aside class="sidebar" aria-label="Help navigation">
		<HelpTOC sections={page.sections} {activeId} />
		{#if sidebar}
			<div class="sidebar-extra">{@render sidebar()}</div>
		{/if}
	</aside>

	<div class="content">
		<header class="page-head">
			<h1>{page.title}</h1>
			<p class="summary">{page.summary}</p>
			{#if page.documents}
				<p class="documents">Documents: <code>{page.documents}</code></p>
			{/if}
		</header>

		{#each page.sections as section, index (section.id)}
			<HelpSection {section} showHeading={index !== 0} />
		{/each}
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
		border-top: 1px solid var(--ab-color-border, #e2e8f0);
		padding-top: 0.75rem;
	}

	.content {
		min-width: 0;
	}

	.page-head {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--ab-color-border, #e2e8f0);
	}

	.page-head h1 {
		margin: 0 0 0.25rem;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
	}

	.summary {
		margin: 0;
		color: var(--ab-color-fg-muted, #64748b);
		font-size: 1rem;
		line-height: 1.5;
	}

	.documents {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: var(--ab-color-fg-subtle, #94a3b8);
	}

	.documents code {
		background: var(--ab-color-surface-sunken, #f1f5f9);
		padding: 0.0625rem 0.375rem;
		border-radius: 4px;
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		font-size: 0.8125rem;
	}

	@media (max-width: 720px) {
		.help {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: static;
		}
	}
</style>
