<script lang="ts">
import type { PanelResult, RecentActivity } from '@ab/bc-study';
import { ACTIVITY_WINDOW_DAYS } from '@ab/constants';
import PanelShell from '@ab/ui/components/PanelShell.svelte';

/**
 * 7-day activity sparkline. CSS-only bars -- no chart library. Each bar
 * represents one UTC day's reviews + attempts. Renders a continuous axis
 * even when the user has zero activity (the BC always returns days items).
 */

let { activity }: { activity: PanelResult<RecentActivity> } = $props();

const value = $derived<RecentActivity | null>('value' in activity ? activity.value : null);
const errorMessage = $derived('error' in activity ? activity.error : undefined);

const days = $derived(value?.days ?? []);
const max = $derived(Math.max(1, ...days.map((d) => d.reviews + d.attempts)));

function dayLabel(key: string): string {
	// key is YYYY-MM-DD; use the UTC day-of-week letter (M/T/W/T/F/S/S).
	const d = new Date(`${key}T00:00:00.000Z`);
	return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getUTCDay()];
}

function tooltipFor(day: RecentActivity['days'][number]): string {
	return `${day.day}: ${day.reviews} reviews + ${day.attempts} attempts`;
}

function barPercent(day: RecentActivity['days'][number]): number {
	const total = day.reviews + day.attempts;
	return Math.round((total / max) * 100);
}

// AT-readable equivalent: list the raw counts so a screen reader doesn't
// have to interpret the bar heights.
const screenReaderSummary = $derived(
	days.length === 0
		? `No activity in the last ${ACTIVITY_WINDOW_DAYS} days.`
		: `Last ${days.length} days, items per day: ${days.map((d) => d.reviews + d.attempts).join(', ')}.`,
);
</script>

<PanelShell
	title="Recent activity"
	subtitle={`Last ${ACTIVITY_WINDOW_DAYS} days`}
	error={errorMessage}
>
	{#if value === null}
		<!-- error path handled by shell; value=null only happens under error. -->
		<p class="muted">No data.</p>
	{:else if value.total === 0}
		<div class="spark empty" aria-label={screenReaderSummary}>
			{#each days as d, i (`${d.day}-${i}`)}
				<span class="col" title={tooltipFor(d)}>
					<span class="bar zero"></span>
					<span class="lbl">{dayLabel(d.day)}</span>
				</span>
			{/each}
		</div>
		<p class="muted">No activity in the last {ACTIVITY_WINDOW_DAYS} days.</p>
	{:else}
		<div class="spark" aria-label={screenReaderSummary}>
			{#each days as d, i (`${d.day}-${i}`)}
				<span class="col" title={tooltipFor(d)}>
					<span
						class="bar"
						class:zero={d.reviews + d.attempts === 0}
						style="--h: {barPercent(d)}%"
					></span>
					<span class="lbl">{dayLabel(d.day)}</span>
				</span>
			{/each}
		</div>
		<div class="meta">
			<span><strong>{value.averagePerDay.toFixed(1)}</strong>/day average</span>
			<span><strong>{value.streakDays}</strong> day streak</span>
			<span><strong>{value.total}</strong> items this week</span>
		</div>
	{/if}
</PanelShell>

<style>
	.spark {
		display: flex;
		flex: 1 1 auto;
		align-items: flex-end;
		gap: var(--space-2xs);
		min-height: 6rem;
		padding: var(--space-xs) var(--space-sm) var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}

	.spark.empty {
		min-height: 5rem;
	}

	.col {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-2xs);
		min-width: 0;
	}

	.bar {
		width: 100%;
		max-width: 14px;
		/* lint-disable-token-enforcement: component-scoped CSS var set via inline style */
		height: var(--h, 8%);
		min-height: 3px;
		background: var(--action-default);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height var(--motion-normal);
	}

	.bar.zero {
		background: var(--edge-strong);
		height: 3px;
	}

	.lbl {
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
		font-weight: var(--type-heading-3-weight);
		line-height: 1;
		font-family: var(--font-family-mono);
	}

	.meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}

	.meta strong {
		color: var(--ink-body);
		font-variant-numeric: tabular-nums;
		font-weight: var(--type-heading-1-weight);
	}

	.muted {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--type-ui-caption-size);
	}

	@media (max-width: 640px) {
		.meta {
			grid-template-columns: 1fr;
		}
	}
</style>
