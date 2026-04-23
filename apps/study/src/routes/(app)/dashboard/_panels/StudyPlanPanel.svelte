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
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--type-heading-3-weight);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-strong);
		background: var(--surface-panel);
		color: var(--ink-muted);
		text-decoration: none;
	}

	.action-btn:hover {
		background: var(--surface-sunken);
	}

	.action-btn.primary {
		background: var(--action-default);
		color: var(--action-default-ink);
		border-color: var(--action-default);
	}

	.action-btn.primary:hover {
		background: var(--action-default-hover);
	}

	.meta {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: var(--space-sm);
		row-gap: var(--space-2xs);
		font-size: var(--type-ui-caption-size);
	}

	.row {
		display: contents;
	}

	.row dt {
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-size: var(--font-size-xs);
		font-family: var(--font-family-mono);
		padding-top: var(--space-2xs);
	}

	.row dd {
		margin: 0;
		color: var(--ink-body);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2xs);
		min-width: 0;
	}

	.chip {
		padding: 1px var(--space-xs);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--type-heading-3-weight);
		color: var(--ink-body);
	}

	.num {
		font-family: var(--font-family-mono);
		font-variant-numeric: tabular-nums;
		font-weight: var(--type-heading-3-weight);
	}

	.unit {
		color: var(--ink-subtle);
	}

	.sep {
		color: var(--edge-strong);
		font-family: var(--font-family-mono);
	}

	.muted {
		color: var(--ink-subtle);
	}

	p.muted {
		margin: 0;
		font-size: var(--type-ui-caption-size);
	}

	p.muted a {
		color: var(--action-default-hover);
	}
</style>
