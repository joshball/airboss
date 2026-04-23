<script lang="ts">
import type { DashboardStats, PanelResult } from '@ab/bc-study';
import { DOMAIN_LABELS, ROUTES } from '@ab/constants';
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

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? slug;
}

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
			<a class="action-btn" href={ROUTES.MEMORY_REVIEW}>Start review</a>
		{:else}
			<a class="action-btn ghost" href={ROUTES.MEMORY}>Memory</a>
		{/if}
	{/snippet}

	{#if dueNow === 0}
		<p class="muted">All caught up on reviews.</p>
	{:else}
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
	.domains {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-3xs);
	}

	.dm {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--ab-space-sm);
		padding: var(--ab-space-2xs) var(--ab-space-xs);
		border-radius: var(--ab-radius-sm);
		text-decoration: none;
		color: var(--ab-color-fg);
		font-size: var(--ab-font-size-sm);
	}

	.dm:hover {
		background: var(--ab-color-surface-sunken);
	}

	.dm-name {
		font-weight: var(--ab-font-weight-medium);
	}

	.dm-count {
		color: var(--ab-color-primary-hover);
		font-weight: var(--ab-font-weight-semibold);
		font-variant-numeric: tabular-nums;
		font-family: var(--ab-font-family-mono);
	}

	.more {
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
		padding: var(--ab-space-3xs) var(--ab-space-xs);
	}

	.muted {
		margin: 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-xs);
	}

	.action-btn {
		padding: var(--ab-space-2xs) var(--ab-space-sm);
		font-size: var(--ab-font-size-xs);
		font-weight: var(--ab-font-weight-semibold);
		border-radius: var(--ab-radius-sm);
		border: 1px solid var(--ab-color-primary);
		background: var(--ab-color-primary);
		color: var(--ab-color-primary-fg);
		text-decoration: none;
	}

	.action-btn:hover {
		background: var(--ab-color-primary-hover);
	}

	.action-btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
		border-color: var(--ab-color-border-strong);
	}

	.action-btn.ghost:hover {
		background: var(--ab-color-surface-sunken);
	}
</style>
