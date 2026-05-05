<script lang="ts">
import {
	domainLabel,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODE_LABELS,
	SESSION_MODE_VALUES,
	type SessionMode,
} from '@ab/constants';
import { goto } from '$app/navigation';
import { page } from '$app/state';

/**
 * Mode picker + plan/length/focus/cert summary + short-queue warning. Owns
 * the URL-rewriting `changeMode` so the parent stays declarative; mode
 * changes round-trip through the query string so the load function can
 * re-shape the preview.
 */

let {
	mode,
	sessionLength,
	planId,
	planTitle,
	focus,
	cert,
	short,
	itemCount,
}: {
	mode: SessionMode;
	sessionLength: number;
	planId: string;
	planTitle: string;
	focus: import('@ab/constants').Domain | undefined;
	cert: import('@ab/constants').Cert | undefined;
	short: boolean;
	itemCount: number;
} = $props();

function changeMode(nextMode: SessionMode) {
	const next = new URL(page.url);
	next.searchParams.set(QUERY_PARAMS.SESSION_MODE, nextMode);
	next.searchParams.delete(QUERY_PARAMS.SESSION_SEED);
	void goto(next, { replaceState: true, invalidateAll: true });
}
</script>

<article class="controls">
	<div class="mode-row">
		<label for="mode">Mode</label>
		<select
			id="mode"
			value={mode}
			onchange={(e) => changeMode((e.target as HTMLSelectElement).value as SessionMode)}
		>
			{#each SESSION_MODE_VALUES as m (m)}
				<option value={m}>{SESSION_MODE_LABELS[m as SessionMode]}</option>
			{/each}
		</select>
	</div>

	<div class="meta">
		<span>Length: {sessionLength}</span>
		<span>Plan: <a class="link" href={ROUTES.PROGRAM_PLAN(planId)}>{planTitle}</a></span>
		{#if focus}<span>Focus: {domainLabel(focus)}</span>{/if}
		{#if cert}<span>Cert: {cert}</span>{/if}
	</div>

	{#if short}
		<p class="note">Not enough candidates to fill {sessionLength} slots. You'll get {itemCount}.</p>
	{/if}
</article>

<style>
	.controls {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.mode-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.mode-row label {
		font-weight: var(--type-heading-3-weight);
		font-size: var(--type-ui-label-size);
	}

	.mode-row select {
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--type-ui-label-size);
		background: var(--surface-panel);
		color: var(--ink-body);
	}

	.meta {
		display: flex;
		gap: var(--space-lg);
		flex-wrap: wrap;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.link {
		color: var(--action-default);
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.note {
		margin: 0;
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-label-size);
	}
</style>
