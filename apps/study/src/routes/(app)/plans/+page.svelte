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
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}

	.quick {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.plan-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.plan-card.active {
		border-color: #bfdbfe;
		background: #f0f6ff;
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
		font-size: 1.25rem;
	}

	.badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: #e2e8f0;
		color: #475569;
	}

	.active-badge {
		background: #1d4ed8;
		color: white;
	}

	.plan-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem 1.25rem;
		margin: 0;
	}

	.plan-meta dt {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
	}

	.plan-meta dd {
		margin: 0.125rem 0 0;
		color: #0f172a;
		font-size: 0.9375rem;
	}

	.link {
		color: #1d4ed8;
		font-weight: 500;
		text-decoration: none;
		font-size: 0.9375rem;
	}

	.link:hover {
		text-decoration: underline;
	}

	.muted {
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.card-list {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.card-list h2 {
		margin: 0;
		font-size: 0.8125rem;
		color: #64748b;
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
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
	}

	.plan-name {
		color: #0f172a;
		text-decoration: none;
		font-weight: 500;
	}

	.plan-name:hover {
		color: #1d4ed8;
	}

	.meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 120ms, border-color 120ms;
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
