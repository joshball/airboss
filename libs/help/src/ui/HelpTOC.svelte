<script lang="ts">
import type { HelpSection } from '../schema/help-section';

/**
 * Nested TOC for a HelpPage. Renders one link per section, targeting the
 * section's anchor id. Active-section highlighting (aria-current on the
 * section currently in view) is computed by the parent page through a
 * scroll observer; this component just reflects the active id.
 */

let {
	sections,
	activeId = null,
}: {
	sections: readonly HelpSection[];
	activeId?: string | null;
} = $props();
</script>

<nav class="toc" aria-label="Table of contents">
	<ul>
		{#each sections as section (section.id)}
			<li>
				<a
					href={`#${section.id}`}
					aria-current={activeId === section.id ? 'true' : undefined}
					class:active={activeId === section.id}
				>
					{section.title}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.toc ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.toc a {
		display: block;
		padding: 0.375rem 0.625rem;
		border-radius: var(--radius-sm);
		color: var(--ink-muted);
		text-decoration: none;
		font-size: 0.875rem;
		line-height: 1.4;
		border-left: 2px solid transparent;
	}

	.toc a:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.toc a.active {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-left-color: var(--action-default);
	}

	.toc a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
