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
const reviewedToday = $derived(statsValue?.reviewedToday ?? 0);
const streakDays = $derived(statsValue?.streakDays ?? 0);
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
	...(scheduledCount > 0 && hasPlan ? [] : scheduledCount > 0 ? [{ href: ROUTES.SESSION_START, label: 'Reps' }] : []),
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
const intro = $derived(
	hasPlan
		? 'Launch the next session or jump straight into the queue that is backing up.'
		: 'Start with a plan, then use this board as your launch panel for the next block of work.',
);
</script>

<PanelShell title="Today" {subtitle} error={panelError}>
	<div class="hero">
		<p class="intro">{intro}</p>

		<div class="ctas">
			<Button variant="primary" size="sm" href={primary.href}>{primary.label}</Button>
			{#each secondaries as cta (cta.href)}
				<Button variant="secondary" size="sm" href={cta.href}>{cta.label}</Button>
			{/each}
		</div>

		<dl class="stats" aria-label="Dashboard launch metrics">
			<div>
				<dt>Due now</dt>
				<dd>{dueCount}</dd>
			</div>
			<div>
				<dt>Done today</dt>
				<dd>{reviewedToday}</dd>
			</div>
			<div>
				<dt>Streak</dt>
				<dd>
					{streakDays}
					<span>{streakDays === 1 ? 'day' : 'days'}</span>
				</dd>
			</div>
		</dl>
	</div>
</PanelShell>

<style>
	.hero {
		display: grid;
		flex: 1 1 auto;
		align-content: start;
		gap: var(--space-sm);
		min-height: 0;
	}

	.intro {
		margin: 0;
		max-width: 34rem;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		line-height: 1.5;
	}

	.ctas {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.stats {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-sm);
	}

	.stats div {
		min-width: 0;
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}

	.stats dt {
		margin: 0 0 var(--space-2xs);
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
		letter-spacing: var(--letter-spacing-caps);
		text-transform: uppercase;
	}

	.stats dd {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: var(--space-2xs);
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-heading-3-size);
		font-weight: var(--type-heading-3-weight);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.stats dd span {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		font-weight: var(--type-ui-label-weight);
	}

	@media (max-width: 640px) {
		.stats {
			grid-template-columns: 1fr;
		}
	}
</style>
