<script lang="ts">
import {
	CERT_LABELS,
	type Cert,
	DEPTH_PREFERENCE_LABELS,
	type DepthPreference,
	DOMAIN_LABELS,
	type Domain,
	PLAN_STATUS_LABELS,
	PLAN_STATUSES,
	type PlanStatus,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODE_LABELS,
	type SessionMode,
} from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const active = $derived(data.activePlan);
const archivedCount = $derived(data.archived.length);

// The plan-index page only ever toggles between active + archived plans
// (drafts live on /plans/new). Reuse the shared PLAN_STATUSES constants
// instead of redefining a parallel two-state enum so labels and status
// values stay single-sourced.
type PlanTab = Extract<PlanStatus, 'active' | 'archived'>;
const TAB_VALUES: readonly PlanTab[] = [PLAN_STATUSES.ACTIVE, PLAN_STATUSES.ARCHIVED];

function narrowTab(raw: string | null): PlanTab {
	return TAB_VALUES.includes((raw ?? '') as PlanTab) ? (raw as PlanTab) : PLAN_STATUSES.ACTIVE;
}

// svelte-ignore state_referenced_locally -- seed from URL on mount; URL syncs thereafter
let currentTab = $state<PlanTab>(narrowTab(page.url.searchParams.get(QUERY_PARAMS.TAB)));

// Keep the URL in sync with the active tab. `replaceState` avoids piling up
// history entries as the user toggles. Matches the pattern used on
// `/knowledge/[slug]/learn` and `/sessions/[id]`.
$effect(() => {
	const tab = currentTab;
	const url = new URL(page.url);
	const current = url.searchParams.get(QUERY_PARAMS.TAB);
	// Default (active) stays out of the URL so clean links don't grow a param.
	if (tab === PLAN_STATUSES.ACTIVE) {
		if (current === null) return;
		url.searchParams.delete(QUERY_PARAMS.TAB);
	} else {
		if (current === tab) return;
		url.searchParams.set(QUERY_PARAMS.TAB, tab);
	}
	replaceState(url, page.state);
});

