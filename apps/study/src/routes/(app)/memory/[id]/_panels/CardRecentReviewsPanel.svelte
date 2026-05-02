<script lang="ts">
import { REVIEW_RATINGS } from '@ab/constants';
import { humanize } from '@ab/utils';

/**
 * Recent-reviews table for the card detail page. Pure presentation; the
 * parent passes the already-loaded review rows from the server load.
 */

interface RecentReview {
	id: string;
	reviewedAt: Date | string;
	rating: number;
	confidence: number | null;
	stability: number;
	state: string;
	dueAt: Date | string;
}

let { recentReviews }: { recentReviews: ReadonlyArray<RecentReview> } = $props();

const ratingLabels: Record<number, string> = {
	[REVIEW_RATINGS.AGAIN]: 'Again',
	[REVIEW_RATINGS.HARD]: 'Hard',
	[REVIEW_RATINGS.GOOD]: 'Good',
	[REVIEW_RATINGS.EASY]: 'Easy',
};

function formatDate(d: Date | string): string {
	const date = typeof d === 'string' ? new Date(d) : d;
	return date.toLocaleString();
}
</script>

<article class="content">
	<h2>Recent reviews</h2>
	{#if recentReviews.length === 0}
		<p class="empty-note">No reviews yet.</p>
	{:else}
		<table class="reviews">
			<thead>
				<tr>
					<th scope="col">When</th>
					<th scope="col">Rating</th>
					<th scope="col">Confidence</th>
					<th scope="col">Stability</th>
					<th scope="col">State</th>
					<th scope="col">Next due</th>
				</tr>
			</thead>
			<tbody>
				{#each recentReviews as r (r.id)}
					<tr>
						<td>{formatDate(r.reviewedAt)}</td>
						<td>{ratingLabels[r.rating] ?? r.rating}</td>
						<td>{r.confidence ?? '-'}</td>
						<td>{r.stability.toFixed(2)} d</td>
						<td>{humanize(r.state)}</td>
						<td>{formatDate(r.dueAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
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

	.empty-note {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--type-ui-label-size);
	}

	.reviews {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	.reviews th,
	.reviews td {
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		border-bottom: 1px solid var(--edge-default);
	}

	.reviews th {
		color: var(--ink-subtle);
		font-weight: 600;
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.reviews tr:last-child td {
		border-bottom: none;
	}
</style>
