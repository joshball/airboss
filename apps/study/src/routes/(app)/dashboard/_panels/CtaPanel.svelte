<script lang="ts">
import type { DashboardStats, PanelResult, RepBacklog } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import PanelShell from './PanelShell.svelte';

/**
 * Primary action panel. Until Study Plan + Session Engine land, the CTA
 * forks between memory review (due > 0) and rep session (scheduled > 0).
 * Fresh users with neither signal get a "create your first card" nudge.
 */

let {
	stats,
	repBacklog,
}: {
	stats: PanelResult<DashboardStats>;
	repBacklog: PanelResult<RepBacklog>;
} = $props();

const statsValue = $derived('value' in stats ? stats.value : null);
const backlogValue = $derived('value' in repBacklog ? repBacklog.value : null);
const dueCount = $derived(statsValue?.dueNow ?? 0);
const scheduledCount = $derived(backlogValue?.totalActive ?? 0);

type Cta = { href: string; label: string; tone: 'primary' | 'secondary' };

const primary = $derived<Cta | null>(
	dueCount > 0
		? { href: ROUTES.MEMORY_REVIEW, label: `Start memory review (${dueCount} due)`, tone: 'primary' }
		: scheduledCount > 0
			? { href: ROUTES.REPS_SESSION, label: 'Start rep session', tone: 'primary' }
			: statsValue && backlogValue
				? { href: ROUTES.MEMORY_NEW, label: 'Create your first card', tone: 'primary' }
				: null,
);

const secondary = $derived<Cta | null>(
	// Show the "other" action as a secondary when both are available so the
	// user always has both entry points visible. Stays null if the primary
	// is the create-your-first-card fallback.
	dueCount > 0 && scheduledCount > 0
		? { href: ROUTES.REPS_SESSION, label: 'Start rep session', tone: 'secondary' }
		: null,
);

const caughtUp = $derived(dueCount === 0 && scheduledCount === 0 && statsValue !== null && backlogValue !== null);

// Combine errors from both feeds into one message; the shell renders it in
// the standard error slot. Either one failing still lets the other drive the
// panel, but without both it's cleaner to show the inline error.
const panelError = $derived(
	'error' in stats && 'error' in repBacklog
		? `${stats.error}; ${repBacklog.error}`
		: 'error' in stats
			? stats.error
			: 'error' in repBacklog
				? repBacklog.error
				: undefined,
);
</script>

<PanelShell title="Today" subtitle="What you should do next" error={panelError}>
	{#if caughtUp}
		<p class="caught-up">Caught up for today.</p>
		<p class="muted">
			Nothing due, nothing scheduled. Want to <a href={ROUTES.MEMORY_NEW}>write a card</a>
			or <a href={ROUTES.REPS_NEW}>sketch a scenario</a>?
		</p>
	{:else}
		<div class="ctas">
			{#if primary}
				<a class="btn primary" href={primary.href}>{primary.label}</a>
			{/if}
			{#if secondary}
				<a class="btn secondary" href={secondary.href}>{secondary.label}</a>
			{/if}
		</div>
	{/if}
</PanelShell>

<style>
	.ctas {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border-radius: 2px;
		border: 1px solid transparent;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition:
			background 120ms,
			border-color 120ms;
		font-variant-numeric: tabular-nums;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover {
		background: #e2e8f0;
	}

	.caught-up {
		margin: 0;
		color: #0f172a;
		font-weight: 600;
		font-size: 0.8125rem;
	}

	.muted {
		margin: 0;
		color: #64748b;
		font-size: 0.75rem;
	}

	.muted a {
		color: #1d4ed8;
	}
</style>
