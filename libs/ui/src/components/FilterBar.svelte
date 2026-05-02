<script lang="ts" module>
export type FilterBarLayout = 'grid' | 'rows';

export interface FilterBarProps {
	/** Accessible label for the surrounding `<section>`. */
	ariaLabel: string;
	/**
	 * Layout strategy:
	 * - `grid` (default): a single grid row with `grid-template-columns`
	 *   driven by `columns`. Best for the common "search + a few selects"
	 *   bar.
	 * - `rows`: stacked vertical layout. Children supply their own row
	 *   structure. Use for multi-row filter bars (audit explorer, etc.).
	 */
	layout?: FilterBarLayout;
	/** CSS `grid-template-columns` value (only for `layout="grid"`). Default: `repeat(auto-fit, minmax(12rem, 1fr))`. */
	columns?: string;
	/** Maximum width. Pass a CSS length (e.g. `40rem`) or `'none'`. Default: unset (full width). */
	maxWidth?: string;
}
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Themed filter-bar shell. A panel wrapper for filter inputs (search,
 * selects, toggles) above a list/table.
 *
 * Field labelling lives in the consumer; pair with `FilterField` (which
 * supplies the small uppercase label / vertical stack) or render fields
 * inline. Reads colors from surface/edge/radius tokens so theme swaps
 * propagate.
 *
 * Replaces the per-page `.filter-bar` style block duplicated across
 * hangar routes (admin/audit, glossary, glossary/sources, jobs, users).
 */

let {
	ariaLabel,
	layout = 'grid',
	columns = 'repeat(auto-fit, minmax(12rem, 1fr))',
	maxWidth,
	children,
}: FilterBarProps & { children: Snippet } = $props();

/**
 * The columns and maxWidth are applied via inline style. Theme-lint
 * forbids ad-hoc CSS custom properties, so the component sets the
 * concrete grid/max-width values directly. Mobile responsive override
 * uses the class hierarchy below.
 */
const gridStyle = $derived.by(() => {
	const parts: string[] = [];
	if (layout === 'grid') parts.push(`grid-template-columns: ${columns}`);
	if (maxWidth !== undefined) parts.push(`max-width: ${maxWidth}`);
	return parts.join('; ') || undefined;
});
</script>

<section
	class="filter-bar"
	class:layout-grid={layout === 'grid'}
	class:layout-rows={layout === 'rows'}
	aria-label={ariaLabel}
	data-testid="filter-bar-root"
	data-layout={layout}
	style={gridStyle}
>
	{@render children()}
</section>

<style>
	.filter-bar {
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.filter-bar.layout-grid {
		display: grid;
		/* grid-template-columns supplied via inline style so callers
		 * can override per-page without inventing a new CSS variable
		 * for every layout shape. */
		align-items: end;
	}

	.filter-bar.layout-rows {
		display: flex;
		flex-direction: column;
	}
</style>
