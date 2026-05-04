<script lang="ts" module>
export interface ScoreMetaItem {
	/** Caption-style label rendered above the value. */
	label: string;
	/** Big-and-bold value. Strings or numbers. Pass `--` for "no data yet". */
	value: string | number;
	/**
	 * Optional `data-testid` suffix when a test needs to target a specific
	 * row (rendered as `scoremeta-item-${testId}`). Falls back to index.
	 */
	testId?: string;
}
</script>

<script lang="ts">
/**
 * Score / metric callout: a `<dl>` of `(label, value)` pairs rendered
 * with the label on top and a large, weighty, tabular value below.
 *
 * Used as the meta line under headline scores -- e.g. the calibration
 * page's `<ScoreCard>` meta snippet ("Data points" + "Domains with
 * data"). Extracted from the `.score-meta` `<dl>` block flagged in the
 * chunk-1 svelte review so other surfaces (sessions/[id]/summary,
 * dashboard panels) can reuse the same shape without re-shipping the
 * styles.
 *
 * Generic label/value `<dl>`s with a different visual shape (inline
 * key-value pairs in a header, two-column grid in an invite card) stay
 * route-local; this primitive owns the "label-on-top, big-numeric-value"
 * shape only.
 */

let {
	items,
	ariaLabel,
}: {
	items: readonly ScoreMetaItem[];
	ariaLabel?: string;
} = $props();
</script>

<dl class="score-meta" aria-label={ariaLabel} data-testid="scoremeta-root">
	{#each items as item, index (item.label)}
		<div class="cell" data-testid="scoremeta-item-{item.testId ?? index}">
			<dt class="label">{item.label}</dt>
			<dd class="value">{item.value}</dd>
		</div>
	{/each}
</dl>

<style>
	.score-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xl);
		margin: 0;
	}

	.cell {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.value {
		margin: 0;
		font-size: var(--type-heading-2-size);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
		font-variant-numeric: tabular-nums;
		line-height: var(--line-height-tight);
	}
</style>
