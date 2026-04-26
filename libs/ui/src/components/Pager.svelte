<script lang="ts" module>
export interface PagerProps {
	/** 1-based current page. */
	currentPage: number;
	/** Total page count. */
	totalPages: number;
	/** Whether a next page exists. The server may know this earlier than `totalPages`. */
	hasMore: boolean;
	/** Builder that returns the URL for a given 1-based page index. */
	pageHref: (n: number) => string;
	/** ARIA label for the nav. Default: "Pagination". */
	ariaLabel?: string;
	/** Localized labels. */
	previousLabel?: string;
	nextLabel?: string;
}
</script>

<script lang="ts">
import Button from './Button.svelte';

let {
	currentPage,
	totalPages,
	hasMore,
	pageHref,
	ariaLabel = 'Pagination',
	previousLabel = 'Previous',
	nextLabel = 'Next',
}: PagerProps = $props();
</script>

<nav class="pager" aria-label={ariaLabel} data-testid="pager-root" data-current-page={currentPage} data-total-pages={totalPages}>
	{#if currentPage > 1}
		<span data-testid="pager-prev"><Button href={pageHref(currentPage - 1)} variant="ghost">{previousLabel}</Button></span>
	{:else}
		<span data-testid="pager-prev-empty"></span>
	{/if}
	<span class="page-num" data-testid="pager-status">Page {currentPage} of {totalPages}</span>
	{#if hasMore}
		<span data-testid="pager-next"><Button href={pageHref(currentPage + 1)} variant="ghost">{nextLabel}</Button></span>
	{:else}
		<span data-testid="pager-next-empty"></span>
	{/if}
</nav>

<style>
	.pager {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) 0;
	}

	.pager > :first-child {
		justify-self: start;
	}

	.pager > :last-child {
		justify-self: end;
	}

	.page-num {
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
	}
</style>
