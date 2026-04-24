<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Themed table root. Pair with `TableHeader`, `TableRow`, `TableCell`,
 * `TableHeaderCell`.
 *
 * Reads colors from `--table-*` component tokens so theme swaps
 * propagate. Optional sticky header.
 */

let {
	stickyHeader = false,
	ariaLabel,
	children,
}: {
	stickyHeader?: boolean;
	ariaLabel?: string;
	children: Snippet;
} = $props();
</script>

<div class="wrap" class:sticky={stickyHeader}>
	<table aria-label={ariaLabel}>
		{@render children()}
	</table>
</div>

<style>
	.wrap {
		width: 100%;
		overflow: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	.sticky :global(thead th) {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
	}

	:global(thead th) {
		background: var(--table-header-bg);
		color: var(--table-header-ink);
		font-weight: var(--font-weight-semibold);
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--table-row-edge);
	}

	:global(tbody td) {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--table-row-edge);
	}

	:global(tbody tr:hover) {
		background: var(--table-row-bg-hover);
	}

	:global(tbody tr[aria-selected='true']) {
		background: var(--table-row-bg-selected);
	}
</style>
