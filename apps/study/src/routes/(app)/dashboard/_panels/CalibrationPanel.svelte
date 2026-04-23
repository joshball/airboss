<script lang="ts">
import type { CalibrationResult, PanelResult } from '@ab/bc-study';
import { CONFIDENCE_LEVEL_LABELS, type ConfidenceLevel, ROUTES } from '@ab/constants';
import PanelShell from '@ab/ui/components/PanelShell.svelte';

/**
 * Calibration summary. One-line read: overall score as 0-100, plus the
 * biggest miscalibration gap labeled overconfident or underconfident.
 * Matches the spec's "score + largest signed gap" default.
 *
 * Empty state kicks in when no confidence bucket clears the data-
 * completeness threshold; the full calibration page explains what that
 * threshold is.
 */

let {
	calibration,
}: {
	calibration: PanelResult<CalibrationResult>;
} = $props();

const value = $derived('value' in calibration ? calibration.value : null);
const errorMessage = $derived('error' in calibration ? calibration.error : undefined);

const scorePct = $derived(value?.score !== null && value?.score !== undefined ? Math.round(value.score * 100) : null);

// Largest absolute gap across scored buckets, keeping the sign so the label
// can say "overconfident" (negative gap) vs "underconfident" (positive).
interface LargestGap {
	level: ConfidenceLevel;
	gap: number;
}
const biggestGap = $derived<LargestGap | null>(
	value
		? (value.buckets
				.filter((b) => !b.needsMoreData)
				.reduce<LargestGap | null>((winner, b) => {
					if (!winner || Math.abs(b.gap) > Math.abs(winner.gap)) {
						return { level: b.level as ConfidenceLevel, gap: b.gap };
					}
					return winner;
				}, null) ?? null)
		: null,
);

const gapLabel = $derived(
	biggestGap
		? {
				direction: biggestGap.gap < 0 ? 'overconfident' : 'underconfident',
				pct: Math.round(Math.abs(biggestGap.gap) * 100),
				level: CONFIDENCE_LEVEL_LABELS[biggestGap.level],
			}
		: null,
);
</script>

<PanelShell
	title="Calibration"
	subtitle="Score + biggest miscalibration gap"
	error={errorMessage}
>
	{#snippet action()}
		<a class="action-btn" href={ROUTES.CALIBRATION}>View</a>
	{/snippet}

	{#if scorePct === null}
		<p class="muted">Not enough confidence-rated data yet.</p>
	{:else}
		<div class="score-row">
			<span class="score">{scorePct}</span>
			<span class="score-unit">/ 100</span>
		</div>
		{#if gapLabel}
			<p class="gap">
				<span class={gapLabel.direction === 'overconfident' ? 'over' : 'under'}>{gapLabel.direction}</span>
				by <span class="gap-pct">{gapLabel.pct}%</span>
				at <span class="gap-level">{gapLabel.level}</span>
			</p>
		{:else}
			<p class="muted">No bucket has enough data to flag a gap.</p>
		{/if}
	{/if}
</PanelShell>

<style>
	.action-btn {
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--type-heading-3-weight);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-strong);
		background: var(--surface-panel);
		color: var(--ink-muted);
		text-decoration: none;
	}

	.action-btn:hover {
		background: var(--surface-sunken);
	}

	.score-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-2xs);
		font-family: var(--font-family-mono);
		font-variant-numeric: tabular-nums;
	}

	.score {
		font-size: var(--type-heading-1-size);
		font-weight: var(--type-heading-1-weight);
		color: var(--ink-body);
		line-height: 1;
	}

	.score-unit {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
	}

	.gap {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.gap .over {
		color: var(--action-hazard);
		font-weight: var(--type-heading-3-weight);
	}

	.gap .under {
		color: var(--action-default-hover);
		font-weight: var(--type-heading-3-weight);
	}

	.gap-pct,
	.gap-level {
		font-family: var(--font-family-mono);
		font-variant-numeric: tabular-nums;
		color: var(--ink-body);
		font-weight: var(--type-heading-3-weight);
	}

	.muted {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--type-ui-caption-size);
	}
</style>
