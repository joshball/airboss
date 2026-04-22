<script lang="ts">
import type { DashboardStats, PanelResult, RepBacklog, StudyPlanRow } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import PanelShell from './PanelShell.svelte';

/**
 * Primary action panel. With the Study Plan + Session Engine BCs live, the
 * primary CTA is plan-aware:
 *   - no active plan -> "Create a study plan" (onboarding nudge)
 *   - active plan    -> "Start session" (session engine picks the slices)
 *
 * Memory review and rep sessions stay accessible as secondary CTAs when the
 * user has pressure on either queue -- the plan-driven session is the
 * headline action, not the only action.
 */

let {
	stats,
	repBacklog,
	activePlan,
}: {
	stats: PanelResult<DashboardStats>;
	repBacklog: PanelResult<RepBacklog>;
	activePlan: PanelResult<StudyPlanRow | null>;
} = $props();

const statsValue = $derived('value' in stats ? stats.value : null);
const backlogValue = $derived('value' in repBacklog ? repBacklog.value : null);
const planValue = $derived('value' in activePlan ? activePlan.value : null);
const dueCount = $derived(statsValue?.dueNow ?? 0);
const scheduledCount = $derived(backlogValue?.totalActive ?? 0);
const hasPlan = $derived(planValue !== null);

type Cta = { href: string; label: string };

// Primary CTA prefers a plan-driven session. Without a plan, the CTA
// becomes the onboarding "create a plan" nudge so the user never lands on
// a dead dashboard.
const primary = $derived<Cta>(
	hasPlan
		? { href: ROUTES.SESSION_START, label: 'Start session' }
		: { href: ROUTES.PLANS_NEW, label: 'Create a study plan' },
);

// Secondary CTAs: surface real work pressure alongside the primary action so
// the user can sidestep the plan-driven flow when a review queue or rep
// backlog is waiting. Empty when neither queue has items.
const secondaries = $derived<Cta[]>([
	...(dueCount > 0 ? [{ href: ROUTES.MEMORY_REVIEW, label: `Review (${dueCount})` }] : []),
	...(scheduledCount > 0 && hasPlan ? [] : scheduledCount > 0 ? [{ href: ROUTES.REPS_SESSION, label: 'Reps' }] : []),
]);

// Combine errors from all three feeds; the shell renders it inline.
const panelError = $derived(
	[
		'error' in stats ? stats.error : null,
		'error' in repBacklog ? repBacklog.error : null,
		'error' in activePlan ? activePlan.error : null,
	]
		.filter((e): e is string => typeof e === 'string')
		.join('; ') || undefined,
);

const subtitle = $derived(hasPlan ? 'What you should do next' : 'Set up your plan to unlock sessions');
</script>

<PanelShell title="Today" {subtitle} error={panelError}>
	<div class="ctas">
		<a class="btn primary" href={primary.href}>{primary.label}</a>
		{#each secondaries as cta (cta.href)}
			<a class="btn secondary" href={cta.href}>{cta.label}</a>
		{/each}
	</div>
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
</style>
