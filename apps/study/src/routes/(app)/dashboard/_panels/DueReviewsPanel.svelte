<script lang="ts">
import type { DashboardStats, PanelResult } from '@ab/bc-study';
import { domainLabel, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PanelShell from '@ab/ui/components/PanelShell.svelte';

/**
 * Reviews-due-today panel. Shows the due-now count, top 3 domains, and a
 * deep link into the review queue. Domain rows link into the browse view
 * filtered to that domain -- matches the PRD "every data point leads
 * somewhere" principle.
 */

let { stats }: { stats: PanelResult<DashboardStats> } = $props();

const value = $derived('value' in stats ? stats.value : null);
const errorMessage = $derived('error' in stats ? stats.error : undefined);

const dueNow = $derived(value?.dueNow ?? 0);
// Sort domains by due desc so the "top 3" are the ones with pressure.
const topDomains = $derived(
	(value?.domains ?? [])
		.filter((d) => d.due > 0)
		.sort((a, b) => b.due - a.due)
		.slice(0, 3),
);
const moreCount = $derived((value?.domains ?? []).filter((d) => d.due > 0).length - topDomains.length);

function domainHref(slug: string): string {
	return `${ROUTES.MEMORY_BROWSE}?domain=${encodeURIComponent(slug)}`;
}
</script>

<PanelShell
	title="Reviews due today"
	subtitle={dueNow > 0 ? `${dueNow} ${dueNow === 1 ? 'card' : 'cards'} waiting` : undefined}
	error={errorMessage}
>
	{#snippet action()}
		{#if dueNow > 0}
			<Button variant="primary" size="sm" href={ROUTES.MEMORY_REVIEW}>Start review</Button>
		{:else}
			<Button variant="secondary" size="sm" href={ROUTES.MEMORY}>Memory</Button>
		{/if}
	{/snippet}

	{#if dueNow === 0}
		<p class="muted">All caught up on reviews.</p>
	{:else}
		<div class="summary">
			<span class="count">{dueNow}</span>
			<span class="label">{dueNow === 1 ? 'card ready' : 'cards ready'}</span>
		</div>
		<ul class="domains">
			{#each topDomains as d (d.domain)}
				<li>
					<a class="dm" href={domainHref(d.domain)}>
						<span class="dm-name">{domainLabel(d.domain)}</span>
						<span class="dm-count">{d.due}</span>
					</a>
				</li>
			{/each}
			{#if moreCount > 0}
				<li class="more">+{moreCount} more {moreCount === 1 ? 'domain' : 'domains'}</li>
			{/if}
		</ul>
	{/if}
</PanelShell>

<style>
	.summary {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		font-variant-numeric: tabular-nums;
	}

	.count {
		color: var(--ink-body);
		font-size: var(--type-heading-2-size);
		font-weight: var(--type-heading-2-weight);
		line-height: 1;
	}

	.label {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.domains {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		gap: var(--space-2xs);
		min-height: 0;
		overflow: auto;
	}

	.dm {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
	}

	.dm:hover {
		background: var(--surface-sunken);
	}

	.dm-name {
		font-weight: var(--type-ui-control-weight);
	}

	.dm-count {
		color: var(--action-default-hover);
		font-weight: var(--type-heading-3-weight);
		font-variant-numeric: tabular-nums;
		font-family: var(--font-family-mono);
	}

	.more {
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
		padding: var(--space-2xs) var(--space-xs);
	}

	.muted {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--type-ui-caption-size);
	}
</style>
