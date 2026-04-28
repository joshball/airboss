<script lang="ts">
import { domainLabel, NAV_LABELS, ROUTES, WEAKNESS_SEVERITY_LABELS } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const severity = $derived(data.severity);
const areas = $derived(data.areas);

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
	<title>{WEAKNESS_SEVERITY_LABELS[severity]} weakness -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.LENS_WEAKNESS}>{NAV_LABELS.LENS_WEAKNESS}</a>
		<span aria-hidden="true">/</span>
		<span>{WEAKNESS_SEVERITY_LABELS[severity]}</span>
	</nav>

	<PageHeader
		eyebrow="Weakness severity"
		title={WEAKNESS_SEVERITY_LABELS[severity]}
		subtitle="Domains in the {severity} bucket, ranked by combined weakness score."
	/>

	{#if areas.length === 0}
		<EmptyState
			title="No domains in this bucket"
			body="Nothing currently scores into the {severity} severity bucket."
		/>
	{:else}
		<ul class="area-list">
			{#each areas as area (area.domain)}
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

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.crumb a {
		color: var(--ink-subtle);
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
