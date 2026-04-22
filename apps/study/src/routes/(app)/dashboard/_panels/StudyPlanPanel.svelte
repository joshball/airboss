<script lang="ts">
import type { PanelResult, StudyPlanRow } from '@ab/bc-study';
import {
	CERT_LABELS,
	type Cert,
	DEPTH_PREFERENCE_LABELS,
	type DepthPreference,
	DOMAIN_LABELS,
	type Domain,
	ROUTES,
	SESSION_MODE_LABELS,
	type SessionMode,
} from '@ab/constants';
import PanelShell from './PanelShell.svelte';

/**
 * Active study plan summary. Renders the plan title, cert goals, focus
 * domains (or "all" when unset), depth, session length, and default mode
 * with a link to the plan detail page. Empty state nudges the user into
 * the plan builder.
 */

let {
	activePlan,
}: {
	activePlan: PanelResult<StudyPlanRow | null>;
} = $props();

const plan = $derived('value' in activePlan ? activePlan.value : null);
const errorMessage = $derived('error' in activePlan ? activePlan.error : undefined);

function certLabel(c: Cert): string {
	return CERT_LABELS[c] ?? c;
}

function domainLabel(d: Domain): string {
	return DOMAIN_LABELS[d] ?? d;
}
</script>

<PanelShell
	title="Active study plan"
	subtitle={plan ? plan.title : 'Cert goals + focus domains'}
	error={errorMessage}
>
	{#snippet action()}
		{#if plan}
			<a class="action-btn" href={ROUTES.PLAN(plan.id)}>Edit</a>
		{:else}
			<a class="action-btn primary" href={ROUTES.PLANS_NEW}>Create one</a>
		{/if}
	{/snippet}

	{#if !plan}
		<p class="muted">No active plan. Sessions require one -- <a href={ROUTES.PLANS_NEW}>set yours up</a>.</p>
	{:else}
		<dl class="meta">
			<div class="row">
				<dt>Certs</dt>
				<dd>
					{#if plan.certGoals.length === 0}
						<span class="muted">none</span>
					{:else}
						{#each plan.certGoals as c, i (c)}
							{#if i > 0}<span class="sep">/</span>{/if}
							<span class="chip">{certLabel(c)}</span>
						{/each}
					{/if}
				</dd>
			</div>
			<div class="row">
				<dt>Focus</dt>
				<dd>
					{#if plan.focusDomains.length === 0}
						<span class="muted">all domains</span>
					{:else}
						{#each plan.focusDomains as d, i (d)}
							{#if i > 0}<span class="sep">,</span>{/if}
							<span>{domainLabel(d)}</span>
						{/each}
					{/if}
				</dd>
			</div>
			<div class="row">
				<dt>Depth</dt>
				<dd>{DEPTH_PREFERENCE_LABELS[plan.depthPreference as DepthPreference]}</dd>
			</div>
			<div class="row">
				<dt>Session</dt>
				<dd>
					<span class="num">{plan.sessionLength}</span>
					<span class="unit">items</span>
					<span class="sep">//</span>
					<span>{SESSION_MODE_LABELS[plan.defaultMode as SessionMode]}</span>
				</dd>
			</div>
		</dl>
	{/if}
</PanelShell>

<style>
	.action-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 2px;
		border: 1px solid #cbd5e1;
		background: white;
		color: #475569;
		text-decoration: none;
	}

	.action-btn:hover {
		background: #f1f5f9;
	}

	.action-btn.primary {
		background: #2563eb;
		color: white;
		border-color: #2563eb;
	}

	.action-btn.primary:hover {
		background: #1d4ed8;
	}

	.meta {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: 0.5rem;
		row-gap: 0.125rem;
		font-size: 0.75rem;
	}

	.row {
		display: contents;
	}

	.row dt {
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 0.625rem;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
		padding-top: 0.125rem;
	}

	.row dd {
		margin: 0;
		color: #0f172a;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem;
		min-width: 0;
	}

	.chip {
		padding: 0.0625rem 0.3125rem;
		border: 1px solid #cbd5e1;
		border-radius: 2px;
		background: #f8fafc;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.6875rem;
		font-weight: 600;
		color: #1a1a2e;
	}

	.num {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	.unit {
		color: #64748b;
	}

	.sep {
		color: #cbd5e1;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
	}

	.muted {
		color: #64748b;
	}

	p.muted {
		margin: 0;
		font-size: 0.75rem;
	}

	p.muted a {
		color: #1d4ed8;
	}
</style>
