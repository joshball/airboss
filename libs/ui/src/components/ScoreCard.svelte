<script lang="ts" module>
export type ScoreCardSize = 'md' | 'lg';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Large numeric stat block: optional eyebrow label, big tabular-num
 * value, optional unit, optional sub-line for context.
 *
 * Two sizes:
 *   - `md` (default) -- dashboard panel use; pairs with PanelShell
 *   - `lg`           -- hero card on dedicated stat pages (e.g. calibration)
 *
 * Use `valueSnippet` instead of `value` when the number needs custom
 * markup (split spans, fallback dashes, etc.).
 *
 * Slots:
 *   - `valueSnippet` -- replaces the default `{value}` rendering
 *   - `meta`         -- additional context block beneath the score
 *                       (e.g. dl of secondary stats); replaces `sub` when
 *                       the route needs structured rather than prose meta
 */

let {
	label,
	value,
	unit,
	sub,
	size = 'md',
	valueSnippet,
	meta,
}: {
	label?: string;
	value?: string | number;
	unit?: string;
	sub?: string;
	size?: ScoreCardSize;
	valueSnippet?: Snippet;
	meta?: Snippet;
} = $props();
</script>

<div class="score s-{size}" data-testid="scorecard-root" data-size={size}>
	<div class="main">
		{#if label}
			<span class="label" data-testid="scorecard-label">{label}</span>
		{/if}
		<div class="value-row">
			<span class="value" data-testid="scorecard-value">
				{#if valueSnippet}
					{@render valueSnippet()}
				{:else}
					{value}
				{/if}
			</span>
			{#if unit}
				<span class="unit" data-testid="scorecard-unit">{unit}</span>
			{/if}
		</div>
		{#if sub}
			<p class="sub" data-testid="scorecard-sub">{sub}</p>
		{/if}
	</div>
	{#if meta}
		<div class="meta" data-testid="scorecard-meta">{@render meta()}</div>
	{/if}
</div>

<style>
	.score {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		font-variant-numeric: tabular-nums;
		min-width: 0;
	}

	.s-lg {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-xl);
		padding: var(--space-xl);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
	}

	.main {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		flex: 1 1 16rem;
		min-width: 0;
	}

	.label {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.value-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-2xs);
	}

	.value {
		color: var(--ink-body);
		font-weight: var(--font-weight-bold);
		line-height: 1;
	}

	.s-md .value {
		font-size: var(--font-size-xl);
	}

	.s-lg .value {
		font-size: var(--font-size-2xl);
	}

	.unit {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}

	.sub {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.meta {
		display: flex;
		gap: var(--space-xl);
	}
</style>
