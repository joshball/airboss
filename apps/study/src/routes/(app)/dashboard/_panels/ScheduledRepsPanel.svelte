<script lang="ts">
import type { PanelResult, RepBacklog } from '@ab/bc-study';
import { DOMAIN_LABELS, ROUTES } from '@ab/constants';
import PanelShell from './PanelShell.svelte';

/**
 * Scheduled-reps backlog. Counts active scenarios split into never-attempted
 * vs total. Domain rows deep-link to the rep browse filter. Matches the
 * spec's "unattempted first" framing.
 */

let { repBacklog }: { repBacklog: PanelResult<RepBacklog> } = $props();

const value = $derived('value' in repBacklog ? repBacklog.value : null);
const errorMessage = $derived('error' in repBacklog ? repBacklog.error : undefined);

const totalActive = $derived(value?.totalActive ?? 0);
const unattempted = $derived(value?.unattempted ?? 0);
const topDomains = $derived((value?.byDomain ?? []).slice(0, 3));
const moreCount = $derived((value?.byDomain ?? []).length - topDomains.length);

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? slug;
}

function domainHref(slug: string): string {
	return `${ROUTES.REPS_BROWSE}?domain=${encodeURIComponent(slug)}`;
}
</script>

<PanelShell
	title="Scheduled reps"
	subtitle={totalActive > 0 ? `${unattempted} never tried, ${totalActive} total` : undefined}
	error={errorMessage}
>
	{#snippet action()}
		{#if totalActive > 0}
			<a class="action-btn" href={ROUTES.REPS_SESSION}>Start session</a>
		{:else}
			<a class="action-btn ghost" href={ROUTES.REPS_NEW}>New scenario</a>
		{/if}
	{/snippet}

	{#if totalActive === 0}
		<p class="muted">
			No scenarios yet. <a href={ROUTES.REPS_NEW}>Create one</a> to start doing reps.
		</p>
	{:else}
		<ul class="domains">
			{#each topDomains as d (d.domain)}
				<li>
					<a class="dm" href={domainHref(d.domain)}>
						<span class="dm-name">{domainLabel(d.domain)}</span>
						<span class="dm-counts">
							{#if d.unattempted > 0}<span class="dm-new">{d.unattempted} new</span>{/if}
							<span class="dm-total">{d.totalAttempts} attempts</span>
						</span>
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
		gap: 0.25rem;
	}

	.dm {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 6px;
		text-decoration: none;
		color: #0f172a;
	}

	.dm:hover {
		background: #f1f5f9;
	}

	.dm-name {
		font-weight: 500;
	}

	.dm-counts {
		display: flex;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}

	.dm-new {
		color: #1d4ed8;
		font-weight: 600;
	}

	.dm-total {
		color: #64748b;
		font-variant-numeric: tabular-nums;
	}

	.more {
		color: #94a3b8;
		font-size: 0.8125rem;
		padding: 0.25rem 0.5rem;
	}

	.muted {
		margin: 0;
		color: #64748b;
		font-size: 0.875rem;
	}

	.muted a {
		color: #1d4ed8;
	}

	.action-btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border-radius: 6px;
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
