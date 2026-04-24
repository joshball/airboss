<script lang="ts" module>
/**
 * Column-driven data table. One step up from `Table.svelte`: renders header +
 * rows from a typed `columns[]` definition, handles sort + keyboard affordances,
 * and exposes a `row` snippet for callers that need bespoke cell rendering.
 *
 * Use this when you want a consistent header/body/empty-row shape across hangar
 * sources / jobs / glossary. Use `Table.svelte` when you need full manual control.
 *
 * Designed to stay theme-pure: every color/spacing comes from role tokens.
 * Sort logic lives in `lib/data-table-sort.ts` so it is unit-testable.
 */

export interface DataTableColumn<T> {
	id: string;
	header: string;
	/** When set, the column is sortable by this accessor. */
	sortBy?: (row: T) => string | number | null | undefined;
	/** Header cell className. */
	headClass?: string;
	/** Body cell className. */
	cellClass?: string;
	/** Fraction width hint (CSS grid template). Optional. */
	width?: string;
	/** Sticky left. */
	sticky?: boolean;
}

export type { SortDir, SortState } from '../lib/data-table-sort';
</script>

<script lang="ts" generics="T extends { id: string }">
import type { Snippet } from 'svelte';
import { flipSortState, sortRows, type SortState } from '../lib/data-table-sort';

interface Props {
	columns: readonly DataTableColumn<T>[];
	rows: readonly T[];
	/** Caller-rendered cell content per row. Receives the row + column ids so the snippet can key on column.id. */
	row: Snippet<[T]>;
	/** Empty-state snippet. Falls back to a generic "No rows" panel. */
	empty?: Snippet;
	/** Optional caption + header row. */
	ariaLabel?: string;
	/** Initial sort. Null column means insertion order. */
	initialSort?: SortState;
	/** Callback when sort changes. */
	onSortChange?: (state: SortState) => void;
}

const {
	columns,
	rows,
	row,
	empty,
	ariaLabel,
	initialSort = { columnId: null, direction: 'asc' },
	onSortChange,
}: Props = $props();

// svelte-ignore state_referenced_locally
let sort = $state<SortState>({ columnId: initialSort.columnId, direction: initialSort.direction });

function flipSort(column: DataTableColumn<T>): void {
	if (!column.sortBy) return;
	const next = flipSortState(sort, column.id);
	sort = next;
	onSortChange?.(next);
}

const sortedRows = $derived.by(() => {
	if (!sort.columnId) return rows;
	const column = columns.find((c) => c.id === sort.columnId);
	if (!column?.sortBy) return rows;
	return sortRows(rows, column.sortBy, sort.direction);
});

function sortIndicator(column: DataTableColumn<T>): string {
	if (!column.sortBy) return '';
	if (sort.columnId !== column.id) return ' ';
	return sort.direction === 'asc' ? '^' : 'v';
}
</script>

<div class="wrap">
	<table aria-label={ariaLabel}>
		<thead>
			<tr>
				{#each columns as column (column.id)}
					<th
						class={column.headClass}
						class:sticky={column.sticky}
						style={column.width ? `width:${column.width}` : undefined}
						aria-sort={column.sortBy && sort.columnId === column.id
							? sort.direction === 'asc'
								? 'ascending'
								: 'descending'
							: 'none'}
					>
						{#if column.sortBy}
							<button
								type="button"
								class="sort"
								class:active={sort.columnId === column.id}
								onclick={() => flipSort(column)}
							>
								<span>{column.header}</span>
								<span class="indicator" aria-hidden="true">{sortIndicator(column)}</span>
							</button>
						{:else}
							{column.header}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if sortedRows.length === 0}
				<tr class="empty-row">
					<td colspan={columns.length}>
						{#if empty}
							{@render empty()}
						{:else}
							<span class="empty-label">No rows.</span>
						{/if}
					</td>
				</tr>
			{:else}
				{#each sortedRows as r (r.id)}
					{@render row(r)}
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<style>
	.wrap {
		width: 100%;
		overflow-x: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	th {
		background: var(--table-header-bg);
		color: var(--table-header-ink);
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--table-row-edge);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--type-ui-caption-size);
		vertical-align: bottom;
	}

	th.sticky {
		position: sticky;
		left: 0;
		z-index: var(--z-sticky);
	}

	:global(.data-table-body td) {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--table-row-edge);
		vertical-align: top;
	}

	tbody :global(tr:hover) {
		background: var(--table-row-bg-hover);
	}

	tbody :global(tr[aria-selected='true']) {
		background: var(--table-row-bg-selected);
	}

	.empty-row td {
		padding: var(--space-xl);
		text-align: center;
		color: var(--ink-muted);
		border-bottom: none;
	}

	.empty-label {
		font-style: italic;
	}

	.sort {
		background: transparent;
		border: 0;
		padding: 0;
		color: inherit;
		font: inherit;
		text-transform: inherit;
		letter-spacing: inherit;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.sort:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.sort:hover {
		color: var(--ink-body);
	}

	.indicator {
		min-width: 0.75ch;
		opacity: 0.6;
		font-family: var(--font-family-mono);
	}

	.sort.active .indicator {
		opacity: 1;
		color: var(--action-default);
	}
</style>
