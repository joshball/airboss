<script lang="ts">
import type { PanelResult, WeakArea, WeakAreaReason } from '@ab/bc-study';
import { DOMAIN_LABELS, ROUTES, WEAK_AREA_WINDOW_DAYS } from '@ab/constants';
import PanelShell from '@ab/ui/components/PanelShell.svelte';

/**
 * Weak-areas panel. Top N domains ranked by card accuracy + rep accuracy +
 * overdue load. Each row shows the domain, the reason(s), and a deep link
 * into the right browse surface.
 */

let { weakAreas }: { weakAreas: PanelResult<WeakArea[]> } = $props();

const value = $derived('value' in weakAreas ? weakAreas.value : []);
const errorMessage = $derived('error' in weakAreas ? weakAreas.error : undefined);

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? slug;
}

function rowHref(area: WeakArea): string {
	const slug = encodeURIComponent(area.domain);
	return area.link === 'reps' ? `${ROUTES.REPS_BROWSE}?domain=${slug}` : `${ROUTES.MEMORY_BROWSE}?domain=${slug}`;
}

function reasonLabel(reason: WeakAreaReason): string {
	switch (reason.kind) {
		case 'card-accuracy':
			return `${Math.round(reason.accuracy * 100)}% on cards (${reason.dataPoints} reviews)`;
		case 'rep-accuracy':
			return `${Math.round(reason.accuracy * 100)}% on reps (${reason.dataPoints} attempts)`;
		case 'overdue':
			return `${reason.overdueCount} overdue`;
	}
}
</script>

<PanelShell
	title="Weak areas"
	subtitle={`Lowest accuracy + biggest overdue pile (last ${WEAK_AREA_WINDOW_DAYS} days)`}
	error={errorMessage}
>
	{#if value.length === 0}
		<p class="muted">Study a few cards to see where you're slipping.</p>
	{:else}
		<ul class="areas">
			{#each value as area (area.domain)}
				<li>
					<a class="row" href={rowHref(area)}>
						<span class="dm-name">{domainLabel(area.domain)}</span>
						<span class="reasons">
							{#each area.reasons as reason, i (`${area.domain}-${reason.kind}-${i}`)}
								<span class="reason">{reasonLabel(reason)}</span>
							{/each}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</PanelShell>

<style>
	.areas {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--ink-body);
		border: 1px solid transparent;
	}

	.row:hover {
		background: var(--action-hazard-wash);
		border-color: var(--action-hazard-edge);
	}

	.dm-name {
		font-weight: var(--type-heading-3-weight);
		font-size: var(--type-ui-label-size);
	}

	.reasons {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.reason {
		font-size: var(--type-ui-caption-size);
		color: var(--signal-warning);
		font-variant-numeric: tabular-nums;
		font-family: var(--font-family-mono);
	}

	.muted {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--type-ui-caption-size);
	}
</style>
