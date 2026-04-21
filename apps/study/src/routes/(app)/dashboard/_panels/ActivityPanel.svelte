<script lang="ts">
import type { PanelResult, RecentActivity } from '@ab/bc-study';
import { ACTIVITY_WINDOW_DAYS } from '@ab/constants';
import PanelShell from './PanelShell.svelte';

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
		<div class="spark" aria-label={screenReaderSummary}>
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
		align-items: flex-end;
		gap: 0.375rem;
		height: 64px;
		padding: 0.5rem 0.25rem 0.25rem;
		background: #f8fafc;
		border-radius: 8px;
	}

	.col {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}

	.bar {
		width: 100%;
		max-width: 18px;
		height: var(--h, 8%);
		min-height: 4px;
		background: #2563eb;
		border-radius: 3px 3px 0 0;
		transition: height 200ms ease-out;
	}

	.bar.zero {
		background: #cbd5e1;
		height: 4px;
	}

	.lbl {
		font-size: 0.6875rem;
		color: #94a3b8;
		font-weight: 600;
		line-height: 1;
	}

	.meta {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		color: #475569;
		font-size: 0.875rem;
	}

	.meta strong {
		color: #0f172a;
		font-variant-numeric: tabular-nums;
	}

	.muted {
		margin: 0;
		color: #64748b;
		font-size: 0.875rem;
	}
</style>
