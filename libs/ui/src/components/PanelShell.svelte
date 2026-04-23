<script lang="ts" module>
export type PanelVariant = 'live' | 'gated';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Standard panel with title + optional subtitle + optional action slot +
 * body, plus an inline error state. Designed to be drop-in compatible with
 * the dashboard's existing TUI PanelShell so the nine panel call sites
 * keep working when they migrate one at a time.
 *
 * The panel header picks up theme-specific treatment automatically:
 *   web -- normal-case sans, regular weight, base-size heading
 *   tui -- uppercase caps-spaced mono, small heading
 *
 * `variant='gated'` dashes the border and mutes everything -- used by
 * placeholder panels so the grid still renders but the user can tell the
 * panel hasn't loaded real data yet.
 */

let {
	title,
	subtitle,
	action,
	variant = 'live',
	error,
	errorMessage,
	children,
}: {
	title: string;
	subtitle?: string;
	action?: Snippet;
	variant?: PanelVariant;
	error?: string;
	errorMessage?: string;
	children: Snippet;
} = $props();

const slugId = $derived(`panel-${title.replace(/\s+/g, '-').toLowerCase()}`);
const fallbackErrorMessage = $derived(`Unable to load ${title.toLowerCase()} -- try refreshing.`);
const resolvedError = $derived(error ? (errorMessage ?? fallbackErrorMessage) : undefined);
</script>

<article
	class="panel"
	class:gated={variant === 'gated'}
	aria-labelledby={slugId}
>
	<header class="ph">
		<div class="hg">
			<h2 id={slugId}>{title}</h2>
			{#if subtitle}
				<p class="sub">{subtitle}</p>
			{/if}
		</div>
		{#if action}
			<div class="action">{@render action()}</div>
		{/if}
	</header>

	<div class="body">
		{#if resolvedError}
			<p class="err" role="alert">{resolvedError}</p>
		{:else}
			{@render children()}
		{/if}
	</div>
</article>

<style>
	.panel {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--layout-panel-padding);
		display: flex;
		flex-direction: column;
		gap: var(--layout-panel-gap);
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		box-shadow: var(--shadow-sm);
	}

	.panel.gated {
		background: var(--surface-sunken);
		border-style: dashed;
		border-color: var(--edge-strong);
		color: var(--ink-subtle);
		box-shadow: var(--shadow-none);
	}

	.ph {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
		flex-wrap: wrap;
		padding-bottom: var(--space-2xs);
		border-bottom: 1px solid var(--edge-subtle);
	}

	.panel.gated .ph {
		border-bottom-color: var(--edge-default);
	}

	.hg {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		flex-wrap: wrap;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-family: var(--layout-panel-header-family);
		font-size: var(--layout-panel-header-size);
		font-weight: var(--layout-panel-header-weight);
		text-transform: var(--layout-panel-header-transform);
		letter-spacing: var(--layout-panel-header-tracking);
		color: var(--ink-muted);
	}

	.panel.gated h2 {
		color: var(--ink-faint);
	}

	.sub {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}

	.action {
		display: flex;
		gap: var(--space-xs);
		flex-shrink: 0;
	}

	.body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: var(--space-xs);
		min-height: 0;
		font-size: var(--font-size-sm);
		min-width: 0;
	}

	.err {
		margin: 0;
		padding: var(--space-xs) var(--space-sm);
		background: var(--action-hazard-wash);
		border: 1px solid var(--action-hazard-edge);
		border-radius: var(--radius-sm);
		color: var(--action-hazard);
		font-size: var(--font-size-xs);
	}
</style>
