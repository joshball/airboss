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
		gap: 1.5rem;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-body);
	}

	.quick {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.plan-card {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.plan-card.active {
		border-color: var(--ab-color-primary-subtle-border);
		background: var(--ab-color-primary-subtle);
	}

	.plan-card.empty {
		text-align: center;
		align-items: center;
	}

	.plan-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.plan-head h2 {
		margin: 0 0 0.25rem;
		font-size: var(--ab-font-size-2xl);
	}

	.badge {
		display: inline-block;
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: var(--ab-radius-pill);
		background: var(--ab-color-border);
		color: var(--ab-color-fg-muted);
	}

	.active-badge {
		background: var(--ab-color-primary-hover);
		color: white;
	}

	.plan-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem 1.25rem;
		margin: 0;
	}

	.plan-meta dt {
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ab-color-fg-subtle);
	}

	.plan-meta dd {
		margin: 0.125rem 0 0;
		color: var(--ab-color-fg);
		font-size: var(--ab-font-size-body);
	}

	.link {
		color: var(--ab-color-primary-hover);
		font-weight: 500;
		text-decoration: none;
		font-size: var(--ab-font-size-body);
	}

	.link:hover {
		text-decoration: underline;
	}

	.muted {
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-sm);
	}

	.card-list {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.card-list h2 {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
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
		gap: 0.5rem;
	}

	.plans li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
	}

	.plan-name {
		color: var(--ab-color-fg);
		text-decoration: none;
		font-weight: 500;
	}

	.plan-name:hover {
		color: var(--ab-color-primary-hover);
	}

	.meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover {
		background: var(--ab-color-primary-hover);
	}

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.secondary:hover {
		background: var(--ab-color-border);
	}
</style>
