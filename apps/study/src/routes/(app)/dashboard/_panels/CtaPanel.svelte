<script lang="ts">
import type { DashboardStats, PanelResult, RepBacklog, StudyPlanRow } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PanelShell from '@ab/ui/components/PanelShell.svelte';

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
		<Button variant="primary" size="sm" href={primary.href}>{primary.label}</Button>
		{#each secondaries as cta (cta.href)}
			<Button variant="secondary" size="sm" href={cta.href}>{cta.label}</Button>
		{/each}
	</div>
</PanelShell>

<style>
	.ctas {
		display: flex;
		gap: var(--ab-space-xs);
		flex-wrap: wrap;
	}
</style>
