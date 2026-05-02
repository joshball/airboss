<script lang="ts" module>
export interface BreadcrumbItem {
	/** Label rendered for this crumb. */
	label: string;
	/**
	 * Optional href. When omitted, the crumb is rendered as the
	 * "current" segment (non-link). Typically only the last item omits href.
	 */
	href?: string;
	/**
	 * When true, render this crumb's label in monospace. Useful for
	 * trailing id segments ("Sources / src_01ABC...").
	 */
	mono?: boolean;
}
</script>

<script lang="ts">
/**
 * Themed breadcrumb trail.
 *
 * Renders a list of crumbs with `/` separators; entries with an `href`
 * are links, entries without are the "current" segment. The component
 * sets `aria-label="Breadcrumb"` on the wrapping `<nav>` per the WAI
 * APG breadcrumb pattern, with `aria-current="page"` on the current
 * segment.
 *
 * Replaces the per-page `.crumbs` style blocks duplicated across the
 * hangar app (sources/[id], glossary/[id], jobs/[id], audit/[id], ...).
 */

let {
	items,
	ariaLabel = 'Breadcrumb',
}: {
	items: readonly BreadcrumbItem[];
	ariaLabel?: string;
} = $props();
</script>

<nav class="crumbs" aria-label={ariaLabel} data-testid="breadcrumbs-root">
	{#each items as item, index (index)}
		{#if index > 0}
			<span class="sep" aria-hidden="true">/</span>
		{/if}
		{#if item.href}
			<a class="crumb" class:mono={item.mono} href={item.href}>{item.label}</a>
		{:else}
			<span class="crumb current" class:mono={item.mono} aria-current="page">{item.label}</span>
		{/if}
	{/each}
</nav>

<style>
	.crumbs {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		flex-wrap: wrap;
	}

	.sep {
		color: var(--ink-faint);
	}

	a.crumb {
		color: var(--link-default);
		text-decoration: none;
	}

	a.crumb:hover {
		color: var(--link-hover);
		text-decoration: underline;
	}

	a.crumb:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.current {
		color: var(--ink-body);
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>
