<script lang="ts" module>
export interface FilterChipDef {
	/** Stable identifier (typically the QUERY_PARAMS key the chip removes). */
	key: string;
	/** Bold prefix shown on the chip ("Domain", "Status"). */
	label: string;
	/** Right-hand value rendered after the label ("Emergency procedures"). */
	value: string;
	/** URL the chip links to when clicked -- removes this filter and keeps the rest. */
	removeHref: string;
}

export interface FilterChipsProps {
	chips: FilterChipDef[];
	/** "Clear all" link href -- the unfiltered base URL. */
	clearHref: string;
	/** ARIA label for the chip row. Default: "Active filters". */
	ariaLabel?: string;
	/** Leading uppercase caption. Default: "Filtering:". */
	heading?: string;
	/** Localized "Clear all" text. Default: "Clear all". */
	clearLabel?: string;
}
</script>

<script lang="ts">
let {
	chips,
	clearHref,
	ariaLabel = 'Active filters',
	heading = 'Filtering:',
	clearLabel = 'Clear all',
}: FilterChipsProps = $props();
</script>

{#if chips.length > 0}
	<div class="chip-row" aria-label={ariaLabel} data-testid="filterchips-root">
		<span class="chip-label" data-testid="filterchips-heading">{heading}</span>
		{#each chips as chip (chip.key)}
			<a
				class="chip"
				href={chip.removeHref}
				aria-label={`Remove ${chip.label} filter`}
				data-testid={`filterchips-chip-${chip.key}`}
			>
				<span class="chip-name">{chip.label}:</span>
				<span class="chip-value">{chip.value}</span>
				<span class="chip-x" aria-hidden="true">×</span>
			</a>
		{/each}
		<a class="chip-clear" href={clearHref} data-testid="filterchips-clear">{clearLabel}</a>
	</div>
{/if}

<style>
	.chip-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-xs);
		padding: 0 var(--space-2xs);
	}

	.chip-label {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
		font-weight: 600;
		margin-right: var(--space-2xs);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-pill);
		color: var(--action-default-hover);
		font-size: var(--type-ui-label-size);
		text-decoration: none;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.chip:hover {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.chip:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.chip-name {
		color: var(--action-default-active);
		font-weight: 600;
	}

	.chip-value {
		color: var(--ink-body);
	}

	.chip-x {
		color: var(--action-default);
		font-size: var(--type-reading-body-size);
		line-height: 1;
	}

	.chip-clear {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-decoration: underline;
		margin-left: var(--space-2xs);
	}

	.chip-clear:hover {
		color: var(--ink-body);
	}
</style>
