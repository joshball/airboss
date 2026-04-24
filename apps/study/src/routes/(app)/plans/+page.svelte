<script lang="ts">
import {
	CERT_LABELS,
	type Cert,
	DEPTH_PREFERENCE_LABELS,
	type DepthPreference,
	DOMAIN_LABELS,
	type Domain,
	PLAN_STATUS_LABELS,
	type PlanStatus,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODE_LABELS,
	type SessionMode,
} from '@ab/constants';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const active = $derived(data.activePlan);
const archivedCount = $derived(data.archived.length);

const TABS = { ACTIVE: 'active', ARCHIVED: 'archived' } as const;
type PlanTab = (typeof TABS)[keyof typeof TABS];
const TAB_VALUES: readonly PlanTab[] = Object.values(TABS);

function narrowTab(raw: string | null): PlanTab {
	return TAB_VALUES.includes((raw ?? '') as PlanTab) ? (raw as PlanTab) : TABS.ACTIVE;
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
	if (tab === TABS.ACTIVE) {
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
	<header class="hd">
		<div>
			<h1>Study plans</h1>
			<p class="sub">What you're studying. One active plan drives each session.</p>
		</div>
		<nav class="quick" aria-label="Quick actions">
			{#if active}
				<a class="btn secondary" href={ROUTES.PLAN(active.id)}>Edit plan</a>
				<a class="btn primary" href={ROUTES.SESSION_START}>Start session</a>
			{:else}
				<a class="btn primary" href={ROUTES.PLANS_NEW}>New plan</a>
			{/if}
		</nav>
	</header>

	<div class="tabs" role="tablist" aria-label="Plan lists">
		<button
			type="button"
			role="tab"
			aria-selected={currentTab === TABS.ACTIVE}
			class="tab"
			class:selected={currentTab === TABS.ACTIVE}
			onclick={() => (currentTab = TABS.ACTIVE)}
		>
			Active
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={currentTab === TABS.ARCHIVED}
			class="tab"
			class:selected={currentTab === TABS.ARCHIVED}
			onclick={() => (currentTab = TABS.ARCHIVED)}
		>
			Archived
			{#if archivedCount > 0}
				<span class="tab-count" aria-hidden="true">{archivedCount}</span>
			{/if}
		</button>
	</div>

	{#if currentTab === TABS.ACTIVE}
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
			<article class="plan-card empty">
				<h2>No active plan yet</h2>
				<p class="muted">
					Create your first plan: pick certifications you're working toward, focus domains, session length. You
					can edit it anytime.
				</p>
				<a class="btn primary" href={ROUTES.PLANS_NEW}>Create plan</a>
			</article>
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
		<article class="plan-card empty">
			<h2>No archived plans</h2>
			<p class="muted">Plans you archive will appear here. Archiving keeps a plan's history without deleting it.</p>
		</article>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--type-definition-body-size);
	}

	.quick {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
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

	.plan-card.empty {
		text-align: center;
		align-items: center;
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

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover {
		background: var(--edge-default);
	}
</style>
