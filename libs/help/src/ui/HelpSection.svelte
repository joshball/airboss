<script lang="ts">
import ReferenceText from '@ab/aviation/ui/ReferenceText.svelte';
import type { HelpSection } from '../schema/help-section';

/**
 * A single help-page section. Collapsible: click the heading or use
 * Enter/Space to toggle. First section of a page typically renders with
 * `showHeading={false}` to act as the lede.
 *
 * The markdown body is piped through `ReferenceText` from `@ab/aviation`
 * so `[[display::id]]` wiki-links resolve to the aviation glossary inline.
 * `ReferenceText` handles plain-text segments as-is, so non-wiki-link
 * markdown passes through untouched (Phase 1 does not render full
 * markdown -- the body is treated as prose with wiki-link resolution).
 */

let {
	section,
	showHeading = true,
	startExpanded = true,
}: {
	section: HelpSection;
	showHeading?: boolean;
	startExpanded?: boolean;
} = $props();

// Persist expansion state locally once mounted. Capturing `startExpanded`
// once is intentional -- the prop is an initial value, not a reactive
// controller.
let expanded = $state(false);
$effect(() => {
	expanded = startExpanded;
});

function toggle(): void {
	expanded = !expanded;
}

function handleKey(event: KeyboardEvent): void {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		toggle();
	}
}
</script>

<section id={section.id} class="section">
	{#if showHeading}
		<h2>
			<button
				type="button"
				class="toggle"
				aria-expanded={expanded}
				aria-controls={`${section.id}-body`}
				onclick={toggle}
				onkeydown={handleKey}
			>
				<span class="chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
				<span class="title">{section.title}</span>
			</button>
		</h2>
	{/if}
	{#if expanded}
		<div id={`${section.id}-body`} class="body">
			<ReferenceText source={section.body} />
		</div>
	{/if}
</section>

<style>
	.section {
		padding: 0.5rem 0 1rem;
		scroll-margin-top: 4rem;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.125rem;
		font-weight: var(--ab-font-weight-semibold, 600);
		color: var(--ab-color-fg, #0f172a);
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: transparent;
		border: 0;
		padding: 0.25rem 0;
		cursor: pointer;
		color: inherit;
		font: inherit;
		font-weight: inherit;
	}

	.toggle:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring, #60a5fa);
		outline-offset: 2px;
		border-radius: var(--ab-radius-sm, 4px);
	}

	.chevron {
		color: var(--ab-color-fg-muted, #64748b);
		font-size: 0.875rem;
		width: 1ch;
		display: inline-block;
	}

	.body {
		font-size: 1rem;
		line-height: 1.6;
		color: var(--ab-color-fg, #0f172a);
		white-space: pre-wrap;
	}
</style>
