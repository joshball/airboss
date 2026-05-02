<script lang="ts">
import type { CardCrossReferences } from '@ab/bc-study';
import { REVIEW_SESSION_STATUSES, type ReviewSessionStatus, ROUTES } from '@ab/constants';
import InfoTip from '@ab/ui/components/InfoTip.svelte';

/**
 * Cross-references row for the card detail page: sessions that included
 * this card, plus the reps/plans/scenarios "coming soon" placeholders that
 * keep the IA visible while their data sources are wired.
 */

let { crossRefs }: { crossRefs: CardCrossReferences } = $props();

const reviewSessionStatusLabels: Record<ReviewSessionStatus, string> = {
	[REVIEW_SESSION_STATUSES.ACTIVE]: 'Active',
	[REVIEW_SESSION_STATUSES.COMPLETED]: 'Completed',
	[REVIEW_SESSION_STATUSES.ABANDONED]: 'Abandoned',
};
</script>

<article class="content cross-refs">
	<h2>Cross-references</h2>
	<ul class="xref-list">
		<li class="xref-row">
			<div class="xref-head">
				<span class="xref-label">Sessions</span>
				<InfoTip
					term="Sessions"
					definition="Memory-review sessions (the /memory/review flow) that included this card. Each row is a full run you can reopen."
					helpId="memory-card"
					helpSection="cross-refs"
				/>
				<span class="xref-count">{crossRefs.sessions.length}</span>
			</div>
			{#if crossRefs.sessions.length === 0}
				<p class="xref-empty">No review sessions have included this card yet.</p>
			{:else}
				<ul class="xref-items">
					{#each crossRefs.sessions as s (s.id)}
						<li>
							<a href={ROUTES.MEMORY_REVIEW_SESSION(s.id)}>
								{new Date(s.startedAt).toLocaleString()}
							</a>
							<span class="xref-sub">{reviewSessionStatusLabels[s.status]}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</li>

		<li class="xref-row">
			<div class="xref-head">
				<span class="xref-label">Reps</span>
				<InfoTip
					term="Reps"
					definition="Decision-rep scenarios that cite this card. Enrollment between reps and cards is not tracked yet; this row lights up once it is."
					helpId="memory-card"
					helpSection="cross-refs"
				/>
				{#if crossRefs.reps.comingSoon}
					<span class="xref-pill">Coming soon</span>
				{:else}
					<span class="xref-count">{crossRefs.reps.items.length}</span>
				{/if}
			</div>
			<p class="xref-empty">Reps-to-card enrollment is not tracked yet.</p>
		</li>

		<li class="xref-row">
			<div class="xref-head">
				<span class="xref-label">Plans</span>
				<InfoTip
					term="Plans"
					definition="Study plans that include this card. Plan-to-card enrollment is not yet tracked."
					helpId="memory-card"
					helpSection="cross-refs"
				/>
				{#if crossRefs.plans.comingSoon}
					<span class="xref-pill">Coming soon</span>
				{:else}
					<span class="xref-count">{crossRefs.plans.items.length}</span>
				{/if}
			</div>
			<p class="xref-empty">Plan-to-card enrollment is not yet tracked.</p>
		</li>

		<li class="xref-row">
			<div class="xref-head">
				<span class="xref-label">Scenarios</span>
				<InfoTip
					term="Scenarios"
					definition="Rep scenarios that cite this card as a reference. Waits on the content-citations work package."
					helpId="memory-card"
					helpSection="cross-refs"
				/>
				{#if crossRefs.scenarios.comingSoon}
					<span class="xref-pill">Coming soon</span>
				{:else}
					<span class="xref-count">{crossRefs.scenarios.items.length}</span>
				{/if}
			</div>
			<p class="xref-empty">Cite this card from a scenario to see it here.</p>
		</li>
	</ul>
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

	.cross-refs .xref-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.xref-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.xref-head {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.xref-label {
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		color: var(--ink-body);
	}

	.xref-count {
		margin-left: auto;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
	}

	.xref-pill {
		margin-left: auto;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--font-size-xs);
		font-weight: 600;
		border-radius: var(--radius-pill);
		color: var(--ink-subtle);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.xref-empty {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
	}

	.xref-items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.xref-items li {
		display: flex;
		gap: var(--space-sm);
		align-items: baseline;
		font-size: var(--type-ui-label-size);
	}

	.xref-items a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.xref-items a:hover {
		text-decoration: underline;
	}

	.xref-sub {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}
</style>
