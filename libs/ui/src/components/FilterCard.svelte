<script lang="ts" module>
export interface FilterCardProps {
	/** The page-relative URL to navigate to when Reset is clicked. */
	resetHref: string;
	/** Localized label for the Apply submit. Default: "Apply". */
	applyLabel?: string;
	/** Localized label for the Reset link. Default: "Reset". */
	resetLabel?: string;
	/** ARIA label for the form. Default: "Filter". */
	ariaLabel?: string;
	/** When the filter form needs hidden inputs (e.g. to pin page=1 across submits), pass them here. */
	hidden?: import('svelte').Snippet;
	/** The filter selects/inputs. Each child is expected to be a `.filter` div with a label + control. */
	controls: import('svelte').Snippet;
}
</script>

<script lang="ts">
import Button from './Button.svelte';

let {
	resetHref,
	applyLabel = 'Apply',
	resetLabel = 'Reset',
	ariaLabel = 'Filter',
	hidden,
	controls,
}: FilterCardProps = $props();
</script>

<form class="filters" method="GET" role="search" aria-label={ariaLabel}>
	{#if hidden}{@render hidden()}{/if}
	<div class="filter-grid">
		{@render controls()}
	</div>
	<div class="filter-actions">
		<Button type="submit" variant="secondary">{applyLabel}</Button>
		<Button href={resetHref} variant="ghost">{resetLabel}</Button>
	</div>
</form>

<style>
	.filters {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
	}

	.filter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--space-md);
		align-items: end;
	}

	.filter-actions {
		display: flex;
		gap: var(--space-xs);
		justify-content: flex-end;
		padding-top: var(--space-sm);
		border-top: 1px solid var(--edge-default);
	}

	:global(.filters .filter) {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		min-width: 0;
	}

	:global(.filters .filter-label-row) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		min-height: 1.25rem;
	}

	:global(.filters .filter label) {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	:global(.filters .filter input),
	:global(.filters .filter select) {
		font: inherit;
		padding: var(--space-sm) var(--space-sm);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
		color: var(--ink-body);
		min-width: 0;
	}

	:global(.filters .filter input:focus),
	:global(.filters .filter select:focus) {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}
</style>