function fmt(date: Date): string {
	return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<svelte:head>
	<title>Plans -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		title="Study plans"
		subtitle="What you're studying. One active plan drives each session."
		actionsLabel="Quick actions"
	>
		{#snippet actions()}
			{#if active}
				<Button variant="secondary" href={ROUTES.PLAN(active.id)}>Edit plan</Button>
				<Button variant="primary" href={ROUTES.SESSION_START}>Start session</Button>
			{:else}
				<Button variant="primary" href={ROUTES.PLANS_NEW}>New plan</Button>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="tabs" role="tablist" aria-label="Plan lists">
		<button
			type="button"
			role="tab"
			aria-selected={currentTab === PLAN_STATUSES.ACTIVE}
			class="tab"
			class:selected={currentTab === PLAN_STATUSES.ACTIVE}
			onclick={() => (currentTab = PLAN_STATUSES.ACTIVE)}
		>
			Active
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={currentTab === PLAN_STATUSES.ARCHIVED}
			class="tab"
			class:selected={currentTab === PLAN_STATUSES.ARCHIVED}
			onclick={() => (currentTab = PLAN_STATUSES.ARCHIVED)}
		>
			Archived
			{#if archivedCount > 0}
				<span class="tab-count" aria-hidden="true">{archivedCount}</span>
			{/if}
		</button>
	</div>

	{#if currentTab === PLAN_STATUSES.ACTIVE}
		{#if active}
			<article class="plan-card active">
				<div class="plan-head">
					<div>
						<h2>{active.title}</h2>
						<span class="badge active-badge">{PLAN_STATUS_LABELS[active.status as PlanStatus]}</span>
					</div>
					<a class="link" href={ROUTES.PLAN(active.id)}>Open</a>
				</div>
				<dl class="plan-meta">
					<div>
						<dt>Cert goals</dt>
						<dd>
							{#if active.certGoals.length === 0}
								<span class="muted">none</span>
							{:else}
								{active.certGoals.map((c) => CERT_LABELS[c as Cert]).join(', ')}
							{/if}
						</dd>
					</div>
					<div>
						<dt>Focus domains</dt>
						<dd>
							{#if active.focusDomains.length === 0}
								<span class="muted">none</span>
							{:else}
								{active.focusDomains.map((d) => DOMAIN_LABELS[d as Domain]).join(', ')}
							{/if}
						</dd>
					</div>
					<div>
						<dt>Depth</dt>
						<dd>{DEPTH_PREFERENCE_LABELS[active.depthPreference as DepthPreference]}</dd>
					</div>
					<div>
						<dt>Default mode</dt>
						<dd>{SESSION_MODE_LABELS[active.defaultMode as SessionMode]}</dd>
					</div>
					<div>
						<dt>Session length</dt>
						<dd>{active.sessionLength} items</dd>
					</div>
				</dl>
			</article>
		{:else}
			<EmptyState
				title="No active plan yet"
				body="Create your first plan: pick certifications you're working toward, focus domains, session length. You can edit it anytime."
			>
				{#snippet actions()}
					<Button variant="primary" href={ROUTES.PLANS_NEW}>Create plan</Button>
				{/snippet}
			</EmptyState>
		{/if}
	{:else if archivedCount > 0}
		<article class="card-list">
			<h2>Archived plans</h2>
			<ul class="plans">
				{#each data.archived as p (p.id)}
					<li>
						<a class="plan-name" href={ROUTES.PLAN(p.id)}>{p.title}</a>
						<span class="meta">
							<span class="badge">{PLAN_STATUS_LABELS[p.status as PlanStatus]}</span>
							<span class="muted">{fmt(p.updatedAt)}</span>
						</span>
					</li>
				{/each}
			</ul>
		</article>
	{:else}
		<EmptyState
			title="No archived plans"
			body="Archived plans appear here when you replace your active plan. You haven't archived any plans yet."
		/>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.tabs {
		display: flex;
		gap: var(--space-xs);
		border-bottom: 1px solid var(--edge-default);
	}

	.tab {
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		padding: var(--space-sm) var(--space-md);
		font-size: var(--type-definition-body-size);
		font-weight: 500;
		color: var(--ink-subtle);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		margin-bottom: -1px;
		transition: color var(--motion-fast), border-color var(--motion-fast);
	}

	.tab:hover {
		color: var(--ink-body);
	}

	.tab.selected {
		color: var(--action-default-hover);
		border-bottom-color: var(--action-default-hover);
	}

	.tab-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5em;
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-pill);
		background: var(--edge-default);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
	}

	.tab.selected .tab-count {
		background: var(--action-default-hover);
		color: var(--ink-inverse);
	}

	.plan-card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.plan-card.active {
		border-color: var(--action-default-edge);
		background: var(--action-default-wash);
	}

	.plan-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-md);
	}

	.plan-head h2 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--type-heading-1-size);
	}

	.badge {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		background: var(--edge-default);
		color: var(--ink-muted);
	}

	.active-badge {
		background: var(--action-default-hover);
		color: var(--ink-inverse);
	}

	.plan-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-md) var(--space-xl);
		margin: 0;
	}

	.plan-meta dt {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
	}

	.plan-meta dd {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
	}

	.link {
		color: var(--action-default-hover);
		font-weight: 500;
		text-decoration: none;
		font-size: var(--type-definition-body-size);
	}

	.link:hover {
		text-decoration: underline;
	}

	.muted {
		color: var(--ink-faint);
		font-size: var(--type-ui-label-size);
	}

	.card-list {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.card-list h2 {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.plans {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.plans li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.plan-name {
		color: var(--ink-body);
		text-decoration: none;
		font-weight: 500;
	}

	.plan-name:hover {
		color: var(--action-default-hover);
	}

	.meta {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

</style>
