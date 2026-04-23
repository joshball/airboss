<script lang="ts">
import type { PanelResult, RepBacklog } from '@ab/bc-study';
import { DOMAIN_LABELS, ROUTES } from '@ab/constants';
import PanelShell from '@ab/ui/components/PanelShell.svelte';

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
			<a class="action-btn" href={ROUTES.SESSION_START}>Start session</a>
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

	.dm-counts {
		display: flex;
		gap: var(--ab-space-sm);
		font-size: var(--ab-font-size-xs);
		font-family: var(--ab-font-family-mono);
	}

	.dm-new {
		color: var(--ab-color-primary-hover);
		font-weight: var(--ab-font-weight-semibold);
	}

	.dm-total {
		color: var(--ab-color-fg-subtle);
		font-variant-numeric: tabular-nums;
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

	.muted a {
		color: var(--ab-color-primary-hover);
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
