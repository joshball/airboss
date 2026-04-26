<script lang="ts" module>
export interface ResultSummaryProps {
	/** Total count across all pages. When 0, renders nothing. */
	total: number;
	/** Items currently shown in this page (length of the rendered list). */
	pageCount: number;
	/** 1-based current page. */
	currentPage: number;
	/** Items per page. */
	pageSize: number;
	/** Singular noun for entities ("card", "scenario"). */
	noun: string;
	/** Plural noun. Default: `${noun}s`. */
	nounPlural?: string;
	/** True when any filter is active -- adds " matching your filters" suffix. */
	filtersActive?: boolean;
}
</script>

<script lang="ts">
let {
	total,
	pageCount,
	currentPage,
	pageSize,
	noun,
	nounPlural,
	filtersActive = false,
}: ResultSummaryProps = $props();

const plural = $derived(nounPlural ?? `${noun}s`);
const word = $derived(total === 1 ? noun : plural);
const suffix = $derived(filtersActive ? ' matching your filters' : '');
const start = $derived(pageCount === 0 ? 0 : (currentPage - 1) * pageSize + 1);
const end = $derived(pageCount === 0 ? 0 : (currentPage - 1) * pageSize + pageCount);
</script>

{#if total > 0}
	<p class="result-summary" data-testid="resultsummary-root" data-total={total} data-page-count={pageCount}>
		{#if total > pageSize}
			Showing {start}&ndash;{end} of {total} {word}{suffix}.
		{:else}
			Showing {total} {word}{suffix}.
		{/if}
	</p>
{/if}

<style>
	.result-summary {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
	}
</style>
