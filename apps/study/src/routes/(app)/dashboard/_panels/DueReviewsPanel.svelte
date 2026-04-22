<script lang="ts">
import type { DashboardStats, PanelResult } from '@ab/bc-study';
import { DOMAIN_LABELS, ROUTES } from '@ab/constants';
import PanelShell from './PanelShell.svelte';

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
		gap: 0.125rem;
	}

	.dm {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.25rem 0.375rem;
		border-radius: 2px;
		text-decoration: none;
		color: #0f172a;
		font-size: 0.8125rem;
	}

	.dm:hover {
		background: #f1f5f9;
	}

	.dm-name {
		font-weight: 500;
	}

	.dm-count {
		color: #1d4ed8;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
	}

	.more {
		color: #94a3b8;
		font-size: 0.75rem;
		padding: 0.125rem 0.375rem;
	}

	.muted {
		margin: 0;
		color: #64748b;
		font-size: 0.75rem;
	}

	.action-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 2px;
		border: 1px solid #2563eb;
		background: #2563eb;
		color: white;
		text-decoration: none;
	}

	.action-btn:hover {
		background: #1d4ed8;
	}

	.action-btn.ghost {
		background: transparent;
		color: #475569;
		border-color: #cbd5e1;
	}

	.action-btn.ghost:hover {
		background: #f1f5f9;
	}
</style>
