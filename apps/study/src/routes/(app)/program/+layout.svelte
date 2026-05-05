<!--
@component
Tab strip + chrome for the consolidated `/program` surface
(study-app-ia-cleanup Phase 2).

Four sub-tabs share this layout: Quals / Goal / Plan / Coverage. The active
tab derives from `page.url.pathname` (prefix match against each sub-route),
with the layout's `defaultTab` (from the server load) deciding which child
the bare `/program` index redirects to.

Each tab anchor carries `data-testid="program-tab-{name}"` per the e2e
selector convention in `docs/agents/best-practices.md`.
-->
<script lang="ts">
import { NAV_LABELS, PROGRAM_TABS, ROUTES } from '@ab/constants';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

function pathMatches(current: string, prefix: string): boolean {
	return current === prefix || current.startsWith(`${prefix}/`);
}

const qualsActive = $derived(pathMatches(page.url.pathname, ROUTES.PROGRAM_QUALS));
const goalsActive = $derived(pathMatches(page.url.pathname, ROUTES.PROGRAM_GOALS));
const plansActive = $derived(pathMatches(page.url.pathname, ROUTES.PROGRAM_PLANS));
const coverageActive = $derived(pathMatches(page.url.pathname, ROUTES.PROGRAM_COVERAGE));

// The Goal / Plan tab targets prefer the user's primary goal / active plan
// detail page when one exists -- direct deep-link feels better than a
// "no-goal" intermediate. When neither exists, fall back to the list page;
// it carries the call-to-action that creates the first row.
const goalHref = $derived(data.primaryGoal ? ROUTES.PROGRAM_GOAL(data.primaryGoal.id) : ROUTES.PROGRAM_GOALS);
const planHref = $derived(data.activePlan ? ROUTES.PROGRAM_PLAN(data.activePlan.id) : ROUTES.PROGRAM_PLANS);
</script>

<div class="program-shell">
	<nav class="program-tabs" aria-label="Program sub-sections">
		<a
			href={ROUTES.PROGRAM_QUALS}
			aria-current={qualsActive ? 'page' : undefined}
			data-testid="program-tab-{PROGRAM_TABS.QUALS}"
			>{NAV_LABELS.PROGRAM_QUALS}</a
		>
		<a href={goalHref} aria-current={goalsActive ? 'page' : undefined} data-testid="program-tab-{PROGRAM_TABS.GOAL}"
			>{NAV_LABELS.PROGRAM_GOAL}</a
		>
		<a href={planHref} aria-current={plansActive ? 'page' : undefined} data-testid="program-tab-{PROGRAM_TABS.PLAN}"
			>{NAV_LABELS.PROGRAM_PLAN}</a
		>
		<a
			href={ROUTES.PROGRAM_COVERAGE}
			aria-current={coverageActive ? 'page' : undefined}
			data-testid="program-tab-{PROGRAM_TABS.COVERAGE}"
			>{NAV_LABELS.PROGRAM_COVERAGE}</a
		>
	</nav>

	{@render children()}
</div>

<style>
	.program-shell {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.program-tabs {
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		border-bottom: 1px solid var(--edge-default);
		padding-bottom: var(--space-2xs);
	}

	.program-tabs a {
		color: var(--ink-muted);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.program-tabs a:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.program-tabs a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.program-tabs a[aria-current='page'] {
		color: var(--action-default-hover);
		border-bottom-color: var(--action-default-hover);
	}
</style>
