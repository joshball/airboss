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
	ROUTES,
	SESSION_MODE_LABELS,
	type SessionMode,
} from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const active = $derived(data.activePlan);

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
				Create your first plan: pick certifications you're working toward, focus domains, session length. You can
				edit it anytime.
			</p>
			<a class="btn primary" href={ROUTES.PLANS_NEW}>Create plan</a>
		</article>
	{/if}

	{#if data.archived.length > 0}
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

	.plan-card {
		/* TODO-theme: pick a role token for this literal. */ background: white;
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
		/* TODO-theme: pick a role token for this literal. */ color: white;
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
		letter-spacing: 0.06em;
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
		/* TODO-theme: pick a role token for this literal. */ background: white;
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
		letter-spacing: 0.08em;
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
		/* TODO-theme: pick a role token for this literal. */ color: white;
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
