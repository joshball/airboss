<script lang="ts">
import { domainLabel, ROUTES, WEAKNESS_SEVERITY_LABELS } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const buckets = $derived(data.buckets);
const totalSurfaced = $derived(buckets.reduce((acc, b) => acc + b.areas.length, 0));

function reasonText(area: {
	reasons: { kind: string; accuracy?: number; overdueCount?: number; activeCards?: number; dataPoints?: number }[];
}): string {
	return area.reasons
		.map((r) => {
			if (r.kind === 'card-accuracy') return `card ${Math.round((r.accuracy ?? 0) * 100)}% (${r.dataPoints})`;
			if (r.kind === 'rep-accuracy') return `rep ${Math.round((r.accuracy ?? 0) * 100)}% (${r.dataPoints})`;
			if (r.kind === 'overdue') return `${r.overdueCount}/${r.activeCards} overdue`;
			return r.kind;
		})
		.join(' / ');
}
</script>

<svelte:head>
	<title>Weakness lens -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		eyebrow="Lens"
		title="Weakness lens"
		subtitle="Domains ranked by combined card accuracy, rep accuracy, and overdue load over the last 30 days. Bucketed by severity."
	/>

	{#if totalSurfaced === 0}
		<EmptyState
			title="No weakness signal yet"
			body="Either you've recorded fewer than the minimum data points across domains, or your accuracy and overdue load are above the mild threshold across the board. Keep reviewing; the lens fills as the signal accumulates."
		/>
	{:else}
		{#each buckets as bucket (bucket.severity)}
			<section class="bucket" aria-labelledby="bucket-{bucket.severity}">
				<header class="bucket-head">
					<h2 id="bucket-{bucket.severity}">
						<span class="severity-pill" data-severity={bucket.severity}>{WEAKNESS_SEVERITY_LABELS[bucket.severity]}</span>
						<span class="bucket-count">{bucket.areas.length} domain{bucket.areas.length === 1 ? '' : 's'}</span>
					</h2>
					<a class="see-all" href={ROUTES.LENS_WEAKNESS_BUCKET(bucket.severity)}>See all</a>
				</header>
				{#if bucket.areas.length === 0}
					<p class="muted">No domains in this bucket.</p>
				{:else}
					<ul class="area-list">
						{#each bucket.areas as area (area.domain)}
							<li class="area">
								<span class="dm-name">{domainLabel(area.domain)}</span>
								<span class="reasons">{reasonText(area)}</span>
								<a
									class="drill"
									href={area.link === 'reps'
										? `${ROUTES.REPS_BROWSE}?domain=${encodeURIComponent(area.domain)}`
										: `${ROUTES.MEMORY_BROWSE}?domain=${encodeURIComponent(area.domain)}`}>Drill</a
								>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 80rem;
		margin: 0 auto;
		width: 100%;
	}

	.muted {
		color: var(--ink-faint);
		margin: 0;
	}

	.bucket {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.bucket-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.bucket-head h2 {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		font-size: var(--font-size-lg);
	}

	.bucket-count {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-regular);
	}

	.severity-pill {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	[data-severity='severe'] {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border: 1px solid var(--signal-danger-edge);
	}

	[data-severity='moderate'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
		border: 1px solid var(--signal-warning-edge);
	}

	[data-severity='mild'] {
		background: var(--surface-panel);
		color: var(--ink-subtle);
		border: 1px solid var(--edge-default);
	}

	.see-all {
		color: var(--action-link);
		text-decoration: none;
		font-size: var(--font-size-sm);
	}

	.area-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.area {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) 2fr auto;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		align-items: center;
	}

	.dm-name {
		font-weight: var(--font-weight-semibold);
	}

	.reasons {
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
	}

	.drill {
		color: var(--action-link);
		text-decoration: none;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
	}
</style>
