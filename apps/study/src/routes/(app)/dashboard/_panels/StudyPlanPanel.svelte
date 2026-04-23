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
import PanelShell from '@ab/ui/components/PanelShell.svelte';

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
		padding: var(--ab-space-2xs) var(--ab-space-sm);
		font-size: var(--ab-font-size-xs);
		font-weight: var(--ab-font-weight-semibold);
		border-radius: var(--ab-radius-sm);
		border: 1px solid var(--ab-color-border-strong);
		background: var(--ab-color-surface);
		color: var(--ab-color-fg-muted);
		text-decoration: none;
	}

	.action-btn:hover {
		background: var(--ab-color-surface-sunken);
	}

	.action-btn.primary {
		background: var(--ab-color-primary);
		color: var(--ab-color-primary-fg);
		border-color: var(--ab-color-primary);
	}

	.action-btn.primary:hover {
		background: var(--ab-color-primary-hover);
	}

	.meta {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: var(--ab-space-sm);
		row-gap: var(--ab-space-3xs);
		font-size: var(--ab-font-size-xs);
	}

	.row {
		display: contents;
	}

	.row dt {
		color: var(--ab-color-fg-faint);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 0.625rem;
		font-family: var(--ab-font-family-mono);
		padding-top: var(--ab-space-3xs);
	}

	.row dd {
		margin: 0;
		color: var(--ab-color-fg);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--ab-space-2xs);
		min-width: 0;
	}

	.chip {
		padding: var(--ab-space-hair) var(--ab-space-xs-alt);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-sm);
		background: var(--ab-color-surface-sunken);
		font-family: var(--ab-font-family-mono);
		font-size: var(--ab-font-size-xs);
		font-weight: var(--ab-font-weight-semibold);
		color: var(--ab-color-fg);
	}

	.num {
		font-family: var(--ab-font-family-mono);
		font-variant-numeric: tabular-nums;
		font-weight: var(--ab-font-weight-semibold);
	}

	.unit {
		color: var(--ab-color-fg-subtle);
	}

	.sep {
		color: var(--ab-color-border-strong);
		font-family: var(--ab-font-family-mono);
	}

	.muted {
		color: var(--ab-color-fg-subtle);
	}

	p.muted {
		margin: 0;
		font-size: var(--ab-font-size-xs);
	}

	p.muted a {
		color: var(--ab-color-primary-hover);
	}
</style>
