<script lang="ts">
import ReferenceText from '@ab/aviation/ui/ReferenceText.svelte';
import type { MdNode } from '../markdown/ast';
import type { HelpSection } from '../schema/help-section';
import MarkdownBody from './MarkdownBody.svelte';

/**
 * A single help-page section. Collapsible: click the heading or use
 * Enter/Space to toggle. First section of a page typically renders with
 * `showHeading={false}` to act as the lede.
 *
 * When `nodes` is provided the section body is rendered with the full
 * `<MarkdownBody>` renderer (headings, lists, tables, callouts, etc.).
 * When `nodes` is omitted the legacy `<ReferenceText>` fallback is used,
 * which only resolves `[[display::id]]` wiki-links -- sufficient for
 * simple callers that haven't migrated to the loader-parse pipeline.
 */

let {
	section,
	showHeading = true,
	startExpanded = true,
	nodes,
}: {
	section: HelpSection;
	showHeading?: boolean;
	startExpanded?: boolean;
	nodes?: MdNode[];
} = $props();

// Persist expansion state locally once mounted. `startExpanded` is treated
// as an initial value, not a reactive controller: after first render the
// user's toggle state wins. Using `$state(startExpanded)` captures the
// initial prop value once without a resetting `$effect`, which would
// clobber user toggles every time the parent rerendered.
// svelte-ignore state_referenced_locally -- intentional initial seed
let expanded = $state(startExpanded);

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

<section id={section.id} class="section" data-testid="helpsection-root" data-state={expanded ? 'expanded' : 'collapsed'}>
	{#if showHeading}
		<h2>
			<button
				type="button"
				class="toggle"
				aria-expanded={expanded}
				aria-controls={`${section.id}-body`}
				data-testid="helpsection-toggle"
				onclick={toggle}
				onkeydown={handleKey}
			>
				<span class="chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
				<span class="title" data-testid="helpsection-title">{section.title}</span>
			</button>
		</h2>
	{/if}
	{#if expanded}
		<div id={`${section.id}-body`} class="body" class:legacy={!nodes} data-testid="helpsection-body">
			{#if nodes}
				<MarkdownBody {nodes} />
			{:else}
				<ReferenceText source={section.body} />
			{/if}
		</div>
	{/if}
</section>

<style>
	.section {
		padding: var(--space-sm) 0 var(--space-lg);
		scroll-margin-top: 4rem;
	}

	h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		background: transparent;
		border: 0;
		padding: var(--space-2xs) 0;
		cursor: pointer;
		color: inherit;
		font: inherit;
		font-weight: inherit;
	}

	.toggle:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.chevron {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		width: 1ch;
		display: inline-block;
	}

	.body {
		font-size: var(--font-size-base);
		line-height: 1.6;
		color: var(--ink-body);
	}

	/*
	 * Legacy `<ReferenceText>` rendering preserves source whitespace; the new
	 * `<MarkdownBody>` path emits real <p>/<li>/<table> elements where
	 * `pre-wrap` would force literal newlines between paragraphs and inside
	 * lists.
	 */
	.body.legacy {
		white-space: pre-wrap;
	}
</style>
