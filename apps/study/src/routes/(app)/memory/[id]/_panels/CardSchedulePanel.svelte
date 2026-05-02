<script lang="ts">
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { humanize } from '@ab/utils';

/**
 * FSRS schedule readout: state, due, stability, difficulty, reviews, lapses.
 * Pure presentation; the parent passes the per-user scheduler row.
 */

interface Schedule {
	state: string;
	dueAt: Date | string;
	stability: number;
	difficulty: number;
	reviewCount: number;
	lapseCount: number;
}

let { schedule }: { schedule: Schedule } = $props();

function formatInterval(ms: number): string {
	const abs = Math.abs(ms);
	const minutes = abs / 60_000;
	const hours = minutes / 60;
	const days = hours / 24;
	const future = ms >= 0;
	let value: string;
	if (abs < 60_000) value = `${Math.round(abs / 1000)}s`;
	else if (minutes < 60) value = `${Math.round(minutes)}m`;
	else if (hours < 48) value = `${Math.round(hours)}h`;
	else if (days < 60) value = `${Math.round(days)}d`;
	else value = `${Math.round(days / 30)}mo`;
	return future ? `in ${value}` : `${value} ago`;
}

const dueLabel = $derived(formatInterval(new Date(schedule.dueAt).getTime() - Date.now()));
</script>

<article class="content schedule">
	<h2>Schedule</h2>
	<dl class="stats">
		<div>
			<dt>
				State
				<InfoTip
					term="State"
					definition="Where this card sits in the FSRS lifecycle: New, Learning, Review, or Relearning."
					helpId="concept-fsrs"
					helpSection="states"
				/>
			</dt>
			<dd>{humanize(schedule.state)}</dd>
		</div>
		<div>
			<dt>
				Due
				<InfoTip
					term="Due"
					definition="When the scheduler wants to see this card next. Negative means overdue."
					helpId="memory-card"
					helpSection="due"
				/>
			</dt>
			<dd>{dueLabel}</dd>
		</div>
		<div>
			<dt>
				Stability
				<InfoTip
					term="Stability"
					definition="Estimated days of retention. Higher means a longer interval to the next review."
					helpId="concept-fsrs"
					helpSection="stability-vs-difficulty"
				/>
			</dt>
			<dd>{schedule.stability.toFixed(2)} d</dd>
		</div>
		<div>
			<dt>
				Difficulty
				<InfoTip
					term="Difficulty"
					definition="How hard this card is for you, 1 (easy) to 10 (hard). FSRS adjusts it from your ratings."
					helpId="concept-fsrs"
					helpSection="stability-vs-difficulty"
				/>
			</dt>
			<dd>{schedule.difficulty.toFixed(2)}</dd>
		</div>
		<div>
			<dt>
				Reviews
				<InfoTip
					term="Reviews"
					definition="Total times you have rated this card across all sessions."
					helpId="memory-card"
					helpSection="reviews"
				/>
			</dt>
			<dd>{schedule.reviewCount}</dd>
		</div>
		<div>
			<dt>
				Lapses
				<InfoTip
					term="Lapses"
					definition="Times you rated Again after the card left Learning. Each lapse pushes difficulty up."
					helpId="memory-card"
					helpSection="lapses"
				/>
			</dt>
			<dd>{schedule.lapseCount}</dd>
		</div>
	</dl>
</article>

<style>
	.content {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.content h2 {
		margin: 0;
		font-size: var(--type-reading-body-size);
		color: var(--ink-strong);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.stats {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--space-md);
	}

	.stats > div {
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
	}

	.stats dt {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.stats dd {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
		font-weight: 500;
	}

	@media (max-width: 480px) {
		.stats {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
